# Quick Start: 3 Features Implementation

## TL;DR - What's Ready

### ✅ All Components Created & Ready to Use

**Time Tracking** (`TimeTracker.jsx`)
- Log time entries to tasks
- View estimated vs actual hours
- Track progress with visual bar
- See all time entries per task

**Email Notifications** (`EmailNotificationSettings.jsx`)
- Global enable/disable toggle
- Set digest frequency (real-time, daily, weekly)
- Choose which event types trigger emails
- View email history (logs)

**Recurring Tasks** (`RecurrenceSettings.jsx`)
- Set frequency (daily, weekly, monthly, yearly)
- Choose days/dates for recurrence
- Set end date
- Preview pattern in plain English

---

## Quick Integration (5 minutes)

### 1. Add TimeTracker to Task Details

```jsx
import TimeTracker from '../components/TimeTracker';

// In your task detail modal/page component
function TaskDetail({ task }) {
  return (
    <div>
      {/* existing task info */}
      <TimeTracker taskId={task.id} currentTask={task} />
    </div>
  );
}
```

### 2. Add Email Settings to Settings Page

```jsx
import EmailNotificationSettings from '../components/EmailNotificationSettings';

// In Settings.jsx
function Settings() {
  return (
    <div>
      {/* existing settings */}
      <EmailNotificationSettings />
    </div>
  );
}
```

### 3. Add Recurrence to Task Creation

```jsx
import RecurrenceSettings from '../components/RecurrenceSettings';
import { useState } from 'react';

function TaskCreation() {
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState(null);

  const handleCreateRecurringTask = async () => {
    const result = await useTaskStore
      .getState()
      .createRecurringTask(taskData, recurrencePattern);
  };

  return (
    <div>
      {/* existing form fields */}

      <button onClick={() => setShowRecurrence(true)}>
        Set Recurrence Pattern
      </button>

      <RecurrenceSettings
        isOpen={showRecurrence}
        onClose={() => setShowRecurrence(false)}
        onSave={(pattern) => {
          setRecurrencePattern(pattern);
          setShowRecurrence(false);
        }}
      />

      <button onClick={handleCreateRecurringTask}>
        Create Task
      </button>
    </div>
  );
}
```

---

## Database Setup (Required First!)

Run these SQL migrations in Supabase SQL Editor (top menu):

### Migration 1: Time Tracking
```
File: migrations/add-time-tracking.sql
Location: Query 1
```

### Migration 2: Recurring Tasks
```
File: migrations/add-recurring-tasks.sql
Location: Query 2
```

### Migration 3: Email Notifications
```
File: migrations/add-email-notifications.sql
Location: Query 3
```

**All three MUST run before features work!**

---

## API/Store Methods Reference

### Time Tracking Store

```javascript
import useTaskStore from '../store/taskStore';

const store = useTaskStore.getState();

// Log a time entry
await store.logTimeEntry(taskId, durationInMinutes, description);

// Get time entries for task
const entries = await store.fetchTimeEntries(taskId);

// Set estimated hours
await store.updateTimeEstimate(taskId, estimatedHours);
```

### Recurring Tasks Store

```javascript
import useTaskStore from '../store/taskStore';

const store = useTaskStore.getState();

// Create recurring task
await store.createRecurringTask(taskData, {
  frequency: 'weekly',     // daily, weekly, monthly, yearly
  interval: 1,             // every N intervals
  days: [1, 3, 5],         // for weekly: 0-6 (Sun-Sat)
  day_of_month: 15,        // for monthly: 1-31
  end_date: '2026-12-31'   // optional: when to stop
});

// Generate instances
await store.generateRecurringInstances(taskId, pattern);

// Update pattern
await store.updateRecurrencePattern(taskId, newPattern);

// Stop creating new instances
await store.stopRecurringTask(taskId);
```

### Email Notifications Store

```javascript
import useNotificationStore from '../store/notificationStore';

const store = useNotificationStore.getState();

// Get preferences
const prefs = await store.fetchEmailPreferences();

// Update all preferences
await store.updateEmailPreferences({
  email_notifications_enabled: true,
  email_digest_frequency: 'daily',
  email_notification_types: {
    task_assigned: true,
    task_completed: true,
    task_mentioned: true,
    project_created: true,
    comment_mentioned: true
  }
});

// Toggle on/off
await store.toggleEmailNotifications();

// Set frequency
await store.updateEmailDigestFrequency('daily');

// Set which types trigger emails
await store.updateEmailNotificationTypes({
  task_assigned: true,
  task_mentioned: false
});

// View email history
const logs = await store.fetchEmailLogs();
```

---

## Test Scenarios

### ✅ Test Time Tracking

1. Create a task
2. Click "Add Time" (+ button)
3. Enter 30 minutes + description
4. See `actual_hours` increase
5. See progress bar update
6. Click "Show Time Entries" to see all

### ✅ Test Email Notifications

1. Go to Settings → Email Notifications
2. Toggle on/off
3. Change frequency to different options
4. Check/uncheck notification types
5. Should see "Preferences saved" message
6. Refresh page - settings persist

### ✅ Test Recurring Tasks

1. Create new task
2. Click "Set Recurrence Pattern"
3. Select weekly, every Mon/Wed/Fri
4. Set end date 30 days from now
5. Click "Create Task"
6. Check `is_recurring_instance` in database
7. Should see 12 generated instances (4 weeks × 3 days)

---

## What's NOT Included (For Later)

These require backend/server implementation:

1. **Email Sending** - Need to implement:
   - Edge Function to send emails via SendGrid/Resend
   - Cron job to process `email_queue` table
   - Error handling & retries

2. **Recurring Task Auto-Generation** - Need to implement:
   - Cron job to run daily/hourly
   - Check for recurring tasks needing new instances
   - Generate instances 30-90 days ahead

3. **Analytics Dashboard Updates** - Could add:
   - Time distribution charts
   - Over/under estimate metrics
   - Recurring task burndown

---

## Files Modified

### New Files Created
```
src/components/TimeTracker.jsx
src/components/RecurrenceSettings.jsx
src/components/EmailNotificationSettings.jsx
migrations/add-time-tracking.sql
migrations/add-recurring-tasks.sql
migrations/add-email-notifications.sql
```

### Existing Files Updated
```
src/store/taskStore.js (+ 60 lines, 8 new functions)
src/store/notificationStore.js (+ 140 lines, 7 new functions)
```

### Documentation Created
```
IMPLEMENTATION_GUIDE_3_FEATURES.md
QUICK_START_3_FEATURES.md
```

---

## Troubleshooting

**Components not rendering?**
- Check all imports are correct
- Verify component files exist in `src/components/`
- Check console for errors

**Store functions not working?**
- Run the three migration SQL files first!
- Check user is logged in
- Verify Supabase client is configured

**Styles look wrong?**
- Make sure Tailwind CSS is installed (`npm install`)
- Components use Tailwind utility classes
- Can customize by editing component files

**Data not persisting?**
- Check RLS policies in migrations
- Verify user has permission to INSERT/UPDATE
- Check Supabase database in web UI

---

## Next Steps

1. **Deploy to Supabase**
   - Run the 3 SQL migration files
   - Verify tables created in Database tab

2. **Add Components to App**
   - Import components in your pages
   - Test each feature with UI

3. **Backend Services** (when ready)
   - Create Edge Function for email
   - Create Cron for recurring generation
   - Set up email provider account

4. **Polish & Customize**
   - Adjust Tailwind styles as needed
   - Add analytics views
   - Create help/tutorial pages

---

## Support

For detailed info, see `IMPLEMENTATION_GUIDE_3_FEATURES.md`

For questions about specific components, check the JSDoc comments in each file.

Happy coding! 🚀
