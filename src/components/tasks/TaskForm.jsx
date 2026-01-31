import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Flag, User, X, Check, Search, Repeat2, Copy } from 'lucide-react';
import { Button, Input, Avatar, Modal } from '../common';
import { RecurrenceSettings } from '../RecurrenceSettings';
import { ReminderSettings } from '../ReminderSettings';
import { TemplateManager } from '../TemplateManager';
import useTaskStore from '../../store/taskStore';
import useTemplateStore from '../../store/templateStore';
import { toast } from '../../store/toastStore';
import './TaskForm.css';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const TaskForm = ({ projectId, task, initialStatus, onClose, members }) => {
  const { createTask, updateTask, loading } = useTaskStore();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: initialStatus || 'not_started',
    due_date: '',
    assignee_ids: [],
  });
  const [reminders, setReminders] = useState([]);
  const [errors, setErrors] = useState({});
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState(null);
  const [showTemplateMode, setShowTemplateMode] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const { saveTaskAsTemplate } = useTemplateStore();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.status || initialStatus || 'not_started',
        due_date: task.due_date || '',
        assignee_ids: task.assignees?.map(a => a.id) || [],
      });
      setReminders(task.reminders || []);
    }
  }, [task, initialStatus]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    } else if (formData.title.length < 2) {
      newErrors.title = 'Title must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const toggleAssignee = useCallback((userId) => {
    setFormData((prev) => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(userId)
        ? prev.assignee_ids.filter((id) => id !== userId)
        : [...prev.assignee_ids, userId],
    }));
  }, []);

  const filteredMembers = members?.filter(
    (member) =>
      member.user?.full_name?.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
      member.user?.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  ) || [];

  const selectedAssignees = members?.filter((m) =>
    formData.assignee_ids.includes(m.user_id)
  ) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const taskData = {
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      project_id: projectId,
      assignee_ids: formData.assignee_ids,
      due_date: formData.due_date || null,
      reminders: reminders.length > 0 ? reminders : null,
    };

    let result;
    if (task) {
      result = await updateTask(task.id, taskData);
    } else {
      result = await createTask(taskData);
    }

    if (result.error) {
      toast.error(result.error.message || 'Failed to save task');
      return;
    }

    toast.success(task ? 'Task updated successfully!' : 'Task created successfully!');
    onClose();
  };

  const handleSelectTemplate = (template) => {
    // Populate form with template data
    const newFormData = {
      title: template.title_template || '',
      description: template.description_template || '',
      priority: template.priority || 'medium',
      status: template.status || initialStatus || 'not_started',
      due_date: template.due_date || '',
      assignee_ids: template.assignee_ids || [],
    };

    setFormData((prev) => ({
      ...prev,
      ...newFormData,
    }));
    setShowTemplateMode(false);
    toast.success('Template applied!');
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    const templateData = {
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      estimated_hours: formData.estimated_hours,
      subtasks: formData.subtasks || [],
      assignees: formData.assignee_ids || [],
      task_labels: formData.labels || [],
    };

    const { error } = await saveTaskAsTemplate(templateData, templateName, false);
    if (error) {
      toast.error('Failed to save template');
    } else {
      toast.success('Task saved as template!');
      setShowSaveAsTemplate(false);
      setTemplateName('');
    }
  };

  if (showTemplateMode) {
    return (
      <div className="task-form template-mode">
        <div className="template-mode-header">
          <h3>Choose a Template</h3>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => setShowTemplateMode(false)}
          >
            Back
          </Button>
        </div>
        <TemplateManager
          onSelectTemplate={handleSelectTemplate}
          projectId={projectId}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <Input
        label="Task Title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="Enter task title"
        error={errors.title}
        required
      />

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Add a description..."
          className="form-textarea"
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            <Flag size={14} />
            Priority
          </label>
          <div className="priority-options">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`priority-option ${formData.priority === p.value ? 'selected' : ''}`}
                style={{
                  '--priority-color': p.color,
                  borderColor: formData.priority === p.value ? p.color : 'var(--border-color)',
                }}
                onClick={() => setFormData((prev) => ({ ...prev, priority: p.value }))}
              >
                <span className="priority-dot" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            <Calendar size={14} />
            Due Date
          </label>
          <input
            type="date"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        <div className="form-group" ref={dropdownRef}>
          <label className="form-label">
            <User size={14} />
            Assignees
          </label>
          <div
            className="multi-select-container"
            onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
          >
            <div className="multi-select-display">
              {selectedAssignees.length === 0 ? (
                <span className="placeholder">Select assignees...</span>
              ) : (
                <div className="selected-tags">
                  {selectedAssignees.slice(0, 3).map((member) => (
                    <span key={member.user_id} className="assignee-tag">
                      <Avatar
                        src={member.user?.avatar_url}
                        name={member.user?.full_name}
                        size="xsmall"
                      />
                      <span>{member.user?.full_name?.split(' ')[0]}</span>
                      <button
                        type="button"
                        className="remove-tag"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssignee(member.user_id);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedAssignees.length > 3 && (
                    <span className="more-count">+{selectedAssignees.length - 3}</span>
                  )}
                </div>
              )}
              <span className="dropdown-arrow">▼</span>
            </div>

            {isAssigneeDropdownOpen && (
              <div className="multi-select-dropdown">
                <div className="dropdown-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="dropdown-list">
                  <div
                    className={`dropdown-item ${formData.assignee_ids.length === 0 ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, assignee_ids: [] }));
                    }}
                  >
                    <span className="item-label">Unassigned</span>
                    {formData.assignee_ids.length === 0 && <Check size={14} />}
                  </div>
                  {filteredMembers.map((member) => {
                    const isSelected = formData.assignee_ids.includes(member.user_id);
                    return (
                      <div
                        key={member.user_id}
                        className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssignee(member.user_id);
                        }}
                      >
                        <Avatar
                          src={member.user?.avatar_url}
                          name={member.user?.full_name}
                          size="small"
                        />
                        <span className="item-label">
                          {member.user?.full_name || member.user?.email || 'Unknown'}
                        </span>
                        {isSelected && <Check size={14} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recurrence Section */}
      <div className="form-group">
        <label className="form-label">
          <Repeat2 size={14} />
          Recurrence
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowRecurrenceModal(true)}
          className="recurrence-button"
        >
          {recurrencePattern ? `Recurring: ${recurrencePattern.frequency}` : 'Set Recurrence...'}
        </Button>
      </div>

      {/* Reminders Section */}
      {formData.due_date && (
        <ReminderSettings
          reminders={reminders}
          onChange={setReminders}
          dueDate={formData.due_date}
        />
      )}

      <div className="form-actions">
        <div className="form-actions-left">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {!task && (
            <Button
              type="button"
              variant="ghost"
              icon={<Copy size={14} />}
              onClick={() => setShowTemplateMode(true)}
            >
              From Template
            </Button>
          )}
        </div>
        <div className="form-actions-right">
          {!task && (
            <Button
              type="button"
              variant="secondary"
              icon={<Copy size={14} />}
              onClick={() => setShowSaveAsTemplate(true)}
            >
              Save as Template
            </Button>
          )}
          <Button type="submit" variant="primary" loading={loading}>
            {task ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </div>

      {/* Recurrence Settings Modal */}
      <Modal
        isOpen={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        title="Set Recurrence"
        size="small"
      >
        <RecurrenceSettings
          recurrencePattern={recurrencePattern}
          onSave={(pattern) => {
            setRecurrencePattern(pattern);
            setShowRecurrenceModal(false);
          }}
          onClose={() => setShowRecurrenceModal(false)}
        />
      </Modal>

      {/* Save as Template Modal */}
      <Modal
        isOpen={showSaveAsTemplate}
        onClose={() => {
          setShowSaveAsTemplate(false);
          setTemplateName('');
        }}
        title="Save as Template"
        size="small"
      >
        <div className="save-template-modal">
          <p className="modal-description">
            Save this task structure as a template for future use. You can create tasks from this template quickly.
          </p>
          <Input
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Bug Report Template"
            autoFocus
          />
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowSaveAsTemplate(false);
                setTemplateName('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveAsTemplate}
            >
              Save Template
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
};

export default TaskForm;
