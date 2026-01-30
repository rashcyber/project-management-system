import React, { useState } from 'react';
import { Bell, X, Clock } from 'lucide-react';
import { Button } from './common';
import './ReminderSettings.css';

const REMINDER_OPTIONS = [
  { value: 'at_time', label: 'At time of due date', hours: 0 },
  { value: '15_min', label: '15 minutes before', hours: -0.25 },
  { value: '1_hour', label: '1 hour before', hours: -1 },
  { value: '1_day', label: '1 day before', hours: -24 },
  { value: '2_days', label: '2 days before', hours: -48 },
  { value: 'custom', label: 'Custom', hours: null },
];

/**
 * ReminderSettings Component
 * Allows users to set up reminders for task due dates
 *
 * Props:
 * - reminders: Array of reminder objects {type, hours}
 * - onChange: Callback when reminders change
 * - dueDate: The task's due date (for calculating reminder times)
 */
export const ReminderSettings = ({ reminders = [], onChange, dueDate }) => {
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [customHours, setCustomHours] = useState(1);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const addReminder = (reminderType) => {
    const option = REMINDER_OPTIONS.find(o => o.value === reminderType);

    const newReminder = {
      type: reminderType,
      hours: reminderType === 'custom' ? customHours : option.hours,
    };

    // Check if reminder already exists
    const exists = reminders.some(r => r.type === reminderType);
    if (!exists) {
      onChange([...reminders, newReminder]);
      setShowAddReminder(false);
      setCustomHours(1);
    }
  };

  const removeReminder = (index) => {
    onChange(reminders.filter((_, i) => i !== index));
  };

  const updateCustomHours = (index, hours) => {
    const updated = [...reminders];
    updated[index].hours = hours;
    onChange(updated);
  };

  const getReminderLabel = (reminder) => {
    const option = REMINDER_OPTIONS.find(o => o.value === reminder.type);
    return option?.label || `Custom (${reminder.hours}h)`;
  };

  const calculateReminderTime = (reminder) => {
    if (!dueDate) return null;

    const dueDateTime = new Date(dueDate);
    const reminderTime = new Date(dueDateTime.getTime() + reminder.hours * 60 * 60 * 1000);

    return reminderTime.toLocaleString();
  };

  return (
    <div className="reminder-settings">
      <div className="reminder-header">
        <div className="reminder-title">
          <Bell size={18} />
          <span>Due Date Reminders</span>
        </div>
        <p className="reminder-subtitle">Get notified before your tasks are due</p>
      </div>

      {/* Active Reminders List */}
      {reminders.length > 0 && (
        <div className="reminders-list">
          {reminders.map((reminder, index) => (
            <div key={index} className="reminder-item">
              <div className="reminder-item-header">
                <div className="reminder-item-content">
                  <div className="reminder-info">
                    <Clock size={16} />
                    <span className="reminder-label">{getReminderLabel(reminder)}</span>
                  </div>
                  {dueDate && (
                    <span className="reminder-time">
                      {calculateReminderTime(reminder)}
                    </span>
                  )}
                </div>

                {reminder.type === 'custom' && (
                  <div className="custom-hours-input">
                    <input
                      type="number"
                      min="-720"
                      max="720"
                      value={reminder.hours}
                      onChange={(e) => updateCustomHours(index, parseInt(e.target.value))}
                      className="hours-input"
                    />
                    <span className="hours-label">hours</span>
                  </div>
                )}

                <button
                  type="button"
                  className="remove-reminder"
                  onClick={() => removeReminder(index)}
                  title="Remove reminder"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Reminder Button/Dropdown */}
      <div className="add-reminder-section">
        {!showAddReminder ? (
          <button
            type="button"
            className="add-reminder-btn"
            onClick={() => setShowAddReminder(true)}
          >
            <Bell size={14} />
            {reminders.length === 0 ? 'Add Reminder' : 'Add Another Reminder'}
          </button>
        ) : (
          <div className="reminder-options">
            <div className="options-grid">
              {REMINDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="option-btn"
                  onClick={() => {
                    if (option.value === 'custom') {
                      setExpandedIndex(expandedIndex === option.value ? null : option.value);
                    } else {
                      addReminder(option.value);
                    }
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {expandedIndex === 'custom' && (
              <div className="custom-reminder-form">
                <div className="custom-input-group">
                  <label>Hours before due date (negative = before, positive = after)</label>
                  <div className="custom-input-wrapper">
                    <input
                      type="number"
                      min="-720"
                      max="720"
                      value={customHours}
                      onChange={(e) => setCustomHours(parseInt(e.target.value))}
                      placeholder="e.g., -2 for 2 hours before"
                      className="custom-hours-input"
                    />
                    <span className="input-suffix">hours</span>
                  </div>
                  <small className="custom-help-text">
                    Negative values remind you before the due date, positive values after
                  </small>
                </div>
                <div className="custom-actions">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => addReminder('custom')}
                  >
                    Add Custom Reminder
                  </Button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setExpandedIndex(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="close-options-btn"
              onClick={() => setShowAddReminder(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Info Message */}
      {reminders.length === 0 && !showAddReminder && (
        <div className="reminder-info-box">
          <p>No reminders set. Add a reminder to get notified before your task is due.</p>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;
