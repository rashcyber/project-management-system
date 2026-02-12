import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Search,
  Filter,
  Calendar,
  Flag,
  ArrowRight,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button, Avatar, Loading } from '../components/common';
import ScrollToTop from '../components/ScrollToTop';
import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';
import { format, isPast, isToday, isTomorrow, isThisWeek } from 'date-fns';
import './MyTasks.css';

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#22c55e', icon: Flag },
  medium: { label: 'Medium', color: '#f59e0b', icon: Flag },
  high: { label: 'High', color: '#f97316', icon: Flag },
  urgent: { label: 'Urgent', color: '#ef4444', icon: AlertCircle },
};

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#94a3b8', icon: Circle },
  in_progress: { label: 'In Progress', color: '#3b82f6', icon: Clock },
  review: { label: 'Review', color: '#8b5cf6', icon: Clock },
  completed: { label: 'Completed', color: '#22c55e', icon: CheckCircle },
};

const MyTasks = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuthStore();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState('due_date');
  const [groupBy, setGroupBy] = useState('none');

  useEffect(() => {
    if (searchParams.get('filter') === 'overdue') {
      setShowOverdueOnly(true);
      setStatusFilter('all');
      // Clear the param to avoid it persisting on every refresh if the user changes filters manually
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchTasks();
  }, [profile?.id]);

  const fetchTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, color),
          creator:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          task_assignees!inner(user_id)
        `)
        .eq('task_assignees.user_id', profile.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (showOverdueOnly) {
        if (!task.due_date || task.status === 'completed') return false;
        if (!isPast(new Date(task.due_date)) || isToday(new Date(task.due_date))) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.project?.name.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'status':
          const statusOrder = { not_started: 0, in_progress: 1, review: 2, completed: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const getDueDateLabel = (dueDate) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    overdue: tasks.filter((t) => {
      if (!t.due_date || t.status === 'completed') return false;
      return isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
    }).length,
  };

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || showOverdueOnly;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setShowOverdueOnly(false);
  };

  const getGroupedTasks = () => {
    const grouped = {};

    if (groupBy === 'none') {
      return { 'All Tasks': filteredTasks };
    }

    filteredTasks.forEach((task) => {
      let groupKey = '';

      switch (groupBy) {
        case 'project':
          groupKey = task.project?.name || 'No Project';
          break;
        case 'status':
          groupKey = STATUS_CONFIG[task.status]?.label || task.status;
          break;
        case 'priority':
          groupKey = PRIORITY_CONFIG[task.priority]?.label || task.priority;
          break;
        default:
          return;
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(task);
    });

    return grouped;
  };

  const groupedTasks = getGroupedTasks();

  return (
    <div className="my-tasks-page">
      <div className="my-tasks-header">
        <div>
          <h1>My Tasks</h1>
          <p>All tasks assigned to you across projects</p>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="small"
            onClick={resetFilters}
            icon={<X size={16} />}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="task-stats">
        <div className="stat-item">
          <span className="stat-value">{taskStats.total}</span>
          <span className="stat-label">Total Tasks</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{taskStats.inProgress}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{taskStats.completed}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-item">
          <span className="stat-value text-danger">{taskStats.overdue}</span>
          <span className="stat-label">Overdue</span>
        </div>
      </div>

      {/* Filters */}
      <div className="my-tasks-toolbar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priority</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="due_date">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="status">Sort by Status</option>
            <option value="title">Sort by Title</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="filter-select"
          >
            <option value="none">Group by: None</option>
            <option value="project">Group by Project</option>
            <option value="status">Group by Status</option>
            <option value="priority">Group by Priority</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="my-tasks-loading">
          <Loading />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="my-tasks-empty">
          <CheckSquare size={64} />
          <h2>{searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
            ? 'No tasks match your filters'
            : 'No tasks assigned to you'}</h2>
          <p>
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Tasks assigned to you will appear here'}
          </p>
        </div>
      ) : (
        <div className="my-tasks-list">
          {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
            <div key={groupName} className="task-group">
              {groupBy !== 'none' && (
                <div className="group-header">
                  <h3>{groupName}</h3>
                  <span className="group-count">{groupTasks.length}</span>
                </div>
              )}
              {groupTasks.map((task) => {
                const priority = PRIORITY_CONFIG[task.priority];
                const status = STATUS_CONFIG[task.status];
                const StatusIcon = status.icon;
                const dueDateLabel = getDueDateLabel(task.due_date);
                const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';

                return (
                  <div key={task.id} className="my-task-item">
                    <button
                      className={`task-check-btn ${task.status === 'completed' ? 'checked' : ''}`}
                      onClick={() => handleStatusChange(
                        task.id,
                        task.status === 'completed' ? 'not_started' : 'completed'
                      )}
                      style={{ color: task.status === 'completed' ? status.color : undefined }}
                    >
                      <StatusIcon size={20} />
                    </button>

                    <div
                      className="task-content"
                      onClick={() => navigate(`/projects/${task.project_id}/board`)}
                    >
                      <div className="task-main">
                        <span className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>
                          {task.title}
                        </span>
                        <div className="task-meta">
                          <span
                            className="task-project"
                            style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                          >
                            {task.project?.name}
                          </span>
                          {task.description && (
                            <span className="task-description">
                              {task.description.substring(0, 50)}
                              {task.description.length > 50 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="task-badges">
                        <span
                          className="priority-badge"
                          style={{ backgroundColor: `${priority.color}20`, color: priority.color }}
                        >
                          <Flag size={12} />
                          {priority.label}
                        </span>

                        {dueDateLabel && (
                          <span className={`due-badge ${isOverdue ? 'overdue' : ''}`}>
                            <Calendar size={12} />
                            {dueDateLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      className="task-arrow"
                      onClick={() => navigate(`/projects/${task.project_id}/board`)}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default MyTasks;
