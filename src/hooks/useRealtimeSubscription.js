import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for subscribing to real-time changes on a Supabase table
 * @param {string} table - The table name to subscribe to
 * @param {string} filterColumn - The column to filter by (optional)
 * @param {string} filterValue - The value to filter by (optional)
 * @param {function} onInsert - Callback when a new row is inserted
 * @param {function} onUpdate - Callback when a row is updated
 * @param {function} onDelete - Callback when a row is deleted
 * @param {boolean} enabled - Whether the subscription is enabled
 */
export const useRealtimeSubscription = ({
  table,
  filterColumn,
  filterValue,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}) => {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !table) return;

    const channelName = filterValue
      ? `${table}-${filterColumn}-${filterValue}`
      : `${table}-all`;

    const config = {
      event: '*',
      schema: 'public',
      table,
    };

    if (filterColumn && filterValue) {
      config.filter = `${filterColumn}=eq.${filterValue}`;
    }

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', config, (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            onInsert?.(payload.new);
            break;
          case 'UPDATE':
            onUpdate?.(payload.new, payload.old);
            break;
          case 'DELETE':
            onDelete?.(payload.old);
            break;
          default:
            break;
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, filterColumn, filterValue, onInsert, onUpdate, onDelete, enabled]);

  return channelRef.current;
};

/**
 * Hook for subscribing to task changes in a project
 */
export const useRealtimeTasks = (projectId, { onInsert, onUpdate, onDelete }) => {
  return useRealtimeSubscription({
    table: 'tasks',
    filterColumn: 'project_id',
    filterValue: projectId,
    onInsert,
    onUpdate,
    onDelete,
    enabled: !!projectId,
  });
};

/**
 * Hook for subscribing to project member changes
 */
export const useRealtimeMembers = (projectId, { onInsert, onUpdate, onDelete }) => {
  return useRealtimeSubscription({
    table: 'project_members',
    filterColumn: 'project_id',
    filterValue: projectId,
    onInsert,
    onUpdate,
    onDelete,
    enabled: !!projectId,
  });
};

/**
 * Hook for subscribing to comment changes on a task
 */
export const useRealtimeComments = (taskId, { onInsert, onUpdate, onDelete }) => {
  return useRealtimeSubscription({
    table: 'comments',
    filterColumn: 'task_id',
    filterValue: taskId,
    onInsert,
    onUpdate,
    onDelete,
    enabled: !!taskId,
  });
};

export default useRealtimeSubscription;
