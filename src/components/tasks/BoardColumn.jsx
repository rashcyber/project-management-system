import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import './BoardColumn.css';

const BoardColumn = React.memo(({ id, title, color, count, children, onAddTask, showCheckbox, selectedTasks, onToggleSelect }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const allTaskIds = React.Children.toArray(children)
    .filter(child => child?.props?.task)
    .map(child => child.props.task.id);

  const allSelected = allTaskIds.length > 0 && allTaskIds.every(taskId => selectedTasks.includes(taskId));

  return (
    <div
      ref={setNodeRef}
      className={`board-column ${isOver ? 'is-over' : ''}`}
    >
      <div className="column-header">
        <div className="column-title">
          {showCheckbox && allTaskIds.length > 0 && (
            <label className="column-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  const unselected = allTaskIds.filter(id => !selectedTasks.includes(id));
                  if (unselected.length > 0) {
                    onToggleSelect(unselected);
                  } else {
                    onToggleSelect(allTaskIds);
                  }
                }}
              />
            </label>
          )}
          <span className="column-dot" style={{ backgroundColor: color }} />
          <h3>{title}</h3>
          <span className="column-count">{count}</span>
        </div>
        <button className="column-add-btn" onClick={onAddTask}>
          <Plus size={16} />
        </button>
      </div>
      <div className="column-content">
        {children}
        {count === 0 && (
          <div className="column-empty">
            <p>No tasks</p>
            <button onClick={onAddTask}>
              <Plus size={14} />
              Add task
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

BoardColumn.displayName = 'BoardColumn';

export default BoardColumn;
