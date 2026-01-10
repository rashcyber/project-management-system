# Integration Points for 3 Features

## Where to Add Each Component in Your App

### 1️⃣ TimeTracker Component

**Location**: Task detail view (modal or page)

**Find This File**:
- `src/pages/ProjectBoard.jsx` - If it has task detail modal
- OR Create task detail modal if it doesn't exist

**Add This Code**:

```jsx
import TimeTracker from '../components/TimeTracker';

export function TaskDetailModal({ task, isOpen, onClose }) {
  return (
    <div className="modal">
      {/* Existing task title, description, etc */}
      <h2>{task.title}</h2>
      <p>{task.description}</p>

      {/* Add this section for time tracking */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <TimeTracker
          taskId={task.id}
          currentTask={task}
        />
      </div>

      {/* Existing buttons */}
    </div>
  );
}
```

**What It Needs**:
- `taskId` (string/UUID) - The task ID
- `currentTask` (object) - Current task object with `actual_hours`, `estimated_hours`

**When to Show**: Always visible in task detail view
**Mobile**: Responsive - works on all sizes

---

### 2️⃣ EmailNotificationSettings Component

**Location**: Settings page

**Find This File**:
- `src/pages/Settings.jsx`

**Add This Code**:

```jsx
import EmailNotificationSettings from '../components/EmailNotificationSettings';

export function SettingsPage() {
  return (
    <div className="settings-container">
      {/* Existing settings sections */}

      <div className="mt-8">
        {/* Add this for email notifications */}
        <EmailNotificationSettings />
      </div>

      {/* Rest of settings */}
    </div>
  );
}
```

**What It Needs**: Nothing! It's completely self-contained
- Gets user preferences automatically
- Saves to database automatically
- Handles all errors internally

**When to Show**: In Settings page, after existing notification settings
**Mobile**: Fully responsive
**Permissions**: Requires user to be logged in

---

### 3️⃣ RecurrenceSettings Component

**Location**: Task creation modal (2 places)

#### Place 1: Task Creation Modal

**Find This File**:
- `src/components/TaskCreationModal.jsx` OR
- `src/pages/ProjectNew.jsx` OR
- Inside `ProjectBoard.jsx` where new tasks are created

**Add This Code**:

```jsx
import RecurrenceSettings from '../components/RecurrenceSettings';
import { useState } from 'react';

export function TaskCreationModal() {
  // Existing state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Add recurrence state
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState(null);

  const handleCreateTask = async () => {
    const taskData = {
      title,
      description,
      project_id: projectId,
      // ... other fields
    };

    if (recurrencePattern) {
      // Create recurring task
      const result = await useTaskStore
        .getState()
        .createRecurringTask(taskData, recurrencePattern);
    } else {
      // Create normal task
      const result = await useTaskStore
        .getState()
        .createTask(taskData);
    }
  };

  return (
    <div className="modal">
      {/* Existing form fields */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />

      {/* Add recurrence button */}
      <div className="mt-4">
        <button
          onClick={() => setShowRecurrenceModal(true)}
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
        >
          {recurrencePattern ? '✓ Recurring' : 'Set Recurrence'}
        </button>

        {recurrencePattern && (
          <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="font-medium">Pattern Set:</p>
            <p>{recurrencePattern.frequency}</p>
          </div>
        )}
      </div>

      {/* Add RecurrenceSettings modal */}
      <RecurrenceSettings
        isOpen={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        onSave={(pattern) => {
          setRecurrencePattern(pattern);
          setShowRecurrenceModal(false);
        }}
        initialPattern={recurrencePattern}
      />

      {/* Existing buttons */}
      <button onClick={handleCreateTask}>
        Create {recurrencePattern ? 'Recurring ' : ''}Task
      </button>
    </div>
  );
}
```

#### Place 2: Task Edit Modal

**Find This File**: Same location as creation modal
- When editing an existing task

**Add This Code**:

```jsx
// Same pattern as above, but also show current recurrence pattern
<RecurrenceSettings
  isOpen={showRecurrenceModal}
  onClose={() => setShowRecurrenceModal(false)}
  onSave={async (pattern) => {
    // If updating existing recurring task
    if (task.recurrence_pattern) {
      await useTaskStore
        .getState()
        .updateRecurrencePattern(task.id, pattern);
    }
    setRecurrencePattern(pattern);
    setShowRecurrenceModal(false);
  }}
  initialPattern={task.recurrence_pattern || recurrencePattern}
/>
```

**What It Needs**:
- `isOpen` (boolean) - Show/hide modal
- `onClose` (function) - Close modal handler
- `onSave` (function) - Save pattern handler
- `initialPattern` (object) - Initial pattern to edit (optional)

**When to Show**:
- In task creation form
- In task edit form (if editing recurring task)

**Mobile**: Modal responsive, adapts to screen size

---

## Component Props Reference

### TimeTracker Props

```typescript
interface TimeTrackerProps {
  taskId: string;        // UUID of the task
  currentTask: {         // Task object from store
    id: string;
    title: string;
    actual_hours?: number;
    estimated_hours?: number;
  };
}
```

### EmailNotificationSettings Props

```typescript
interface EmailNotificationSettingsProps {
  // No props needed! Self-contained component
  // Automatically fetches user preferences
  // Automatically saves to database
}
```

### RecurrenceSettings Props

```typescript
interface RecurrenceSettingsProps {
  isOpen: boolean;                    // Show modal
  onClose: () => void;                // Close handler
  onSave: (pattern: RecurrencePattern) => void;  // Save handler
  initialPattern?: RecurrencePattern;  // Edit mode
}

interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;           // default 1
  days?: number[];            // [0-6] for weekly
  day_of_month?: number;      // 1-31 for monthly
  end_date?: string;          // YYYY-MM-DD
}
```

---

## Import Statements (Copy-Paste Ready)

### For TimeTracker
```jsx
import TimeTracker from '../components/TimeTracker';
```

### For EmailNotificationSettings
```jsx
import EmailNotificationSettings from '../components/EmailNotificationSettings';
```

### For RecurrenceSettings
```jsx
import RecurrenceSettings from '../components/RecurrenceSettings';
```

### Store imports (if needed)
```jsx
import useTaskStore from '../store/taskStore';
import useNotificationStore from '../store/notificationStore';
```

---

## Styling Notes

All components use **Tailwind CSS** classes. No custom CSS needed.

If you need to customize:

### TimeTracker
- Colors: Change `bg-blue-50`, `text-blue-600` to your brand colors
- Sizing: Adjust `p-4`, `w-full` for padding/width
- Icons: From `lucide-react` package (already installed)

### EmailNotificationSettings
- Same Tailwind pattern
- Colors: `blue-600`, `green-50`, `red-50`
- Layout: Uses CSS grid for options

### RecurrenceSettings
- Modal styling: Uses `fixed inset-0` for fullscreen overlay
- Colors: `blue-600`, `gray-200`
- Animation: `transition-colors` on hover

---

## Testing Each Integration

### After Adding TimeTracker

1. Go to task detail view
2. Should see "Time Tracking" section with icons
3. Click "+ Add time"
4. Enter 30 minutes
5. Click "Log Time"
6. See actual_hours increase
7. Click "Show Time Entries"
8. Should see the entry in list

### After Adding EmailNotificationSettings

1. Go to Settings page
2. Should see "Email Notifications" section
3. Toggle the switch
4. Should see "Preferences saved" message
5. Change frequency dropdown
6. Another "Preferences saved" message
7. Check/uncheck notification types
8. Refresh page - settings should persist

### After Adding RecurrenceSettings

1. Create new task form
2. Click "Set Recurrence" button
3. Modal should open
4. Change frequency to "Weekly"
5. Select Mon/Wed/Fri (should show blue)
6. Set end date 30 days out
7. Preview should update
8. Click "Save Pattern"
9. Modal closes, button shows "✓ Recurring"
10. Create task
11. Check database - should have 12 instances

---

## Common Issues & Fixes

### "Component not found" Error
**Fix**: Ensure file path is correct
```jsx
// ✅ Correct
import TimeTracker from '../components/TimeTracker';

// ❌ Wrong
import TimeTracker from './TimeTracker';  // Missing ../
```

### "useTaskStore is not defined" Error
**Fix**: Import the store
```jsx
import useTaskStore from '../store/taskStore';

// Then use it
const store = useTaskStore.getState();
await store.logTimeEntry(...);
```

### Component renders but no data shows
**Fix**: Ensure migrations ran in Supabase
1. Open Supabase SQL Editor
2. Run all 3 migration files
3. Check Database tab - verify tables exist

### "Permission denied" when saving
**Fix**: Check RLS policies
1. Go to Supabase Authentication
2. Ensure user is logged in
3. Check user ID in table
4. Verify RLS policies allow user

### Mobile styling looks wrong
**Fix**: Components are responsive by default
- Use browser dev tools to test
- Check viewport meta tag in HTML
- Tailwind breakpoints: sm, md, lg, xl

---

## File Organization

```
src/
├── components/
│   ├── TimeTracker.jsx              ← NEW
│   ├── RecurrenceSettings.jsx       ← NEW
│   ├── EmailNotificationSettings.jsx ← NEW
│   └── [existing components]
├── pages/
│   ├── ProjectBoard.jsx             ← ADD TimeTracker here
│   ├── Settings.jsx                 ← ADD EmailNotificationSettings here
│   └── [other pages]
├── store/
│   ├── taskStore.js                 ← UPDATED (new functions)
│   ├── notificationStore.js         ← UPDATED (new functions)
│   └── [other stores]
└── [other directories]
```

---

## Quick Integration Checklist

- [ ] TimeTracker imported in task detail view
- [ ] TimeTracker component renders with correct props
- [ ] TimeTracker time entries display correctly
- [ ] EmailNotificationSettings imported in Settings page
- [ ] EmailNotificationSettings component renders
- [ ] Email preferences save when changed
- [ ] Settings persist after page refresh
- [ ] RecurrenceSettings imported in task creation
- [ ] RecurrenceSettings modal opens/closes
- [ ] Recurrence pattern saves with new tasks
- [ ] Recurring instances generate correctly
- [ ] All three features tested on mobile
- [ ] No console errors in dev tools

---

## Ready to Integrate?

1. ✅ Database migrations run? Check Supabase
2. ✅ Components copied to src/components/? Verify files exist
3. ✅ Stores updated? Check taskStore.js and notificationStore.js
4. ✅ Ready to add imports? Follow section above
5. ✅ Need help? Check IMPLEMENTATION_GUIDE_3_FEATURES.md

**Estimated time to integrate all 3**: 15-20 minutes

Good luck! 🚀
