# Implementation Guide: 3 Top Priority Features

## Overview
This guide details the implementation of the 3 highest-priority features for the task management app:
1. **Time Tracking & Estimates**
2. **Email Notifications**
3. **Recurring Tasks**

---

## Feature 1: Time Tracking & Estimates

### ✅ What's Been Done

#### Database
- **Migration file**: `migrations/add-time-tracking.sql`
- Added columns to `tasks` table:
  - `estimated_hours` (DECIMAL): Hours expected to complete task
  - `actual_hours` (DECIMAL): Total time spent on task
  - `time_entries` (JSONB): Denormalized array for quick access
- Created `time_entries` table with:
  - `task_id`, `user_id`, `duration_minutes`, `description`
  - Full RLS policies for data security
  - Indexes for performance

#### Backend (Zustand Store)
Location: `src/store/taskStore.js`

Functions added:
- `logTimeEntry(taskId, durationMinutes, description)` - Log a time entry
- `fetchTimeEntries(taskId)` - Get all time entries for a task
- `updateTimeEstimate(taskId, estimatedHours)` - Set estimated hours

#### Frontend Components
- **TimeTracker.jsx** - React component with:
  - Time estimate & actual hours display
  - Progress bar showing % complete
  - Quick form to log time
  - List of all time entries with filters
  - Calculate remaining hours automatically

### 🔗 Integration Points

Add TimeTracker component to task detail pages:
```jsx
import TimeTracker from '../components/TimeTracker';

// In task detail modal/page
<TimeTracker taskId={taskId} currentTask={task} />
```

Update Analytics page to display:
- Average time per task
- Tasks over/under estimate
- Team time distribution
- Time spent per project

### 📊 Usage Example

```jsx
// Log time entry
const result = await useTaskStore.getState().logTimeEntry(
  'task-123',
  120,  // 2 hours in minutes
  'Fixed critical bug'
);

// Set estimate
await useTaskStore.getState().updateTimeEstimate('task-123', 8);

// Fetch entries
const entries = await useTaskStore.getState().fetchTimeEntries('task-123');
```

---

## Feature 2: Email Notifications

### ✅ What's Been Done

#### Database
- **Migration file**: `migrations/add-email-notifications.sql`
- Added columns to `profiles` table:
  - `email_notifications_enabled` (BOOLEAN): Global on/off switch
  - `email_digest_frequency` (TEXT): real-time, daily, weekly, never
  - `email_notification_types` (JSONB): Granular control per type
- Created `email_logs` table:
  - Audit trail of emails sent
  - Status tracking (sent, failed, bounced)
- Created `email_queue` table:
  - Pending emails waiting to be sent
  - Retry logic for failed sends
  - Full RLS policies

#### Backend (Zustand Store)
Location: `src/store/notificationStore.js`

Functions added:
- `fetchEmailPreferences()` - Get user's email settings
- `updateEmailPreferences(preferences)` - Save all settings
- `toggleEmailNotifications()` - On/off switch
- `updateEmailDigestFrequency(frequency)` - Set digest timing
- `updateEmailNotificationTypes(types)` - Set which events trigger emails
- `fetchEmailLogs()` - View email history

#### Frontend Components
- **EmailNotificationSettings.jsx** - Complete settings UI with:
  - Master on/off toggle
  - Frequency selection (real-time, daily, weekly, never)
  - Per-event type checkboxes
  - Email log viewing
  - Saved state confirmation

### 🔗 Integration Points

1. **Add to Settings page**:
```jsx
import EmailNotificationSettings from '../components/EmailNotificationSettings';

// In Settings page
<EmailNotificationSettings />
```

2. **Backend Email Service** (needs to be implemented):
```jsx
// Edge Function: supabase/functions/send-email/index.ts
// or use SendGrid/Resend API

// Triggered when:
// - Task assigned
// - Task completed
// - User mentioned in comment
// - Task updated
```

3. **Email Queue Processor** (needs to be implemented):
```jsx
// Cron job to process email_queue table
// Check scheduled_for time
// Send via email provider
// Update email_logs
// Remove from queue
```

### 📧 Email Types (Configurable)

Users can enable/disable emails for:
- `task_assigned` - When assigned to a task
- `task_completed` - When task they're assigned to is completed
- `task_mentioned` - When mentioned in task
- `project_created` - New project creation
- `comment_mentioned` - Mentioned in comment

### 📋 Setup Checklist

- [ ] Run migration: `add-email-notifications.sql`
- [ ] Create Supabase Edge Function for email sending
- [ ] Set up email provider (SendGrid, Resend, or AWS SES)
- [ ] Create cron job for email queue processing
- [ ] Add EmailNotificationSettings to Settings page
- [ ] Test with different digest frequencies

---

## Feature 3: Recurring Tasks

### ✅ What's Been Done

#### Database
- **Migration file**: `migrations/add-recurring-tasks.sql`
- Added columns to `tasks` table:
  - `recurrence_pattern` (JSONB): Pattern definition
  - `recurrence_end_date` (DATE): When to stop generating
  - `original_task_id` (UUID): Reference to parent task
  - `is_recurring_instance` (BOOLEAN): Is this generated instance
- Created `recurring_task_instances` table:
  - Tracks which instances were generated from which tasks
  - Audit trail of generation

#### Backend (Zustand Store)
Location: `src/store/taskStore.js`

Helper functions:
- `shouldGenerateInstance(date, pattern, startDate)` - Determine if date matches
- `getNextDate(currentDate, pattern)` - Calculate next occurrence

Main functions:
- `createRecurringTask(taskData, recurrencePattern)` - Create recurring task
- `generateRecurringInstances(originalTaskId, recurrencePattern, upToDate)` - Generate instances
- `updateRecurrencePattern(taskId, newPattern)` - Modify recurrence
- `stopRecurringTask(taskId)` - Stop creating new instances

#### Frontend Components
- **RecurrenceSettings.jsx** - Modal UI with:
  - Frequency selector (daily, weekly, monthly, yearly)
  - Interval input (every N weeks/months/etc)
  - Day selection for weekly
  - Day-of-month for monthly
  - End date picker
  - Plain English preview of pattern

### 🔗 Integration Points

1. **Add to Task Creation**:
```jsx
import RecurrenceSettings from '../components/RecurrenceSettings';

// In task creation modal
const [showRecurrence, setShowRecurrence] = useState(false);

<button onClick={() => setShowRecurrence(true)}>
  Set Recurrence
</button>

<RecurrenceSettings
  isOpen={showRecurrence}
  onClose={() => setShowRecurrence(false)}
  onSave={async (pattern) => {
    await useTaskStore.getState().createRecurringTask(taskData, pattern);
  }}
/>
```

2. **Add to Task Details/Edit**:
```jsx
// Show current recurrence pattern
// Allow modification
// Show generated instances
```

3. **Filters** - Add to board/list views:
```jsx
// Show recurring instances grouped by original task
// Option to "Skip this instance"
// Option to "Complete all remaining instances"
```

### 📅 Recurrence Pattern Format

```javascript
{
  // Frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  frequency: 'weekly',

  // Repeat every N intervals
  interval: 1,

  // For weekly: [0=Sun, 1=Mon, ..., 6=Sat]
  days: [1, 3, 5],  // Mon, Wed, Fri

  // For monthly: day of month (1-31)
  day_of_month: 15,

  // Optional: stop generating after this date
  end_date: '2026-12-31'
}
```

### 📊 Usage Examples

```jsx
// Create a weekly recurring task (Mon, Wed, Fri)
const pattern = {
  frequency: 'weekly',
  interval: 1,
  days: [1, 3, 5],
  end_date: '2026-12-31'
};

await useTaskStore.getState().createRecurringTask(taskData, pattern);

// Create a daily task for 30 days
const dailyPattern = {
  frequency: 'daily',
  interval: 1,
  end_date: '2026-02-09'
};

await useTaskStore.getState().createRecurringTask(taskData, dailyPattern);

// Stop creating new instances (existing ones remain)
await useTaskStore.getState().stopRecurringTask('task-123');
```

### 🎯 Features to Implement

- [ ] Display recurring parent task with generated instances
- [ ] "Skip this instance" button for individual instances
- [ ] "Complete all remaining" option
- [ ] "Modify series" to change all instances
- [ ] "Delete series" to remove all instances
- [ ] Calendar view highlighting recurring dates
- [ ] Dashboard showing upcoming recurring tasks
- [ ] Notification when recurring instance is generated

---

## Implementation Checklist

### Step 1: Database Setup
- [ ] Run `migrations/add-time-tracking.sql` in Supabase SQL Editor
- [ ] Run `migrations/add-recurring-tasks.sql`
- [ ] Run `migrations/add-email-notifications.sql`
- [ ] Verify tables and columns created successfully

### Step 2: Frontend Integration

#### Time Tracking
- [ ] Import TimeTracker component where needed
- [ ] Add to task detail pages/modals
- [ ] Update Analytics page with time insights

#### Email Notifications
- [ ] Import EmailNotificationSettings component
- [ ] Add to Settings page (likely after current notification settings)
- [ ] Test toggle and preference save

#### Recurring Tasks
- [ ] Import RecurrenceSettings modal
- [ ] Add to task creation flow
- [ ] Add to task edit/detail view
- [ ] Add recurring task display in board/list views

### Step 3: Backend Services (Future)

These require server-side implementation:

**Email Queue Processor**
```typescript
// Process pending emails every minute
// Check email_queue table for scheduled_for <= now()
// Send via email provider
// Track in email_logs
```

**Recurring Task Generator**
```typescript
// Run daily/hourly
// Check all active recurring tasks
// Generate new instances if needed
// Update recurring_task_instances
```

### Step 4: Testing

- [ ] Test time tracking: log entries, verify calculations
- [ ] Test email preferences: toggle, change frequency, select types
- [ ] Test recurring tasks: create pattern, verify instances generated
- [ ] Test end dates: verify no instances after end date
- [ ] Test with multiple users
- [ ] Test mobile responsiveness

---

## File Summary

### Created Migration Files
```
migrations/add-time-tracking.sql
migrations/add-recurring-tasks.sql
migrations/add-email-notifications.sql
```

### Created Components
```
src/components/TimeTracker.jsx
src/components/RecurrenceSettings.jsx
src/components/EmailNotificationSettings.jsx
```

### Updated Store Files
```
src/store/taskStore.js (added 10+ functions)
src/store/notificationStore.js (added 7+ functions)
```

---

## Performance Considerations

### Time Tracking
- Indexes on `task_id`, `user_id`, `logged_at` for fast queries
- Denormalized `actual_hours` on tasks table for quick aggregation
- Consider archiving old entries after 6-12 months

### Recurring Tasks
- Default generation for 90 days ahead
- Can adjust `upToDate` parameter to generate further out
- Consider batch generation as background job
- GIN index on `recurrence_pattern` JSONB for efficient queries

### Email Notifications
- Queue system prevents sending during peak times
- Retry logic with exponential backoff
- Digest aggregation reduces email volume
- Consider daily cleanup of old email_logs

---

## Future Enhancements

1. **Time Tracking**
   - Time sheets and approval workflows
   - Billable hours tracking
   - Invoice generation
   - Integration with calendar app

2. **Email Notifications**
   - Email templates with branding
   - Unsubscribe functionality
   - Email signature from profile
   - Multi-language support

3. **Recurring Tasks**
   - Advanced recurrence (e.g., "every 2nd Tuesday")
   - Recurring task templates
   - Bulk operations on series
   - "Skip" vs "Delete" distinction for instances
   - Task completion cascade for series

---

## Support & Troubleshooting

**Issue: Time entries not updating actual_hours**
- Check RLS policies allow UPDATE on tasks
- Verify time_entries table has correct structure

**Issue: Email preferences not saving**
- Check profiles table has new columns
- Verify user has permission to UPDATE profiles

**Issue: Recurring instances not generating**
- Check recurrence_pattern JSONB is valid
- Verify original task exists
- Check recurring_task_instances table creation

---

## Questions & Next Steps

1. **Ready to deploy?** Run the three migration files in Supabase
2. **Want to test locally?** Use the components immediately - they handle errors gracefully
3. **Need backend services?** Email sending and recurring generation require Edge Functions
4. **Want UI customization?** All components use Tailwind classes and can be styled

For questions or issues, refer to the main codebase documentation.
