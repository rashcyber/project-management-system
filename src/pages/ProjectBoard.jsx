import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { Button, Modal, Loading } from '../components/common';
import BoardColumn from '../components/tasks/BoardColumn';
import TaskCard from '../components/tasks/TaskCard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetail from '../components/tasks/TaskDetail';
import useProjectStore from '../store/projectStore';
import useTaskStore from '../store/taskStore';
import { useRealtimeTasks } from '../hooks';
import { toast } from '../store/toastStore';
import useDebounce from '../hooks/useDebounce';
import './ProjectBoard.css';

const COLUMNS = [
  { id: 'not_started', title: 'Not Started', color: '#94a3b8' },
  { id: 'in_progress', title: 'In Progress', color: '#3b82f6' },
  { id: 'review', title: 'Review', color: '#8b5cf6' },
  { id: 'completed', title: 'Completed', color: '#22c55e' },
];

const ProjectBoard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { currentProject, fetchProject, loading: projectLoading } = useProjectStore();
  const { tasks, fetchTasks, updateTask, loading: tasksLoading } = useTaskStore();

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [initialStatus, setInitialStatus] = useState('not_started');
  const [searchQuery, setSearchQuery] = useState('');
  const [localTasks, setLocalTasks] = useState([]);

  // Debounce search input for performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Sync local tasks with store tasks
  useEffect(() => {
    if (Array.isArray(tasks)) {
      setLocalTasks(tasks);
    }
  }, [tasks]);

  // Optimized sensors for smoother dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchTasks(projectId);
    }
  }, [projectId, fetchProject, fetchTasks]);

  // Real-time subscription for task updates
  useRealtimeTasks(projectId, {
    onInsert: (newTask) => {
      // Refetch to get full task data with relations
      fetchTasks(projectId);
    },
    onUpdate: (updatedTask) => {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
      );
    },
    onDelete: (deletedTask) => {
      setLocalTasks((prev) => prev.filter((t) => t.id !== deletedTask.id));
    },
  });

  // Handle task query parameter (from notifications)
  useEffect(() => {
    if (tasks.length > 0 && searchParams.has('task')) {
      const taskId = searchParams.get('task');
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(taskId);
        setShowTaskDetail(true);
        // Clear the query param to avoid reopening on refresh
        navigate(`/projects/${projectId}/board`, { replace: true });
      }
    }
  }, [tasks, searchParams, projectId, navigate]);

  // Filter and group tasks by status
  const getTasksByStatus = useCallback((status) => {
    return localTasks
      .filter((task) => task.status === status)
      .filter((task) =>
        debouncedSearch
          ? task.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            task.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
          : true
      )
      .sort((a, b) => a.position - b.position);
  }, [localTasks, debouncedSearch]);

  // Find which column a task belongs to
  const findContainer = (id) => {
    if (COLUMNS.some((col) => col.id === id)) {
      return id;
    }
    const task = localTasks.find((t) => t.id === id);
    return task?.status || null;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const task = localTasks.find((t) => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeContainer = findContainer(activeId);
    let overContainer = findContainer(overId);

    // If over a column directly, use that column
    if (COLUMNS.some((col) => col.id === overId)) {
      overContainer = overId;
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Update local state immediately for smooth visual feedback
    setLocalTasks((prev) => {
      return prev.map((task) =>
        task.id === activeId ? { ...task, status: overContainer } : task
      );
    });
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      // Reset to original state if dropped outside
      if (Array.isArray(tasks)) {
        setLocalTasks(tasks);
      }
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    let overContainer = findContainer(overId);

    // If dropped on a column, use that column
    if (COLUMNS.some((col) => col.id === overId)) {
      overContainer = overId;
    }

    if (!overContainer) {
      if (Array.isArray(tasks)) {
        setLocalTasks(tasks);
      }
      return;
    }

    const activeTaskData = localTasks.find((t) => t.id === activeId);
    if (!activeTaskData) return;

    // Calculate new position
    const tasksInColumn = localTasks
      .filter((t) => t.status === overContainer && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let newPosition = tasksInColumn.length;

    // If dropped on another task, insert at that position
    if (overId !== overContainer) {
      const overIndex = tasksInColumn.findIndex((t) => t.id === overId);
      if (overIndex !== -1) {
        newPosition = overIndex;
      }
    }

    // Update database
    const { error } = await updateTask(activeId, {
      status: overContainer,
      position: newPosition,
    });

    if (error) {
      toast.error('Failed to move task');
      // Revert to original state
      if (Array.isArray(tasks)) {
        setLocalTasks(tasks);
      }
      fetchTasks(projectId);
    } else {
      // Refetch to get latest data
      fetchTasks(projectId);
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    if (Array.isArray(tasks)) {
      setLocalTasks(tasks);
    }
  };

  const handleAddTask = (status) => {
    setInitialStatus(status);
    setSelectedTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task.id);
    setShowTaskForm(true);
  };

  const handleViewTask = (task) => {
    setSelectedTask(task.id);
    setShowTaskDetail(true);
  };

  // Get the live task from localTasks so it updates when comments/subtasks are added
  const getSelectedTask = () => {
    if (!selectedTask) return null;
    return localTasks.find(t => t.id === selectedTask) || null;
  };

  const handleTaskFormClose = () => {
    setShowTaskForm(false);
    setSelectedTask(null);
  };

  const handleTaskDetailClose = () => {
    setShowTaskDetail(false);
    setSelectedTask(null);
  };

  if (projectLoading || !currentProject) {
    return <Loading fullscreen text="Loading project..." />;
  }

  return (
    <div className="project-board">
      {/* Header */}
      <div className="board-header">
        <div className="board-header-left">
          <button className="back-btn" onClick={() => navigate('/projects')}>
            <ArrowLeft size={20} />
          </button>
          <div className="board-info">
            <div className="board-title-row">
              <div
                className="project-color-dot"
                style={{ backgroundColor: currentProject.color || '#3b82f6' }}
              />
              <h1>{currentProject.name}</h1>
            </div>
            <p>{currentProject.description || 'No description'}</p>
          </div>
        </div>

        <div className="board-header-right">
          <div className="board-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            icon={<Users size={18} />}
            onClick={() => navigate(`/projects/${projectId}/team`)}
          >
            Team
          </Button>
          <Button
            variant="secondary"
            icon={<Settings size={18} />}
            onClick={() => navigate(`/projects/${projectId}/settings`)}
          >
            Settings
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={18} />}
            onClick={() => handleAddTask('not_started')}
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="board-columns">
          {COLUMNS.map((column) => {
            const columnTasks = getTasksByStatus(column.id);
            return (
              <BoardColumn
                key={column.id}
                id={column.id}
                title={column.title}
                color={column.color}
                count={columnTasks.length}
                onAddTask={() => handleAddTask(column.id)}
              >
                <SortableContext
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleViewTask(task)}
                      onEdit={() => handleEditTask(task)}
                    />
                  ))}
                </SortableContext>
              </BoardColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeTask ? (
            <TaskCard task={activeTask} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Form Modal */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleTaskFormClose}
        title={getSelectedTask() ? 'Edit Task' : 'Create Task'}
        size="large"
      >
        <TaskForm
          projectId={projectId}
          task={getSelectedTask()}
          initialStatus={initialStatus}
          onClose={handleTaskFormClose}
          members={currentProject.project_members || []}
        />
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={showTaskDetail}
        onClose={handleTaskDetailClose}
        title="Task Details"
        size="large"
      >
        {getSelectedTask() && (
          <TaskDetail
            task={getSelectedTask()}
            onClose={handleTaskDetailClose}
            onEdit={() => {
              setShowTaskDetail(false);
              setShowTaskForm(true);
            }}
            members={currentProject.project_members || []}
          />
        )}
      </Modal>
    </div>
  );
};

export default ProjectBoard;
