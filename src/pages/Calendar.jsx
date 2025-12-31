import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Flag,
} from 'lucide-react';
import { Button, Avatar, Loading } from '../components/common';
import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import './Calendar.css';

const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const Calendar = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'

  useEffect(() => {
    fetchTasks();
  }, [currentDate]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, name, color),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
        `)
        .not('due_date', 'is', null)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTasksForDate = (date) => {
    return tasks.filter((task) => {
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  const renderHeader = () => {
    return (
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft size={20} />
          </button>
          <h2>{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="calendar-actions">
          <Button
            variant="secondary"
            size="small"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <div className="view-toggle">
            <button
              className={viewMode === 'month' ? 'active' : ''}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="calendar-days">
        {days.map((day) => (
          <div key={day} className="day-name">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayTasks = getTasksForDate(currentDay);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);

        days.push(
          <div
            key={day.toString()}
            className={`calendar-cell ${!isCurrentMonth ? 'disabled' : ''} ${
              isSelected ? 'selected' : ''
            } ${isTodayDate ? 'today' : ''}`}
            onClick={() => setSelectedDate(currentDay)}
          >
            <span className="day-number">{format(day, 'd')}</span>
            <div className="cell-tasks">
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="task-dot"
                  style={{
                    backgroundColor: task.project?.color || PRIORITY_COLORS[task.priority],
                  }}
                  title={task.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${task.project_id}/board`);
                  }}
                />
              ))}
              {dayTasks.length > 3 && (
                <span className="more-tasks">+{dayTasks.length - 3}</span>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="calendar-row">
          {days}
        </div>
      );
      days = [];
    }

    return <div className="calendar-body">{rows}</div>;
  };

  const renderSelectedDateTasks = () => {
    if (!selectedDate) return null;

    const dayTasks = getTasksForDate(selectedDate);

    return (
      <div className="selected-date-panel">
        <div className="panel-header">
          <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
          <span className="task-count">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</span>
        </div>

        {dayTasks.length === 0 ? (
          <div className="no-tasks">
            <CalendarIcon size={32} />
            <p>No tasks due on this day</p>
          </div>
        ) : (
          <div className="panel-tasks">
            {dayTasks.map((task) => (
              <div
                key={task.id}
                className="panel-task"
                onClick={() => navigate(`/projects/${task.project_id}/board`)}
              >
                <div
                  className="task-color"
                  style={{ backgroundColor: task.project?.color || '#3b82f6' }}
                />
                <div className="task-info">
                  <span className="task-title">{task.title}</span>
                  <span className="task-project">{task.project?.name}</span>
                </div>
                <div className="task-meta">
                  <span
                    className="priority-badge"
                    style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}
                  >
                    <Flag size={10} />
                    {task.priority}
                  </span>
                  {task.assignee && (
                    <Avatar
                      src={task.assignee.avatar_url}
                      name={task.assignee.full_name}
                      size="xsmall"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderUpcomingTasks = () => {
    const today = new Date();
    const upcomingTasks = tasks
      .filter((task) => {
        const taskDate = parseISO(task.due_date);
        return taskDate >= today && task.status !== 'completed';
      })
      .slice(0, 5);

    return (
      <div className="upcoming-panel">
        <div className="panel-header">
          <h3>Upcoming Tasks</h3>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="no-tasks">
            <p>No upcoming tasks this month</p>
          </div>
        ) : (
          <div className="panel-tasks">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                className="panel-task"
                onClick={() => navigate(`/projects/${task.project_id}/board`)}
              >
                <div
                  className="task-color"
                  style={{ backgroundColor: task.project?.color || '#3b82f6' }}
                />
                <div className="task-info">
                  <span className="task-title">{task.title}</span>
                  <span className="task-date">
                    {format(parseISO(task.due_date), 'MMM d')}
                  </span>
                </div>
                <span
                  className={`status-badge status-${task.status}`}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="calendar-loading">
        <Loading />
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="calendar-main">
        <div className="calendar-container">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>
      </div>

      <div className="calendar-sidebar">
        {selectedDate ? renderSelectedDateTasks() : renderUpcomingTasks()}
      </div>
    </div>
  );
};

export default Calendar;
