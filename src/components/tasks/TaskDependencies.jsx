import React, { useState, useEffect } from 'react';
import { Link, Link2, X, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import useDependencyStore from '../../store/dependencyStore';
import useTaskStore from '../../store/taskStore';
import { Button, Modal, Avatar } from '../common';
import { toast } from '../../store/toastStore';
import './TaskDependencies.css';

const TaskDependencies = ({ task, projectId, members }) => {
  // Safety checks for required props
  if (!task || !task.id) {
    return null;
  }

  const { dependencies, fetchDependencies, addDependency, removeDependency, getBlockingTasks, getBlockedTasks, isTaskBlocked } = useDependencyStore();
  const { tasks } = useTaskStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBlockingTask, setSelectedBlockingTask] = useState('');
  const [dependencyType, setDependencyType] = useState('blocks'); // 'blocks' or 'blocked_by'

  useEffect(() => {
    if (projectId && task?.id) {
      fetchDependencies(projectId).catch(error => {
        console.error('Error fetching dependencies:', error);
      });
    }
  }, [projectId, task?.id, fetchDependencies]);

  const blockingTasks = task?.id ? (getBlockingTasks(task.id) || []) : [];
  const blockedTasks = task?.id ? (getBlockedTasks(task.id) || []) : [];
  const currentlyBlocked = task?.id ? isTaskBlocked(task.id) : false;

  const availableTasks = tasks.filter(t =>
    t.id !== task.id &&
    !blockingTasks.find(bt => bt.id === t.id) &&
    !blockedTasks.find(bt => bt.id === t.id)
  );

  const handleAddDependency = async () => {
    if (!selectedBlockingTask) return;

    const blockingTaskId = dependencyType === 'blocks'
      ? task.id
      : selectedBlockingTask;
    const blockedTaskId = dependencyType === 'blocks'
      ? selectedBlockingTask
      : task.id;

    const { error } = await addDependency(blockingTaskId, blockedTaskId);
    if (error) {
      toast.error('Failed to add dependency');
    } else {
      toast.success('Dependency added');
      setShowAddModal(false);
      setSelectedBlockingTask('');
      // Refresh dependencies
      await fetchDependencies(task.project_id);
    }
  };

  const handleRemoveDependency = async (dependencyId) => {
    try {
      const { error } = await removeDependency(dependencyId);
      if (error) {
        console.error('Remove dependency error:', error);
        toast.error('Failed to remove dependency');
      } else {
        toast.success('Dependency removed');
        // Refresh dependencies
        await fetchDependencies(task.project_id);
      }
    } catch (error) {
      console.error('Error removing dependency:', error);
      toast.error('Error removing dependency');
    }
  };


  return (
    <div className="task-dependencies">
      <div className="dependencies-header">
        <div className="dependencies-title">
          <Link2 size={18} />
          <h3>Dependencies</h3>
        </div>
        <Button
          variant="ghost"
          size="small"
          icon={<Plus size={16} />}
          onClick={() => setShowAddModal(true)}
        >
          Add
        </Button>
      </div>

      {currentlyBlocked && blockedTasks.length > 0 && (
        <div className="dependency-warning">
          <AlertCircle size={16} />
          <span>
            This task is blocked by: {blockedTasks.map(t => t?.title).filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      {blockingTasks.length === 0 && blockedTasks.length === 0 ? (
        <p className="no-dependencies">No dependencies set</p>
      ) : (
        <div className="dependencies-list">
          {blockingTasks.length > 0 && (
            <div className="dependency-section">
              <h4>This task blocks:</h4>
              {blockingTasks
                .filter(depTask => depTask) // Filter out undefined tasks
                .map((depTask) => {
                  const dep = dependencies.find(d => d.blocking_task_id === task.id && d.blocked_task_id === depTask.id);
                  if (!depTask || !dep) return null;
                  return (
                    <div key={dep.id} className="dependency-item">
                      <div className="dependency-task-info">
                        <div className={`task-status-indicator status-${depTask.status}`}>
                          {depTask.status === 'completed' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <AlertCircle size={14} />
                          )}
                        </div>
                        <div className="dependency-task-details">
                          <span className="dependency-task-title">{depTask.title || 'Unknown Task'}</span>
                          <span className="dependency-task-status">
                            {depTask.status ? depTask.status.replace('_', ' ') : 'unknown'}
                          </span>
                        </div>
                      </div>
                      <button
                        className="dependency-remove-btn"
                        onClick={() => handleRemoveDependency(dep.id)}
                        title="Remove dependency"
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              }
            </div>
          )}

          {blockedTasks.length > 0 && (
            <div className="dependency-section">
              <h4>Blocked by:</h4>
              {blockedTasks
                .filter(depTask => depTask) // Filter out undefined tasks
                .map((depTask) => {
                  const dep = dependencies.find(d => d.blocked_task_id === task.id && d.blocking_task_id === depTask.id);
                  if (!depTask || !dep) return null;
                  return (
                    <div key={dep.id} className="dependency-item">
                      <div className="dependency-task-info">
                        <div className={`task-status-indicator status-${depTask.status}`}>
                          {depTask.status === 'completed' ? (
                            <CheckCircle size={14} />
                          ) : (
                            <AlertCircle size={14} />
                          )}
                        </div>
                        <div className="dependency-task-details">
                          <span className="dependency-task-title">{depTask.title || 'Unknown Task'}</span>
                          <span className="dependency-task-status">
                            {depTask.status ? depTask.status.replace('_', ' ') : 'unknown'}
                          </span>
                        </div>
                      </div>
                      <button
                        className="dependency-remove-btn"
                        onClick={() => handleRemoveDependency(dep.id)}
                        title="Remove dependency"
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedBlockingTask('');
        }}
        title="Add Dependency"
        size="small"
      >
        <div className="add-dependency-form">
          <p className="add-dependency-info">
            {dependencyType === 'blocks'
              ? `Select a task that "${task.title}" should block:`
              : `Select a task that is blocking "${task.title}":`}
          </p>

          <div className="dependency-type-selector">
            <button
              className={`type-btn ${dependencyType === 'blocks' ? 'active' : ''}`}
              onClick={() => setDependencyType('blocks')}
            >
              <Link size={14} />
              This task blocks
            </button>
            <button
              className={`type-btn ${dependencyType === 'blocked_by' ? 'active' : ''}`}
              onClick={() => setDependencyType('blocked_by')}
            >
              <Link size={14} />
              Blocked by
            </button>
          </div>

          <select
            className="dependency-select"
            value={selectedBlockingTask}
            onChange={(e) => setSelectedBlockingTask(e.target.value)}
          >
            <option value="">Select a task...</option>
            {availableTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status.replace('_', ' ')})
              </option>
            ))}
          </select>

          {availableTasks.length === 0 && (
            <p className="no-available-tasks">
              No available tasks to create dependencies with
            </p>
          )}

          <div className="add-dependency-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddModal(false);
                setSelectedBlockingTask('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddDependency}
              disabled={!selectedBlockingTask || availableTasks.length === 0}
            >
              Add Dependency
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TaskDependencies;
