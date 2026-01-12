import React, { useState, useEffect } from 'react';
import { Repeat2, X } from 'lucide-react';
import './RecurrenceSettings.css';

export function RecurrenceSettings({ onClose, onSave, recurrencePattern = null }) {
  const [frequency, setFrequency] = useState('weekly');
  const [interval, setInterval] = useState(1);
  const [days, setDays] = useState([1, 3, 5]); // Mon, Wed, Fri
  const [endDate, setEndDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(1);

  useEffect(() => {
    if (recurrencePattern) {
      setFrequency(recurrencePattern.frequency || 'weekly');
      setInterval(recurrencePattern.interval || 1);
      setDays(recurrencePattern.days || [1, 3, 5]);
      setEndDate(recurrencePattern.end_date || '');
      setDayOfMonth(recurrencePattern.day_of_month || 1);
    }
  }, [recurrencePattern]);

  const handleDayToggle = (dayIndex) => {
    setDays((prevDays) =>
      prevDays.includes(dayIndex)
        ? prevDays.filter((d) => d !== dayIndex)
        : [...prevDays, dayIndex].sort()
    );
  };

  const handleSave = () => {
    const pattern = {
      frequency,
      interval: parseInt(interval),
      days: frequency === 'weekly' ? days : undefined,
      day_of_month: frequency === 'monthly' ? parseInt(dayOfMonth) : undefined,
      end_date: endDate || undefined,
    };
    onSave(pattern);
    onClose();
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="recurrence-settings">
      {/* Frequency */}
      <div>
        <label>Repeat Pattern</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {/* Interval */}
      {frequency !== 'daily' && (
        <div>
          <label>
            Repeat every {frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years'}
          </label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
            min="1"
            max="12"
          />
        </div>
      )}

      {/* Weekly Days Selection */}
      {frequency === 'weekly' && (
        <div>
          <label>Repeat on</label>
          <div className="day-selector">
            {dayNames.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayToggle(index)}
                className={`day-btn ${days.includes(index) ? 'active' : ''}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Day Selection */}
      {frequency === 'monthly' && (
        <div>
          <label>Repeat on day</label>
          <select
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Day {i + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* End Date */}
      <div>
        <label>End recurrence (optional)</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {endDate && (
          <p className="helper-text">
            Will stop creating new recurring instances after this date
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="preview-box">
        <p>
          <span className="preview-label">Preview:</span> This task will repeat{' '}
          {frequency === 'daily'
            ? 'every day'
            : frequency === 'weekly'
            ? `every ${interval} week(s) on ${days.map((d) => dayNames[d]).join(', ')}`
            : frequency === 'monthly'
            ? `every ${interval} month(s) on day ${dayOfMonth}`
            : `every ${interval} year(s)`}
          {endDate && ` until ${new Date(endDate).toLocaleDateString()}`}
        </p>
      </div>

      {/* Actions */}
      <div className="recurrence-actions">
        <button
          type="button"
          onClick={onClose}
          className="cancel-btn"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="save-btn"
        >
          Save Pattern
        </button>
      </div>
    </div>
  );
}

export default RecurrenceSettings;
