import React, { useState } from 'react';
import { Clock, Plus, Trash2, Loader, ChevronDown } from 'lucide-react';
import useTaskStore from '../store/taskStore';
import './TimeTracker.css';

export function TimeTracker({ taskId, currentTask }) {
  const [showForm, setShowForm] = useState(false);
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeEntries, setTimeEntries] = useState([]);
  const [showEntries, setShowEntries] = useState(false);

  const { logTimeEntry, fetchTimeEntries } = useTaskStore();

  const handleLogTime = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await logTimeEntry(taskId, duration, description);
      if (result.error) {
        throw result.error;
      }
      setDuration(30);
      setDescription('');
      setShowForm(false);
      // Refresh entries
      await loadTimeEntries();
    } catch (error) {
      console.error('Error logging time:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeEntries = async () => {
    try {
      const result = await fetchTimeEntries(taskId);
      if (result.data) {
        setTimeEntries(result.data);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
    }
  };

  const handleShowEntries = async () => {
    if (!showEntries) {
      await loadTimeEntries();
    }
    setShowEntries(!showEntries);
  };

  const hours = currentTask?.actual_hours || 0;
  const estimated = currentTask?.estimated_hours || 0;
  const hoursLeft = Math.max(0, estimated - hours);
  const percentage = estimated ? Math.round((hours / estimated) * 100) : 0;

  return (
    <div className="time-tracker">
      <div className="time-tracker-header">
        <div className="time-tracker-title">
          <Clock size={20} />
          <h3>Time Tracking</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="time-tracker-btn"
          title="Add time entry"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Time Summary */}
      <div className="time-summary">
        <div className="time-summary-item estimated">
          <div className="time-summary-label">Estimated</div>
          <div className="time-summary-value">{estimated.toFixed(1)}h</div>
        </div>
        <div className="time-summary-item actual">
          <div className="time-summary-label">Actual</div>
          <div className="time-summary-value">{hours.toFixed(1)}h</div>
        </div>
        <div className="time-summary-item remaining">
          <div className="time-summary-label">Remaining</div>
          <div className="time-summary-value">{hoursLeft.toFixed(1)}h</div>
        </div>
      </div>

      {/* Progress Bar */}
      {estimated > 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Progress</span>
            <span className="progress-percentage">{percentage}%</span>
          </div>
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ${percentage > 100 ? 'complete' : ''}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Log Time Form */}
      {showForm && (
        <form onSubmit={handleLogTime} className="time-log-form">
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              max="480"
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="form-input"
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="form-btn form-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="form-btn form-btn-submit"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              Log Time
            </button>
          </div>
        </form>
      )}

      {/* Time Entries List */}
      <div className="time-entries">
        <button
          onClick={handleShowEntries}
          className="time-entries-header"
        >
          <ChevronDown size={16} style={{ transform: showEntries ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          <span>Time Entries ({timeEntries.length})</span>
        </button>

        {showEntries && timeEntries.length > 0 && (
          <div>
            {timeEntries.map((entry) => (
              <div key={entry.id} className="time-entry-item">
                <div className="time-entry-info">
                  <div className="time-entry-duration">
                    {(entry.duration_minutes / 60).toFixed(1)}h
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.825rem', color: '#94a3b8' }}>
                      by {entry.user?.full_name || 'Unknown'}
                    </span>
                  </div>
                  {entry.description && (
                    <div className="time-entry-description">{entry.description}</div>
                  )}
                  <div className="time-entry-description" style={{ marginTop: '0.5rem' }}>
                    {new Date(entry.logged_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="time-entry-delete"
                  title="Delete entry"
                  onClick={() => console.log('Delete entry')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showEntries && timeEntries.length === 0 && (
          <div className="empty-state">
            No time entries yet. Click the + button to add one.
          </div>
        )}
      </div>
    </div>
  );
}

export default TimeTracker;
