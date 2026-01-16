/**
 * Offline-Aware Supabase Wrapper
 * Intercepts Supabase calls and handles offline scenarios
 */

import useOfflineStore from '../store/offlineStore';
import { getCachedData, cacheData, CACHE_KEYS } from './offlineCache';

/**
 * Wraps a Supabase query with offline support
 * When offline: returns cached data if available, queues the action
 * When online: executes query and caches result
 *
 * @param {object} options
 * @param {string} options.cacheKey - Which cache to use (from CACHE_KEYS)
 * @param {function} options.query - Async function that executes the Supabase query
 * @param {string} options.actionType - Type of action for queueing (e.g., 'fetch_projects')
 * @param {any} options.payload - Data to queue if offline
 * @param {boolean} options.isWrite - Whether this is a write operation (not read)
 * @returns {Promise<{data, error, fromCache}>}
 */
export const executeOfflineQuery = async ({
  cacheKey,
  query,
  actionType,
  payload = null,
  isWrite = false,
}) => {
  const offlineStore = useOfflineStore.getState();
  const isOnline = offlineStore.isOnline;

  // Try to execute query
  try {
    if (!isOnline) {
      // OFFLINE MODE
      if (isWrite) {
        // Write operation: queue it and return cached data if available
        console.log(`[OFFLINE] Queueing write action: ${actionType}`);
        offlineStore.queueAction(actionType, payload);

        // Try to return cached data for the user
        const cached = getCachedData(cacheKey);
        if (cached) {
          return {
            data: cached.data,
            error: null,
            fromCache: true,
            queued: true,
          };
        }

        return {
          data: null,
          error: new Error(`Offline: Changes will sync when you're back online`),
          fromCache: false,
          queued: true,
        };
      } else {
        // Read operation: return cached data or error
        console.log(`[OFFLINE] Reading from cache: ${cacheKey}`);
        const cached = getCachedData(cacheKey);

        if (cached) {
          return {
            data: cached.data,
            error: null,
            fromCache: true,
          };
        }

        return {
          data: null,
          error: new Error('No cached data available offline'),
          fromCache: false,
        };
      }
    }

    // ONLINE MODE: Execute query and cache result
    console.log(`[ONLINE] Executing query: ${actionType}`);
    const { data, error } = await query();

    // Cache successful data
    if (!error && data && cacheKey) {
      cacheData(cacheKey, data);
      console.log(`[CACHE] Cached ${cacheKey}`);
    }

    return {
      data,
      error,
      fromCache: false,
    };
  } catch (error) {
    console.error(`Query execution failed: ${actionType}`, error);

    // Fallback to cache on error
    if (!isWrite) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log(`[FALLBACK] Using cached data after error: ${cacheKey}`);
        return {
          data: cached.data,
          error: null,
          fromCache: true,
        };
      }
    }

    return {
      data: null,
      error,
      fromCache: false,
    };
  }
};

/**
 * Check if a resource is available (cached or online)
 * Useful for determining UI state
 *
 * @param {string} cacheKey - Cache key to check
 * @returns {boolean} True if data is available (cached or online)
 */
export const isResourceAvailable = (cacheKey) => {
  const offlineStore = useOfflineStore.getState();

  if (offlineStore.isOnline) {
    return true; // Online, assume available
  }

  const cached = getCachedData(cacheKey);
  return !!cached;
};

/**
 * Get resource with offline fallback
 * @param {string} cacheKey - Cache key
 * @returns {any|null} Cached data or null
 */
export const getOfflineResource = (cacheKey) => {
  const cached = getCachedData(cacheKey);
  return cached?.data || null;
};

/**
 * Show user-friendly message about offline state
 * @returns {string|null} Message to show user, or null if online
 */
export const getOfflineMessage = () => {
  const offlineStore = useOfflineStore.getState();

  if (!offlineStore.isOnline) {
    const pendingCount = offlineStore.pendingActions.length;
    if (pendingCount > 0) {
      return `Offline • ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} • Changes will sync when online`;
    }
    return 'Offline • Viewing cached data';
  }

  if (offlineStore.syncInProgress) {
    return 'Syncing your changes...';
  }

  if (offlineStore.pendingActions.length > 0) {
    return `Syncing ${offlineStore.pendingActions.length} pending change${offlineStore.pendingActions.length !== 1 ? 's' : ''}...`;
  }

  return null;
};

export default {
  executeOfflineQuery,
  isResourceAvailable,
  getOfflineResource,
  getOfflineMessage,
};
