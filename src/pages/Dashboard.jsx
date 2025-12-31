import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  CheckSquare,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Plus,
  ArrowRight,
  Activity,
  Calendar,
  ListTodo,
  AlertTriangle,
  PlusCircle,
  LayoutGrid,
  BarChart3,
  Zap,
  TrendingUp as TrendingUpIcon,
  Flag,
  Bell,
} from 'lucide-react';
import { Button, Avatar, Loading } from '../components/common';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import useActivityStore from '../store/activityStore';
import useNotificationStore from '../store/notificationStore';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import './Dashboard.css';

const Dashboard = () => {
  const { profile } = useAuthStore();
  const { projects, fetchProjects, loading: projectsLoading } = useProjectStore();
  const { activities, fetchAllActivities } = useActivityStore();
  const { notifications, fetchNotifications } = useNotificationStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    inProgressTasks: 0,
  });
  const [myTasks, setMyTasks] = useState([]);
  const [mySubtasks, setMySubtasks] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState({
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
  });
  const [taskDistribution, setTaskDistribution] = useState({
    not_started: 0,
    in_progress: 0,
    review: 0,
    completed: 0,
  });
  const [taskByPriority, setTaskByPriority] = useState({
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  });
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    fetchAllActivities();
    fetchNotifications();
  }, [fetchProjects, fetchAllActivities, fetchNotifications]);

  // Fetch user's tasks, subtasks and calculate real stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.id) return;
      setLoading(true);

      try {
        // Fetch all tasks assigned to the user via task_assignees junction table
        const { data: userTasks } = await supabase
          .from('tasks')
          .select(`
            *,
            project:projects(id, name, color),
            task_assignees!inner(user_id)
          `)
          .eq('task_assignees.user_id', profile.id);

        // Fetch all subtasks assigned to the user
        const { data: userSubtasks } = await supabase
          .from('subtasks')
          .select(`
            *,
            task:tasks(id, title, project_id, project:projects(id, name, color))
          `)
          .eq('assigned_to', profile.id)
          .eq('completed', false)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch all tasks across user's projects
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, status, due_date, priority');

        if (userTasks) {
          setMyTasks(userTasks.slice(0, 5));

          // Categorize tasks by deadline for user
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endOfWeek = addDays(today, 7);

          const overdue = [];
          const todayTasks = [];
          const tomorrowTasks = [];
          const thisWeekTasks = [];

          userTasks
            .filter(t => t.due_date && t.status !== 'completed')
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
            .forEach(task => {
              const dueDate = new Date(task.due_date);
              dueDate.setHours(0, 0, 0, 0);

              if (dueDate < today) {
                overdue.push(task);
              } else if (isToday(dueDate)) {
                todayTasks.push(task);
              } else if (isTomorrow(dueDate)) {
                tomorrowTasks.push(task);
              } else if (dueDate <= endOfWeek) {
                thisWeekTasks.push(task);
              }
            });

          setUpcomingDeadlines({
            overdue,
            today: todayTasks,
            tomorrow: tomorrowTasks,
            thisWeek: thisWeekTasks,
          });
        }

        if (userSubtasks) {
          setMySubtasks(userSubtasks);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completed = allTasks?.filter(t => t.status === 'completed').length || 0;
        const overdueCount = allTasks?.filter(t => {
          if (!t.due_date || t.status === 'completed') return false;
          return new Date(t.due_date) < today;
        }).length || 0;
        const inProgress = allTasks?.filter(t => t.status === 'in_progress').length || 0;

        // Calculate task distribution by status
        const notStarted = allTasks?.filter(t => t.status === 'not_started').length || 0;
        const inReview = allTasks?.filter(t => t.status === 'review').length || 0;

        setTaskDistribution({
          not_started: notStarted,
          in_progress: inProgress,
          review: inReview,
          completed: completed,
        });

        // Calculate tasks by priority
        const lowPriority = allTasks?.filter(t => t.priority === 'low').length || 0;
        const mediumPriority = allTasks?.filter(t => t.priority === 'medium').length || 0;
        const highPriority = allTasks?.filter(t => t.priority === 'high').length || 0;
        const urgentPriority = allTasks?.filter(t => t.priority === 'urgent').length || 0;

        setTaskByPriority({
          low: lowPriority,
          medium: mediumPriority,
          high: highPriority,
          urgent: urgentPriority,
        });

        // Calculate weekly progress (tasks completed per day this week)
        const weekStart = startOfWeek(new Date());
        const weekEnd = endOfWeek(new Date());
        const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

        const weeklyData = daysOfWeek.map(day => {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);

          const completedOnDay = allTasks?.filter(t => {
            if (t.status !== 'completed' || !t.updated_at) return false;
            const completedDate = new Date(t.updated_at);
            return completedDate >= dayStart && completedDate <= dayEnd;
          }).length || 0;

          return {
            day: format(day, 'EEE'),
            completed: completedOnDay,
          };
        });

        setWeeklyProgress(weeklyData);

        setStats({
          totalProjects: projects.length,
          totalTasks: allTasks?.length || 0,
          completedTasks: completed,
          overdueTasks: overdueCount,
          inProgressTasks: inProgress,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id && projects.length >= 0) {
      fetchStats();
    }
  }, [profile?.id, projects.length]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleToggleSubtask = async (subtaskId) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ completed: true })
        .eq('id', subtaskId);

      if (error) throw error;

      // Remove from list locally
      setMySubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (error) {
      console.error('Failed to complete subtask:', error);
    }
  };

  const statCards = [
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      icon: FolderKanban,
      color: 'primary',
      change: `${stats.totalProjects} active`,
    },
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: CheckSquare,
      color: 'info',
      change: `${stats.inProgressTasks} in progress`,
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      icon: TrendingUp,
      color: 'success',
      change: `${Math.round((stats.completedTasks / Math.max(stats.totalTasks, 1)) * 100)}% completion rate`,
    },
    {
      title: 'Overdue',
      value: stats.overdueTasks,
      icon: AlertCircle,
      color: 'danger',
      change: stats.overdueTasks > 0 ? 'Needs attention' : 'All on track',
    },
  ];

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}!</h1>
          <p>Here's what's happening with your projects today.</p>
        </div>
        <div className="quick-actions-header">
          <button
            className="quick-action-btn-header"
            onClick={() => navigate('/projects/new')}
          >
            <div className="quick-action-icon-header primary">
              <PlusCircle size={18} />
            </div>
            <span>New Project</span>
          </button>
          <button
            className="quick-action-btn-header"
            onClick={() => navigate('/calendar')}
          >
            <div className="quick-action-icon-header info">
              <LayoutGrid size={18} />
            </div>
            <span>Board View</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className={`stat-card stat-${stat.color}`}>
            <div className="stat-icon">
              <stat.icon size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-title">{stat.title}</span>
              <span className="stat-change">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue Alert */}
      {upcomingDeadlines.overdue.length > 0 && (
        <div className="dashboard-card overdue-alert-card" style={{ marginBottom: '1.5rem' }}>
          <div className="overdue-alert">
            <div className="overdue-alert-icon">
              <AlertTriangle size={28} />
            </div>
            <div className="overdue-alert-content">
              <h3>Attention: {upcomingDeadlines.overdue.length} Overdue Task{upcomingDeadlines.overdue.length > 1 ? 's' : ''}</h3>
              <p>You have tasks past their due date. Click to view and update them.</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions & Task by Priority Row */}
      <div className="dashboard-grid">
        {/* Quick Actions */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <Zap size={18} />
              Quick Actions
            </h2>
          </div>
          <div className="card-content">
            <div className="quick-actions-grid">
              <button
                className="quick-action-item"
                onClick={() => navigate('/projects/new')}
              >
                <div className="quick-action-icon primary">
                  <PlusCircle size={24} />
                </div>
                <span className="quick-action-label">New Project</span>
              </button>
              <button
                className="quick-action-item"
                onClick={() => navigate('/tasks')}
              >
                <div className="quick-action-icon info">
                  <CheckSquare size={24} />
                </div>
                <span className="quick-action-label">My Tasks</span>
              </button>
              <button
                className="quick-action-item"
                onClick={() => navigate('/calendar')}
              >
                <div className="quick-action-icon warning">
                  <Calendar size={24} />
                </div>
                <span className="quick-action-label">Calendar</span>
              </button>
              <button
                className="quick-action-item"
                onClick={() => navigate('/activity')}
              >
                <div className="quick-action-icon success">
                  <Activity size={24} />
                </div>
                <span className="quick-action-label">Activity</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tasks by Priority */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <Flag size={18} />
              Tasks by Priority
            </h2>
          </div>
          <div className="card-content">
            <div className="priority-list">
              {Object.entries(taskByPriority).map(([priority, count]) => {
                const percentage = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
                return (
                  <div key={priority} className="priority-item">
                    <div className="priority-indicator">
                      <div className={`priority-dot priority-${priority}`} />
                      <span className="priority-label">{priority}</span>
                    </div>
                    <div className="priority-info">
                      <div className="priority-bar-bg">
                        <div
                          className={`priority-bar priority-${priority}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="priority-count">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Task Distribution & Weekly Progress Row */}
      <div className="dashboard-grid">
        {/* Task Distribution */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <BarChart3 size={18} />
              Task Distribution
            </h2>
          </div>
          <div className="card-content">
            <div className="task-distribution">
              {Object.entries(taskDistribution).map(([status, count]) => {
                const percentage = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
                return (
                  <div key={status} className="distribution-item">
                    <div className="distribution-header">
                      <span className={`distribution-status status-${status}`}>
                        {status.replace('_', ' ')}
                      </span>
                      <span className="distribution-count">{count}</span>
                    </div>
                    <div className="distribution-bar-bg">
                      <div
                        className={`distribution-bar distribution-${status}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly Progress */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <TrendingUpIcon size={18} />
              Weekly Progress
            </h2>
          </div>
          <div className="card-content">
            <div className="weekly-progress">
              {weeklyProgress.map((day, index) => {
                const maxValue = Math.max(...weeklyProgress.map(d => d.completed), 1);
                const height = maxValue > 0 ? (day.completed / maxValue) * 80 : 0;
                const isToday = day.day === format(new Date(), 'EEE');
                return (
                  <div key={index} className="weekly-day">
                    <div className="weekly-bar-container">
                      <div
                        className={`weekly-bar ${isToday ? 'today' : ''}`}
                        style={{ height: `${Math.max(height, 4)}px` }}
                      />
                      <span className="weekly-count">{day.completed}</span>
                    </div>
                    <span className={`weekly-label ${isToday ? 'today' : ''}`}>{day.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      {upcomingDeadlines.today.length > 0 && (
        <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2>
              <Clock size={18} />
              Today's Schedule
            </h2>
            <span className="today-count">{upcomingDeadlines.today.length} task{upcomingDeadlines.today.length > 1 ? 's' : ''}</span>
          </div>
          <div className="card-content">
            <div className="today-schedule-list">
              {upcomingDeadlines.today.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="today-schedule-item"
                  onClick={() => navigate(`/projects/${task.project_id}/board`)}
                >
                  <div className="schedule-time">
                    <Clock size={14} />
                    <span>{task.due_date ? format(new Date(task.due_date), 'h:mm a') : 'All day'}</span>
                  </div>
                  <div className={`task-priority priority-${task.priority}`} />
                  <div className="schedule-info">
                    <span className="schedule-title">{task.title}</span>
                    <span
                      className="schedule-project"
                      style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                    >
                      {task.project?.name}
                    </span>
                  </div>
                  <span className={`task-status status-${task.status}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="dashboard-grid">
        {/* Recent Projects */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Projects</h2>
            <button className="view-all-btn" onClick={() => navigate('/projects')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {projectsLoading ? (
              <div className="loading-state">
                <Loading />
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <FolderKanban size={48} />
                <h3>No projects yet</h3>
                <p>Create your first project to get started</p>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => navigate('/projects/new')}
                >
                  Create Project
                </Button>
              </div>
            ) : (
              <div className="project-list">
                {projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="project-item"
                    onClick={() => navigate(`/projects/${project.id}/board`)}
                  >
                    <div
                      className="project-color"
                      style={{ backgroundColor: project.color || '#3b82f6' }}
                    />
                    <div className="project-info">
                      <span className="project-name">{project.name}</span>
                      <span className="project-meta">
                        {project.project_members?.length || 0} members
                      </span>
                    </div>
                    <ArrowRight size={16} className="project-arrow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Tasks */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>My Tasks</h2>
            <button className="view-all-btn" onClick={() => navigate('/tasks')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="loading-state">
                <Loading />
              </div>
            ) : myTasks.length === 0 ? (
              <div className="empty-state">
                <CheckSquare size={48} />
                <h3>No tasks assigned</h3>
                <p>Tasks assigned to you will appear here</p>
              </div>
            ) : (
              <div className="tasks-list">
                {myTasks.map((task) => (
                  <div
                    key={task.id}
                    className="task-item"
                    onClick={() => navigate(`/projects/${task.project_id}/board`)}
                  >
                    <div className={`task-priority priority-${task.priority}`} />
                    <div className="task-info">
                      <span className="task-title">{task.title}</span>
                      <div className="task-meta">
                        <span
                          className="task-project"
                          style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                        >
                          {task.project?.name}
                        </span>
                        {task.due_date && (
                          <span className={`task-due ${isPast(new Date(task.due_date)) && task.status !== 'completed' ? 'overdue' : ''}`}>
                            <Calendar size={12} />
                            {isToday(new Date(task.due_date))
                              ? 'Today'
                              : format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`task-status status-${task.status}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="dashboard-grid">
        {/* My Subtasks */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <ListTodo size={18} />
              My Subtasks
            </h2>
            <button className="view-all-btn" onClick={() => navigate('/my-subtasks')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="loading-state">
                <Loading />
              </div>
            ) : mySubtasks.length === 0 ? (
              <div className="empty-state">
                <ListTodo size={48} />
                <h3>No subtasks assigned</h3>
                <p>Subtasks assigned to you will appear here</p>
              </div>
            ) : (
              <div className="subtasks-list">
                {mySubtasks.map((subtask) => (
                  <div key={subtask.id} className="subtask-item">
                    <label className="subtask-checkbox">
                      <input
                        type="checkbox"
                        onChange={() => handleToggleSubtask(subtask.id)}
                      />
                      <span>{subtask.title}</span>
                    </label>
                    <div className="subtask-meta">
                      <span
                        className="subtask-project"
                        style={{ borderLeftColor: subtask.task?.project?.color || '#3b82f6' }}
                      >
                        {subtask.task?.project?.name}
                      </span>
                      <span className="subtask-task">
                        {subtask.task?.title}
                      </span>
                    </div>
                    <button
                      className="subtask-goto"
                      onClick={() => navigate(`/projects/${subtask.task?.project_id}/board`)}
                      title="Go to task"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Activity</h2>
            <button className="view-all-btn" onClick={() => navigate('/activity')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {activities.length === 0 ? (
              <div className="empty-state">
                <Activity size={48} />
                <h3>No activity yet</h3>
                <p>Recent activity will appear here</p>
              </div>
            ) : (
              <div className="activity-list">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <Avatar
                      src={activity.user?.avatar_url}
                      name={activity.user?.full_name}
                      size="small"
                    />
                    <div className="activity-info">
                      <span className="activity-text">
                        <strong>{activity.user?.full_name || 'Someone'}</strong>{' '}
                        {activity.action.replace(/_/g, ' ')}
                      </span>
                      <span className="activity-time">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <Bell size={18} />
              Recent Notifications
            </h2>
            <button className="view-all-btn" onClick={() => navigate('/notifications')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {notifications.length === 0 ? (
              <div className="empty-state">
                <Bell size={48} />
                <h3>No notifications yet</h3>
                <p>You'll see notifications here when you receive them</p>
              </div>
            ) : (
              <div className="notification-list">
                {notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => {
                      if (notification.task_id && notification.project_id) {
                        navigate(`/projects/${notification.project_id}/board?task=${notification.task_id}`);
                      } else if (notification.project_id) {
                        navigate(`/projects/${notification.project_id}/board`);
                      }
                    }}
                  >
                    <div className="notification-content">
                      <p className="notification-title">{notification.title}</p>
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>
              <Clock size={18} />
              Upcoming Deadlines
            </h2>
            <button className="view-all-btn" onClick={() => navigate('/calendar')}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="loading-state">
                <Loading />
              </div>
            ) : (
              <div className="deadlines-list">
                {/* Overdue */}
                {upcomingDeadlines.overdue.length > 0 && (
                  <div className="deadline-group">
                    <div className="deadline-group-header overdue">
                      <AlertTriangle size={14} />
                      <span>Overdue ({upcomingDeadlines.overdue.length})</span>
                    </div>
                    {upcomingDeadlines.overdue.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="deadline-item"
                        onClick={() => navigate(`/projects/${task.project_id}/board`)}
                      >
                        <div className={`task-priority priority-${task.priority}`} />
                        <div className="deadline-info">
                          <span className="deadline-title">{task.title}</span>
                          <span
                            className="deadline-project"
                            style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                          >
                            {task.project?.name}
                          </span>
                        </div>
                        <span className="deadline-date overdue">
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Today */}
                {upcomingDeadlines.today.length > 0 && (
                  <div className="deadline-group">
                    <div className="deadline-group-header today">
                      <Clock size={14} />
                      <span>Today ({upcomingDeadlines.today.length})</span>
                    </div>
                    {upcomingDeadlines.today.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="deadline-item"
                        onClick={() => navigate(`/projects/${task.project_id}/board`)}
                      >
                        <div className={`task-priority priority-${task.priority}`} />
                        <div className="deadline-info">
                          <span className="deadline-title">{task.title}</span>
                          <span
                            className="deadline-project"
                            style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                          >
                            {task.project?.name}
                          </span>
                        </div>
                        <span className="deadline-date">Today</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tomorrow */}
                {upcomingDeadlines.tomorrow.length > 0 && (
                  <div className="deadline-group">
                    <div className="deadline-group-header tomorrow">
                      <Calendar size={14} />
                      <span>Tomorrow ({upcomingDeadlines.tomorrow.length})</span>
                    </div>
                    {upcomingDeadlines.tomorrow.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="deadline-item"
                        onClick={() => navigate(`/projects/${task.project_id}/board`)}
                      >
                        <div className={`task-priority priority-${task.priority}`} />
                        <div className="deadline-info">
                          <span className="deadline-title">{task.title}</span>
                          <span
                            className="deadline-project"
                            style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                          >
                            {task.project?.name}
                          </span>
                        </div>
                        <span className="deadline-date">Tomorrow</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* This Week */}
                {upcomingDeadlines.thisWeek.length > 0 && (
                  <div className="deadline-group">
                    <div className="deadline-group-header this-week">
                      <Calendar size={14} />
                      <span>This Week ({upcomingDeadlines.thisWeek.length})</span>
                    </div>
                    {upcomingDeadlines.thisWeek.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="deadline-item"
                        onClick={() => navigate(`/projects/${task.project_id}/board`)}
                      >
                        <div className={`task-priority priority-${task.priority}`} />
                        <div className="deadline-info">
                          <span className="deadline-title">{task.title}</span>
                          <span
                            className="deadline-project"
                            style={{ borderLeftColor: task.project?.color || '#3b82f6' }}
                          >
                            {task.project?.name}
                          </span>
                        </div>
                        <span className="deadline-date">
                          {format(new Date(task.due_date), 'EEE, MMM d')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* No upcoming deadlines */}
                {upcomingDeadlines.overdue.length === 0 &&
                  upcomingDeadlines.today.length === 0 &&
                  upcomingDeadlines.tomorrow.length === 0 &&
                  upcomingDeadlines.thisWeek.length === 0 && (
                    <div className="empty-state">
                      <Clock size={40} />
                      <h3>No upcoming deadlines</h3>
                      <p>All caught up! No tasks due soon.</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
