import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTodo, ArrowRight, CheckSquare, Calendar } from 'lucide-react';
import { Button, Loading, Avatar } from '../components/common';
import useAuthStore from '../store/authStore';
import { supabase } from '../lib/supabase';
import { format, isPast, isToday } from 'date-fns';
import './MySubtasks.css';

const MySubtasks = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySubtasks();
  }, [profile?.id]);

  const fetchMySubtasks = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select(`
          *,
          task:tasks(
            id,
            title,
            due_date,
            status,
            priority,
            project_id,
            project:projects(id, name, color)
          )
        `)
        .eq('assigned_to', profile.id)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Failed to fetch subtasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubtask = async (subtaskId) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ completed: true })
        .eq('id', subtaskId);

      if (error) throw error;

      // Remove from list locally
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (error) {
      console.error('Failed to complete subtask:', error);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>My Subtasks</h1>
        </div>
        <div className="loading-state">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Subtasks</h1>
        <p className="page-subtitle">
          {subtasks.length} incomplete subtask{subtasks.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {subtasks.length === 0 ? (
        <div className="empty-state-large">
          <ListTodo size={64} />
          <h2>No subtasks assigned</h2>
          <p>Subtasks assigned to you will appear here</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      ) : (
        <div className="subtasks-page-list">
          {subtasks.map((subtask) => (
            <div key={subtask.id} className="subtask-page-item">
              <div className="subtask-page-main">
                <label className="subtask-page-checkbox">
                  <input
                    type="checkbox"
                    onChange={() => handleToggleSubtask(subtask.id)}
                  />
                  <span className="subtask-page-title">{subtask.title}</span>
                </label>

                <div className="subtask-page-meta">
                  {subtask.task?.project && (
                    <span
                      className="subtask-page-project"
                      style={{ borderLeftColor: subtask.task.project.color || '#3b82f6' }}
                    >
                      {subtask.task.project.name}
                    </span>
                  )}
                  {subtask.task && (
                    <span className="subtask-page-task">
                      {subtask.task.title}
                    </span>
                  )}
                </div>
              </div>

              <div className="subtask-page-actions">
                <button
                  className="subtask-page-goto"
                  onClick={() => navigate(`/projects/${subtask.task?.project_id}/board`)}
                  title="Go to task"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySubtasks;
