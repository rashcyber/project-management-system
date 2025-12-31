import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  CheckSquare,
  Clock,
  Users,
  FolderKanban,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { Button, Avatar, Loading } from '../components/common';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns';
import './Analytics.css';

const Analytics = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { projects, fetchProjects } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    tasksThisWeek: 0,
    completionRate: 0,
    avgCompletionTime: 0,
  });
  const [tasksByStatus, setTasksByStatus] = useState([]);
  const [tasksByPriority, setTasksByPriority] = useState([]);
  const [tasksByProject, setTasksByProject] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState([]);
  const [topContributors, setTopContributors] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchAnalytics();
  }, [fetchProjects]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all tasks
      const { data: allTasks } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, color),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
        `);

      if (!allTasks) {
        setLoading(false);
        return;
      }

      // Calculate basic stats
      const completed = allTasks.filter(t => t.status === 'completed');
      const thisWeekStart = startOfWeek(new Date());
      const thisWeekEnd = endOfWeek(new Date());
      const tasksThisWeek = allTasks.filter(t => {
        const createdAt = new Date(t.created_at);
        return isWithinInterval(createdAt, { start: thisWeekStart, end: thisWeekEnd });
      });

      setStats({
        totalTasks: allTasks.length,
        completedTasks: completed.length,
        tasksThisWeek: tasksThisWeek.length,
        completionRate: allTasks.length > 0
          ? Math.round((completed.length / allTasks.length) * 100)
          : 0,
      });

      // Tasks by status
      const statusCounts = {
        not_started: { label: 'Not Started', count: 0, color: '#94a3b8' },
        in_progress: { label: 'In Progress', count: 0, color: '#3b82f6' },
        review: { label: 'Review', count: 0, color: '#8b5cf6' },
        completed: { label: 'Completed', count: 0, color: '#22c55e' },
      };
      allTasks.forEach(t => {
        if (statusCounts[t.status]) {
          statusCounts[t.status].count++;
        }
      });
      setTasksByStatus(Object.values(statusCounts));

      // Tasks by priority
      const priorityCounts = {
        low: { label: 'Low', count: 0, color: '#22c55e' },
        medium: { label: 'Medium', count: 0, color: '#f59e0b' },
        high: { label: 'High', count: 0, color: '#f97316' },
        urgent: { label: 'Urgent', count: 0, color: '#ef4444' },
      };
      allTasks.forEach(t => {
        if (priorityCounts[t.priority]) {
          priorityCounts[t.priority].count++;
        }
      });
      setTasksByPriority(Object.values(priorityCounts));

      // Tasks by project
      const projectCounts = {};
      allTasks.forEach(t => {
        if (t.project) {
          if (!projectCounts[t.project.id]) {
            projectCounts[t.project.id] = {
              name: t.project.name,
              color: t.project.color,
              total: 0,
              completed: 0,
            };
          }
          projectCounts[t.project.id].total++;
          if (t.status === 'completed') {
            projectCounts[t.project.id].completed++;
          }
        }
      });
      setTasksByProject(
        Object.values(projectCounts)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      );

      // Weekly activity
      const days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date(),
      });
      const activity = days.map(day => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const created = allTasks.filter(t => {
          const date = new Date(t.created_at);
          return isWithinInterval(date, { start: dayStart, end: dayEnd });
        }).length;

        const completedOnDay = allTasks.filter(t => {
          if (t.status !== 'completed') return false;
          const date = new Date(t.updated_at);
          return isWithinInterval(date, { start: dayStart, end: dayEnd });
        }).length;

        return {
          day: format(day, 'EEE'),
          date: format(day, 'MMM d'),
          created,
          completed: completedOnDay,
        };
      });
      setWeeklyActivity(activity);

      // Top contributors
      const contributorCounts = {};
      allTasks.forEach(t => {
        if (t.assignee && t.status === 'completed') {
          if (!contributorCounts[t.assignee.id]) {
            contributorCounts[t.assignee.id] = {
              user: t.assignee,
              completed: 0,
            };
          }
          contributorCounts[t.assignee.id].completed++;
        }
      });
      setTopContributors(
        Object.values(contributorCounts)
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 5)
      );

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxStatusCount = Math.max(...tasksByStatus.map(s => s.count), 1);
  const maxPriorityCount = Math.max(...tasksByPriority.map(p => p.count), 1);
  const maxActivityCount = Math.max(
    ...weeklyActivity.flatMap(d => [d.created, d.completed]),
    1
  );

  if (loading) {
    return (
      <div className="analytics-loading">
        <Loading />
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1>Analytics</h1>
          <p>Track your team's productivity and progress</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="analytics-stats">
        <div className="analytics-stat-card">
          <div className="stat-icon primary">
            <CheckSquare size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalTasks}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="stat-icon success">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.completedTasks}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="stat-icon info">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.tasksThisWeek}</span>
            <span className="stat-label">This Week</span>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="stat-icon warning">
            <BarChart3 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.completionRate}%</span>
            <span className="stat-label">Completion Rate</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-grid">
        {/* Weekly Activity */}
        <div className="analytics-card wide">
          <div className="card-header">
            <h2>Weekly Activity</h2>
            <span className="card-subtitle">Tasks created vs completed</span>
          </div>
          <div className="card-content">
            <div className="activity-chart">
              {weeklyActivity.map((day, index) => (
                <div key={index} className="activity-bar-group">
                  <div className="activity-bars">
                    <div
                      className="activity-bar created"
                      style={{ height: `${(day.created / maxActivityCount) * 100}%` }}
                      title={`${day.created} created`}
                    />
                    <div
                      className="activity-bar completed"
                      style={{ height: `${(day.completed / maxActivityCount) * 100}%` }}
                      title={`${day.completed} completed`}
                    />
                  </div>
                  <span className="activity-day">{day.day}</span>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color created" />
                Created
              </span>
              <span className="legend-item">
                <span className="legend-color completed" />
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Tasks by Status */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Tasks by Status</h2>
          </div>
          <div className="card-content">
            <div className="horizontal-chart">
              {tasksByStatus.map((status, index) => (
                <div key={index} className="chart-row">
                  <span className="chart-label">{status.label}</span>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar"
                      style={{
                        width: `${(status.count / maxStatusCount) * 100}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </div>
                  <span className="chart-value">{status.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks by Priority */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Tasks by Priority</h2>
          </div>
          <div className="card-content">
            <div className="horizontal-chart">
              {tasksByPriority.map((priority, index) => (
                <div key={index} className="chart-row">
                  <span className="chart-label">{priority.label}</span>
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar"
                      style={{
                        width: `${(priority.count / maxPriorityCount) * 100}%`,
                        backgroundColor: priority.color,
                      }}
                    />
                  </div>
                  <span className="chart-value">{priority.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks by Project */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Top Projects</h2>
          </div>
          <div className="card-content">
            {tasksByProject.length === 0 ? (
              <div className="empty-chart">No project data</div>
            ) : (
              <div className="project-stats">
                {tasksByProject.map((project, index) => (
                  <div key={index} className="project-stat-row">
                    <div
                      className="project-color"
                      style={{ backgroundColor: project.color || '#3b82f6' }}
                    />
                    <div className="project-info">
                      <span className="project-name">{project.name}</span>
                      <span className="project-progress">
                        {project.completed}/{project.total} completed
                      </span>
                    </div>
                    <div className="project-bar-wrapper">
                      <div
                        className="project-bar"
                        style={{
                          width: `${(project.completed / project.total) * 100}%`,
                          backgroundColor: project.color || '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="analytics-card">
          <div className="card-header">
            <h2>Top Contributors</h2>
          </div>
          <div className="card-content">
            {topContributors.length === 0 ? (
              <div className="empty-chart">No contributor data</div>
            ) : (
              <div className="contributors-list">
                {topContributors.map((contributor, index) => (
                  <div key={index} className="contributor-row">
                    <span className="contributor-rank">#{index + 1}</span>
                    <Avatar
                      src={contributor.user.avatar_url}
                      name={contributor.user.full_name}
                      size="small"
                    />
                    <span className="contributor-name">
                      {contributor.user.full_name}
                    </span>
                    <span className="contributor-count">
                      {contributor.completed} tasks
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
