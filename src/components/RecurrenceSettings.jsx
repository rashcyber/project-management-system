import React, { useState, useEffect } from 'react';
import { Repeat2, X } from 'lucide-react';

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
    <div className="space-y-4">
          {/* Frequency */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Repeat Pattern
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Repeat every {frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years'}
              </label>
              <input
                type="number"
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Weekly Days Selection */}
          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Repeat on
              </label>
              <div className="grid grid-cols-7 gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(index)}
                    className={`py-2 px-1 rounded-lg font-medium text-sm transition-colors ${
                      days.includes(index)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Repeat on day
              </label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              End recurrence (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {endDate && (
              <p className="text-xs text-gray-500 mt-1">
                Will stop creating new recurring instances after this date
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Preview:</span> This task will repeat{' '}
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
        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save Pattern
          </button>
        </div>
    </div>
  );
}

export default RecurrenceSettings;
