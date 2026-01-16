import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';
import useOfflineStore from '../store/offlineStore';
import './OfflineIndicator.css';

const OfflineIndicator = () => {
  const { isOnline, syncInProgress, pendingActions, error } = useOfflineStore();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Show notification when connection changes
    if (!isOnline) {
      setShowNotification(true);
    } else if (isOnline && pendingActions.length > 0) {
      // Show syncing notification when coming back online
      setShowNotification(true);
    }
  }, [isOnline, pendingActions.length]);

  // Don't show indicator if online and no pending actions
  if (isOnline && pendingActions.length === 0 && !error) {
    return null;
  }

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      <div className="offline-indicator-content">
        <div className="offline-indicator-icon">
          {isOnline ? (
            syncInProgress ? (
              <Loader size={16} className="spinner" />
            ) : (
              <Wifi size={16} />
            )
          ) : (
            <WifiOff size={16} />
          )}
        </div>

        <div className="offline-indicator-text">
          {!isOnline && (
            <span>
              Offline • {pendingActions.length} pending action{pendingActions.length !== 1 ? 's' : ''}
            </span>
          )}

          {isOnline && syncInProgress && (
            <span>Syncing pending changes...</span>
          )}

          {isOnline && !syncInProgress && pendingActions.length > 0 && (
            <span>Changes synced successfully</span>
          )}

          {error && (
            <span className="error">
              Sync error: {error}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar for pending actions */}
      {!isOnline && pendingActions.length > 0 && (
        <div className="offline-indicator-progress">
          <div
            className="progress-bar"
            style={{
              width: `${Math.min(((pendingActions.length || 0) / 10) * 100, 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
