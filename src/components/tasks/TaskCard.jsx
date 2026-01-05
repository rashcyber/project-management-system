import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  MessageSquare,
  CheckSquare,
  Flag,
} from 'lucide-react';
import { Avatar } from '../common';
import { format, isPast, isToday } from 'date-fns';
import './TaskCard.css';

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#f97316' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

const TaskCard = React.memo(({ task, onClick, onEdit, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const commentsCount = task.comments?.length || 0;

  const getDueDateStatus = () => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    if (task.status === 'completed') return 'completed';
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'today';
    return 'upcoming';
  };

  const dueDateStatus = getDueDateStatus();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? 'is-dragging' : ''}`}
      onClick={onClick}
    >
      {/* Priority indicator */}
      <div className="task-priority" style={{ backgroundColor: priority.color }} />

      {/* Labels */}
      {task.task_labels?.length > 0 && (
        <div className="task-labels">
          {task.task_labels.slice(0, 3).map((tl) => (
            <span
              key={tl.label.id}
              className="task-label"
              style={{ backgroundColor: tl.label.color }}
            >
              {tl.label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="task-title">{task.title}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}

      {/* Meta info */}
      <div className="task-meta">
        {/* Due date */}
        {task.due_date && (
          <div className={`task-due-date ${dueDateStatus}`}>
            <Calendar size={12} />
            <span>{format(new Date(task.due_date), 'MMM d')}</span>
          </div>
        )}

        {/* Subtasks */}
        {totalSubtasks > 0 && (
          <div className="task-subtasks">
            <CheckSquare size={12} />
            <span>{completedSubtasks}/{totalSubtasks}</span>
          </div>
        )}

        {/* Comments */}
        {commentsCount > 0 && (
          <div className="task-comments">
            <MessageSquare size={12} />
            <span>{commentsCount}</span>
          </div>
        )}

        {/* Priority flag */}
        {task.priority && task.priority !== 'medium' && (
          <div className="task-priority-flag" style={{ color: priority.color }}>
            <Flag size={12} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="task-footer">
        {task.assignees && task.assignees.length > 0 ? (
          <div className="task-assignees">
            {task.assignees.slice(0, 3).map((assignee) => (
              <Avatar
                key={assignee.id}
                src={assignee.avatar_url}
                name={assignee.full_name}
                size="small"
              />
            ))}
            {task.assignees.length > 3 && (
              <div className="more-assignees">+{task.assignees.length - 3}</div>
            )}
          </div>
        ) : (
          <div className="task-unassigned">Unassigned</div>
        )}
      </div>
    </div>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;
