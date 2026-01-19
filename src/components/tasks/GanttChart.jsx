import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './GanttChart.css';

const GanttChart = ({ tasks, onTaskUpdate, projectId }) => {
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [scrollLeft, setScrollLeft] = useState(0);

  // Calculate date range from tasks
  const { startDate, endDate } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const today = new Date();
      return {
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0)
      };
    }

    const dates = tasks
      .map(task => ({
        start: task.created_at ? new Date(task.created_at) : new Date(),
        end: task.due_date ? new Date(task.due_date) : new Date()
      }))
      .flat();

    const minDate = new Date(Math.min(...dates.map(d => d.start)));
    const maxDate = new Date(Math.max(...dates.map(d => d.end)));

    // Add 1 week buffer on each side
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return {
      startDate: minDate,
      endDate: maxDate
    };
  }, [tasks]);

  // Generate grid dates (every day)
  const gridDates = useMemo(() => {
    const dates = [];
    const current = new Date(startDate);
    // Make sure we include endDate
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    // Add one more day to ensure endDate is visible
    if (dates[dates.length - 1] < endDate) {
      dates.push(new Date(endDate));
    }
    return dates;
  }, [startDate, endDate]);

  // Get total days for width calculation
  const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
  const cellWidth = 30; // pixels per day
  const totalWidth = Math.max(totalDays * cellWidth, 600); // minimum width of 600px

  // Calculate task bar position and width using pixel-based positioning for perfect alignment
  const getTaskBarStyle = (task) => {
    if (!task.due_date && !task.created_at) {
      return { left: '0px', width: '30px' };
    }

    // Use due_date as the primary indicator, created_at as fallback
    const taskStart = task.created_at ? new Date(task.created_at) : startDate;
    const taskEnd = task.due_date ? new Date(task.due_date) : new Date();

    // Calculate exact day offsets from startDate (normalize to start of day)
    const startDay = new Date(taskStart);
    startDay.setHours(0, 0, 0, 0);
    const startDateNorm = new Date(startDate);
    startDateNorm.setHours(0, 0, 0, 0);

    const startDayOffset = Math.max(0, Math.floor((startDay.getTime() - startDateNorm.getTime()) / (1000 * 60 * 60 * 24)));

    const endDay = new Date(taskEnd);
    endDay.setHours(0, 0, 0, 0);
    const endDayOffset = Math.max(startDayOffset + 1, Math.floor((endDay.getTime() - startDateNorm.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Convert to pixels (aligned to grid)
    const leftPixels = startDayOffset * cellWidth;
    const widthPixels = Math.max((endDayOffset - startDayOffset) * cellWidth, cellWidth * 0.5);

    return {
      left: `${leftPixels}px`,
      width: `${widthPixels}px`
    };
  };

  // Get task status color
  const getStatusColor = (status) => {
    const colors = {
      'not_started': '#94a3b8',
      'in_progress': '#3b82f6',
      'review': '#8b5cf6',
      'completed': '#22c55e'
    };
    return colors[status] || '#6b7280';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef5350',
      'urgent': '#dc2626'
    };
    return colors[priority] || '#6b7280';
  };

  // Toggle task expansion
  const toggleExpanded = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  // Group subtasks by task
  const tasksWithSubtasks = useMemo(() => {
    return tasks.map(task => ({
      ...task,
      visibleSubtasks: expandedTasks.has(task.id) ? (task.subtasks || []) : []
    }));
  }, [tasks, expandedTasks]);

  // Format date for header
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="gantt-container">
      {/* Legend */}
      <div className="gantt-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#3b82f6' }}></div>
          <span>In Progress</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#22c55e' }}></div>
          <span>Completed</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#8b5cf6' }}></div>
          <span>Review</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#94a3b8' }}></div>
          <span>Not Started</span>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="gantt-wrapper">
        {/* Task List (Left Side) */}
        <div className="gantt-tasks-column">
          <div className="gantt-task-header">
            <div className="task-title-col">Tasks ({tasks.length})</div>
          </div>
          <div className="gantt-task-list">
            {tasksWithSubtasks.map((task) => (
              <React.Fragment key={task.id}>
                {/* Main Task */}
                <div className={`gantt-task-row ${task.status === 'completed' ? 'completed' : ''}`}>
                  <div className="task-title-col">
                    <div className="task-row-content">
                      <button
                        className="expand-btn"
                        onClick={() => toggleExpanded(task.id)}
                        style={{ visibility: task.subtasks && task.subtasks.length > 0 ? 'visible' : 'hidden' }}
                      >
                        {expandedTasks.has(task.id) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                      <div className="task-info">
                        <div className="task-title">{task.title}</div>
                        <div className="task-meta">
                          {task.assignees && task.assignees.length > 0 && (
                            <span className="assignee-badge">
                              {task.assignees[0].full_name}
                            </span>
                          )}
                          {task.priority && (
                            <span
                              className="priority-badge"
                              style={{ background: getPriorityColor(task.priority) }}
                            >
                              {task.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subtasks */}
                {task.visibleSubtasks && task.visibleSubtasks.map((subtask) => (
                  <div key={subtask.id} className="gantt-subtask-row">
                    <div className="task-title-col">
                      <div className="subtask-content">
                        <div className="subtask-indicator"></div>
                        <div className="subtask-title">
                          {subtask.title}
                          {subtask.completed && <span className="completed-badge">✓</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Timeline (Right Side) */}
        <div className="gantt-timeline-column" onScroll={(e) => setScrollLeft(e.target.scrollLeft)}>
          {/* Header with dates */}
          <div className="gantt-header">
            <div className="gantt-header-row" style={{ width: `${totalWidth}px` }}>
              {gridDates.map((date, idx) => (
                // Show date every 7 days (more compact header)
                idx % 7 === 0 && (
                  <div
                    key={idx}
                    className="gantt-header-cell"
                    style={{ width: `${cellWidth * 7}px` }}
                    title={formatDate(date)}
                  >
                    {formatDate(date)}
                  </div>
                )
              ))}
              {/* Add final marker if needed */}
              {gridDates.length % 7 !== 0 && (
                <div
                  className="gantt-header-cell"
                  style={{ width: `${(gridDates.length % 7) * cellWidth}px` }}
                  title={formatDate(endDate)}
                >
                  {formatDate(endDate)}
                </div>
              )}
            </div>
            {/* Grid lines */}
            <div className="gantt-grid-lines" style={{ width: `${totalWidth}px` }}>
              {gridDates.map((date, idx) => (
                <div
                  key={idx}
                  className={`gantt-grid-line ${idx % 7 === 0 ? 'week-line' : ''}`}
                  style={{ width: `${cellWidth}px` }}
                ></div>
              ))}
            </div>
          </div>

          {/* Task bars */}
          <div className="gantt-bars">
            {tasksWithSubtasks.map((task) => (
              <React.Fragment key={task.id}>
                {/* Main task bar */}
                <div className="gantt-bar-row">
                  <div
                    className={`gantt-task-bar ${task.status}`}
                    style={{
                      ...getTaskBarStyle(task),
                      background: getStatusColor(task.status)
                    }}
                    title={`${task.title} - ${task.status}`}
                  >
                    <span className="bar-label">{task.title}</span>
                  </div>
                </div>

                {/* Subtask bars */}
                {task.visibleSubtasks && task.visibleSubtasks.map((subtask) => (
                  <div key={subtask.id} className="gantt-bar-row subtask-bar-row">
                    <div
                      className={`gantt-subtask-bar ${subtask.completed ? 'completed' : 'pending'}`}
                      style={{
                        ...getTaskBarStyle(task),
                        background: subtask.completed ? '#22c55e' : '#cbd5e1'
                      }}
                      title={`${subtask.title} ${subtask.completed ? '(Completed)' : '(Pending)'}`}
                    >
                      <span className="bar-label">{subtask.title}</span>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Today indicator */}
          <div className="gantt-today-line" style={{
            left: `${((new Date() - startDate) / (1000 * 60 * 60 * 24) / totalDays) * 100}%`
          }}></div>
        </div>
      </div>

      {/* Info */}
      {tasks.length === 0 && (
        <div className="gantt-empty">
          <p>No tasks to display. Create a task to see it on the timeline.</p>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
