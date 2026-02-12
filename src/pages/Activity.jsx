import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { Activity as ActivityIcon, Filter, RefreshCw, Search, X } from 'lucide-react';
import { Button, Avatar, Loading } from '../components/common';
import ScrollToTop from '../components/ScrollToTop';
import useActivityStore from '../store/activityStore';
import useProjectStore from '../store/projectStore';
import './Activity.css';

const getActivityMessage = (activity) => {
  const { action, details, task, user } = activity;
  const userName = user?.full_name || 'Someone';
  const taskTitle = task?.title || details?.task_title || 'a task';

  switch (action) {
    case 'task_created':
      return <><strong>{userName}</strong> created task <strong>{taskTitle}</strong></>;
    case 'task_updated':
      return <><strong>{userName}</strong> updated task <strong>{taskTitle}</strong></>;
    case 'task_deleted':
      return <><strong>{userName}</strong> deleted task <strong>{details?.task_title || 'a task'}</strong></>;
    case 'task_completed':
      return <><strong>{userName}</strong> completed task <strong>{taskTitle}</strong></>;
    case 'task_assigned':
      return <><strong>{userName}</strong> assigned <strong>{details?.assignee_name || 'someone'}</strong> to <strong>{taskTitle}</strong></>;
    case 'comment_added':
      return <><strong>{userName}</strong> commented on <strong>{taskTitle}</strong></>;
    case 'member_added':
      return <><strong>{userName}</strong> added <strong>{details?.member_name || 'a member'}</strong> to the project</>;
    case 'member_removed':
      return <><strong>{userName}</strong> removed <strong>{details?.member_name || 'a member'}</strong> from the project</>;
    case 'project_created':
      return <><strong>{userName}</strong> created the project</>;
    case 'project_updated':
      return <><strong>{userName}</strong> updated project settings</>;
    case 'status_changed':
      return <><strong>{userName}</strong> moved <strong>{taskTitle}</strong> from <span className="status-badge">{details?.from_status?.replace('_', ' ')}</span> to <span className="status-badge">{details?.to_status?.replace('_', ' ')}</span></>;
    default:
      return <><strong>{userName}</strong> performed an action</>;
  }
};

const formatActivityDate = (date) => {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, yyyy h:mm a');
};

const groupActivitiesByDate = (activities) => {
  const groups = {};

  activities.forEach((activity) => {
    const date = new Date(activity.created_at);
    let key;

    if (isToday(date)) {
      key = 'Today';
    } else if (isYesterday(date)) {
      key = 'Yesterday';
    } else {
      key = format(date, 'MMMM d, yyyy');
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(activity);
  });

  return groups;
};

const Activity = () => {
  const navigate = useNavigate();
  const { activities, loading, fetchAllActivities } = useActivityStore();
  const { projects, fetchProjects } = useProjectStore();
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
    fetchAllActivities();
  }, [fetchProjects, fetchAllActivities]);

  const handleRefresh = () => {
    fetchAllActivities();
  };

  const filteredActivities = activities.filter((activity) => {
    if (selectedProject !== 'all' && activity.project_id !== selectedProject) {
      return false;
    }
    if (selectedAction !== 'all' && activity.action !== selectedAction) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const userName = activity.user?.full_name?.toLowerCase() || '';
      const taskTitle = activity.task?.title?.toLowerCase() || activity.details?.task_title?.toLowerCase() || '';
      const projectName = activity.project?.name?.toLowerCase() || '';
      const actionName = activity.action?.toLowerCase() || '';

      return (
        userName.includes(query) ||
        taskTitle.includes(query) ||
        projectName.includes(query) ||
        actionName.includes(query)
      );
    }
    return true;
  });

  const hasActiveFilters = searchQuery !== '' || selectedProject !== 'all' || selectedAction !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedProject('all');
    setSelectedAction('all');
  };

  const groupedActivities = groupActivitiesByDate(filteredActivities);
  const actionTypes = [...new Set(activities.map((a) => a.action))];

  return (
    <div className="activity-page">
      <div className="activity-header">
        <div>
          <h1>Activity Feed</h1>
          <p>See what's happening across your projects</p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={18} />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      <div className="activity-toolbar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <Filter size={16} />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
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

        <span className="activity-count">
          {filteredActivities.length} activities
        </span>
      </div>

      {loading ? (
        <div className="activity-loading">
          <Loading />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="activity-empty">
          <ActivityIcon size={64} />
          <h2>No activity yet</h2>
          <p>Activity will appear here as you and your team work on projects</p>
        </div>
      ) : (
        <div className="activity-timeline">
          {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
            <div key={dateGroup} className="activity-group">
              <div className="activity-group-header">
                <span className="group-date">{dateGroup}</span>
                <span className="group-count">{groupActivities.length} activities</span>
              </div>

              <div className="activity-list">
                {groupActivities.map((activity) => {
                  return (
                    <div key={activity.id} className="activity-item">
                      <Avatar
                        src={activity.user?.avatar_url}
                        name={activity.user?.full_name}
                        size="small"
                      />

                      <div className="activity-content">
                        <div className="activity-message">
                          {getActivityMessage(activity)}
                        </div>

                        <div className="activity-meta">
                          {activity.project && (
                            <div
                              className="activity-project"
                              onClick={() => navigate(`/projects/${activity.project_id}/board`)}
                            >
                              <span
                                className="project-dot"
                                style={{ backgroundColor: activity.project.color || '#3b82f6' }}
                              />
                              {activity.project.name}
                            </div>
                          )}
                          <span className="activity-time">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <ScrollToTop />
    </div>
  );
};

export default Activity;
