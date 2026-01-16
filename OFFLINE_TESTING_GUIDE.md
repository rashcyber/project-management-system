# Offline Feature Testing Guide

## Overview
This guide explains how to test the complete offline functionality of the Task Management App on mobile and desktop.

---

## Architecture

### What Happens Offline:
1. **Read Operations** - Use cached data
2. **Write Operations** - Queue actions to localStorage
3. **OfflineIndicator** - Shows status to user
4. **Sync** - Automatic sync when back online with retry logic

### Cache System:
- Projects, tasks, user profile, and activities are cached
- Cache persists across browser sessions
- Cache is cleared on logout

---

## Testing on Mobile

### Setup:
1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open on mobile:**
   - Use Chrome DevTools to simulate mobile (F12 → Toggle Device Toolbar)
   - Or use actual mobile phone on same network (e.g., `http://192.168.x.x:5173`)

3. **Login** with a test account

---

## Test Scenario 1: Read While Offline

### Steps:
1. **Online:** Navigate to Projects page - projects load and cache
2. **Go Offline:**
   - Desktop: F12 → Network tab → Set to "Offline"
   - Mobile: Phone → Settings → Airplane Mode ON
   - Or: Browser DevTools → Network tab → Offline
3. **Offline Indicator** appears showing "Offline • Viewing cached data"
4. **Navigate** back to Projects
5. **Result:** ✅ Should see cached projects without internet

### Expected Behavior:
```
Before: Projects loading with network request
After:  Projects visible from cache
UI:     Yellow offline indicator showing cached data is being used
```

---

## Test Scenario 2: Write While Offline

### Steps:
1. **Online:** Navigate to a project board
2. **Go Offline** (use method above)
3. **Try to create/edit a task:**
   - Click "Add Task" button
   - Fill in task details
   - Try to save
4. **Offline Indicator** shows "Offline • 1 pending change"
5. **Result:** ✅ Task is queued, not lost

### Expected Behavior:
```
1. User creates task while offline
2. System queues the action to localStorage
3. Offline indicator shows pending count
4. User sees visual feedback that change is queued
5. Data not sent to Supabase (would fail)
```

---

## Test Scenario 3: Sync When Back Online

### Steps:
1. **While Offline:** Create multiple tasks (1-3 actions)
2. **Offline Indicator** shows "Offline • 3 pending changes"
3. **Go Back Online:**
   - Desktop: F12 → Network → Change from "Offline" to "No throttling"
   - Mobile: Settings → Airplane Mode OFF
4. **Watch Offline Indicator** change to "Syncing your changes..."
5. **Wait 2-3 seconds**
6. **Result:** ✅ Indicator shows green "Changes synced successfully"

### Expected Behavior:
```
Offline:       "Offline • 3 pending changes"
             ↓
Going Online:  Network comes back
             ↓
Auto-Detect:   System detects connection
             ↓
Sync:          "Syncing your changes..." (yellow spinner)
             ↓
Complete:      "Changes synced successfully" (green)
             ↓
Clear:         Pending actions removed from queue
```

---

## Test Scenario 4: Multiple Tabs Sync

### Steps:
1. **Open App in 2 browser tabs/windows**
2. **Tab 1:** Go offline, create a task
3. **Tab 1 Indicator:** Shows "Offline • 1 pending change"
4. **Tab 2:** Still online, should see task in real-time (if via DB) OR after refresh
5. **Tab 1:** Go back online
6. **Tab 1:** Syncs successfully
7. **Tab 2:** Auto-updates or refreshes to show synced data

### Expected Behavior:
```
Each tab has independent offline state tracking
Both show/hide offline indicator independently
When one syncs, data is available to both
```

---

## Test Scenario 5: Offline to Online Transitions

### Steps:
1. **Online:** Load projects
2. **Offline → Online → Offline → Online** (simulate bad connection)
3. **Each transition** should:
   - Update offline indicator smoothly
   - Queue/dequeue actions correctly
   - Retry failed syncs

### Expected Behavior:
```
Each online/offline switch:
- Updates UI indicator immediately
- Shows pending count accurately
- Retries if connection lost during sync (max 3 retries)
- Never loses queued data
```

---

## Test Scenario 6: Browser Refresh While Offline

### Steps:
1. **Online:** Create and queue a task (offline)
2. **Offline Indicator:** Shows pending change
3. **Refresh Page** (Cmd+R or Ctrl+R)
4. **App Reloads**
5. **Result:** ✅ Pending actions still visible, not lost

### Expected Behavior:
```
Before Refresh:  "Offline • 1 pending change"
             ↓
Page Refresh:    Browser reload
             ↓
After Refresh:   "Offline • 1 pending change" (still there!)
Why:             Data persisted in localStorage
```

---

## Test Scenario 7: Error Handling

### Steps:
1. **Offline:** Create many tasks (>10)
2. **Go Online:** Start syncing
3. **Intentionally fail network** mid-sync
4. **Result:** ✅ Shows error, retries automatically (max 3x)

### Expected Behavior:
```
Sync starts         "Syncing your changes..."
Network error       "Sync error: connection failed"
Auto-retry 1/3      Still attempting
Auto-retry 2/3      Still attempting
Auto-retry 3/3      Final attempt
Max retries reached Remove from queue OR show persistent error
```

---

## Mobile-Specific Tests

### On Actual Mobile Phone:

1. **Home Screen:**
   - Launch app from home screen
   - Works offline ✅

2. **App Switcher:**
   - Switch apps while syncing
   - Come back, sync resumes ✅

3. **Screen Sleep:**
   - Screen locks while syncing
   - Wake phone, sync continues ✅

4. **Wi-Fi Toggle:**
   - Turn Wi-Fi off and on
   - Sync auto-triggers on reconnect ✅

5. **Notifications:**
   - Sync complete shows notification ✅
   - Error notifications appear ✅

---

## Desktop Responsive Tests

### At Different Breakpoints:

1. **Desktop (1920px)**
   - Offline indicator fits nicely
   - Doesn't overflow ✅

2. **Tablet (768px)**
   - Indicator responsive
   - Wraps text appropriately ✅

3. **Mobile (375px)**
   - Indicator still visible
   - Text readable ✅
   - No horizontal scroll ✅

---

## Console Debugging

### Enable Logging:
Open browser console (F12 → Console) to see:

```javascript
// Cache hits
[OFFLINE] Using cached projects

// Queueing
[OFFLINE] Queueing write action: create_task

// Online queries
[ONLINE] Executing query: fetchProjects

// Sync progress
Synced action: 1234567890-0.5
```

### Check Offline State:
```javascript
// In browser console:
useOfflineStore.getState().isOnline  // true/false
useOfflineStore.getState().getPendingActions()  // array of queued actions
localStorage.getItem('offline-storage')  // view persisted state
```

---

## Verification Checklist

### ✅ Must Pass:

- [ ] Read cached data while offline
- [ ] Queue writes while offline
- [ ] Auto-sync when back online
- [ ] Retry failed syncs (max 3x)
- [ ] Persist data across browser refresh
- [ ] Show offline indicator with pending count
- [ ] Show sync progress animation
- [ ] Clear pending actions after successful sync
- [ ] Mobile UI responsive at all breakpoints
- [ ] No data loss during offline/online transitions

### ⚠️ Nice to Have:

- [ ] Offline notification on mobile
- [ ] Sound/vibration on sync complete
- [ ] Conflict resolution for concurrent edits
- [ ] Selective sync (sync only certain action types)
- [ ] Manual "Retry Sync" button

---

## Troubleshooting

### Cached Data Not Showing:
```javascript
// Check cache
localStorage.getItem('offline_cache_projects')

// If empty, user hasn't been online yet
// Solution: Load projects while online first
```

### Sync Not Triggering:
```javascript
// Check offline store
useOfflineStore.getState().syncInProgress  // Should be false
useOfflineStore.getState().isOnline  // Should be true

// Check pending actions
useOfflineStore.getState().pendingActions.length  // Count of queued
```

### Actions Stuck in Queue:
```javascript
// Manually trigger sync
const { syncPendingActions } = require('./lib/offline');
syncPendingActions();

// Or clear queue (⚠️ data loss!)
useOfflineStore.getState().clearPendingActions();
```

---

## Performance Notes

- **Cache Size:** Typically < 500KB for most projects/tasks
- **Sync Speed:** Should complete in 1-5 seconds (depends on queue size)
- **Memory:** Minimal overhead, data stored in localStorage
- **Battery:** Offline mode uses less battery (no network requests)

---

## Success Criteria

✅ **Offline testing passed when:**
1. Users can view their projects/tasks while offline
2. Users can queue actions while offline (create/edit tasks)
3. All queued actions sync successfully when back online
4. Offline indicator clearly shows status
5. No data is lost during offline/online transitions
6. Mobile UI is responsive and usable
7. System retries failed syncs automatically

---

## Next Steps

After testing:
1. Create bug reports for any issues
2. Note edge cases to handle
3. Implement manual sync button (optional)
4. Add notification preferences (optional)
5. Performance optimization if needed

