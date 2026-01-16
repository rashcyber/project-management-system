/**
 * Offline Cache Manager
 * Handles caching and retrieval of data for offline access
 */

const CACHE_KEYS = {
  PROJECTS: 'offline_cache_projects',
  TASKS: 'offline_cache_tasks',
  USER_PROFILE: 'offline_cache_profile',
  ACTIVITIES: 'offline_cache_activities',
  TEAM_MEMBERS: 'offline_cache_team_members',
};

/**
 * Cache data to localStorage
 * @param {string} key - Cache key from CACHE_KEYS
 * @param {any} data - Data to cache
 */
export const cacheData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Failed to cache ${key}:`, error);
  }
};

/**
 * Get cached data from localStorage
 * @param {string} key - Cache key from CACHE_KEYS
 * @returns {any|null} Cached data or null if not found
 */
export const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    return {
      data,
      timestamp,
      isCached: true,
    };
  } catch (error) {
    console.error(`Failed to retrieve ${key} from cache:`, error);
    return null;
  }
};

/**
 * Clear specific cache
 * @param {string} key - Cache key to clear
 */
export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear ${key}:`, error);
  }
};

/**
 * Clear all offline caches
 */
export const clearAllCaches = () => {
  Object.values(CACHE_KEYS).forEach(key => clearCache(key));
};

/**
 * Get cache status
 * @returns {object} Object with cache info for each key
 */
export const getCacheStatus = () => {
  const status = {};
  Object.entries(CACHE_KEYS).forEach(([name, key]) => {
    const cached = getCachedData(key);
    status[name] = {
      cached: !!cached,
      timestamp: cached?.timestamp || null,
    };
  });
  return status;
};

export { CACHE_KEYS };

export default {
  CACHE_KEYS,
  cacheData,
  getCachedData,
  clearCache,
  clearAllCaches,
  getCacheStatus,
};
