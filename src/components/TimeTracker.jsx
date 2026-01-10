import React, { useState } from 'react';
import { Clock, Plus, Trash2, Loader } from 'lucide-react';
import useTaskStore from '../store/taskStore';

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">Time Tracking</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Plus size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Time Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 font-medium">Estimated</div>
          <div className="text-lg font-bold text-blue-600">{estimated.toFixed(1)}h</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 font-medium">Actual</div>
          <div className="text-lg font-bold text-green-600">{hours.toFixed(1)}h</div>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 font-medium">Remaining</div>
          <div className="text-lg font-bold text-orange-600">{hoursLeft.toFixed(1)}h</div>
        </div>
      </div>

      {/* Progress Bar */}
      {estimated > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-gray-600">{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                percentage <= 100 ? 'bg-blue-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Log Time Form */}
      {showForm && (
        <form onSubmit={handleLogTime} className="space-y-3 p-3 bg-gray-50 rounded-lg mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min="1"
              max="480"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              Log Time
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Time Entries List */}
      <button
        onClick={handleShowEntries}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showEntries ? 'Hide' : 'Show'} Time Entries ({timeEntries.length})
      </button>

      {showEntries && timeEntries.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          {timeEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">
                    {(entry.duration_minutes / 60).toFixed(1)}h
                  </span>
                  <span className="text-xs text-gray-600">
                    by {entry.user?.full_name || 'Unknown'}
                  </span>
                </div>
                {entry.description && (
                  <p className="text-sm text-gray-600">{entry.description}</p>
                )}
                <div className="text-xs text-gray-500">
                  {new Date(entry.logged_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                title="Delete entry"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEntries && timeEntries.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">No time entries yet</p>
      )}
    </div>
  );
}

export default TimeTracker;
