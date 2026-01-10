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
  LayoutGrid,
  Folder,
  CheckSquare,
  Trash2,
  ArrowRight,
  X,
  List,
  HelpCircle,
} from 'lucide-react';
import { Button, Modal, Loading, KeyboardShortcutsModal } from '../components/common';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import BoardColumn from '../components/tasks/BoardColumn';
import TaskCard from '../components/tasks/TaskCard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetail from '../components/tasks/TaskDetail';
import ProjectFiles from '../components/projects/ProjectFiles';
import useProjectStore from '../store/projectStore';
import useTaskStore from '../store/taskStore';
import useDependencyStore from '../store/dependencyStore';
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

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TaskDetail error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <p>Error loading task details</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProjectBoard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { currentProject, fetchProject, loading: projectLoading } = useProjectStore();
  const { tasks, fetchTasks, updateTask, deleteTask, loading: tasksLoading } = useTaskStore();
  const { fetchDependencies } = useDependencyStore();

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [initialStatus, setInitialStatus] = useState('not_started');
  const [searchQuery, setSearchQuery] = useState('');
  const [localTasks, setLocalTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('board');

  // Batch actions state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Search input ref for keyboard focus
  const searchInputRef = React.useRef(null);

  // Debounce search input for performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Batch mode handlers
  const handleToggleBatchMode = () => {
    setIsBatchMode(prev => !prev);
    if (isBatchMode) {
      setSelectedTasks([]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTasks.length === 0) return;
    if (!window.confirm(`Delete ${selectedTasks.length} selected tasks?`)) return;

    let successCount = 0;
    let errorCount = 0;

    for (const taskId of selectedTasks) {
      const { error } = await deleteTask(taskId);
      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Deleted ${successCount} task${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to delete ${errorCount} task${errorCount > 1 ? 's' : ''}`);
    }

    setSelectedTasks([]);
    fetchTasks(projectId);
  };

  const handleBatchComplete = async () => {
    if (selectedTasks.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const taskId of selectedTasks) {
      const { error } = await updateTask(taskId, { status: 'completed' });
      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Completed ${successCount} task${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to complete ${errorCount} task${errorCount > 1 ? 's' : ''}`);
    }

    setSelectedTasks([]);
    fetchTasks(projectId);
  };

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onBatchModeToggle: handleToggleBatchMode,
    onDeleteSelected: handleBatchDelete,
    onCompleteSelected: handleBatchComplete,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onShowHelp: () => setShowShortcutsModal(true),
    isBatchMode,
    hasSelection: selectedTasks.length > 0,
    canDelete: selectedTasks.length > 0,
    canComplete: selectedTasks.length > 0,
  });

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
      fetchDependencies(projectId);
    }
  }, [projectId, fetchProject, fetchTasks, fetchDependencies]);

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
        navigate(`/projects/${projectId}/board`);
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

  // Batch actions handlers
  const handleToggleSelect = useCallback((taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  const handleBatchMove = async (newStatus) => {
    if (selectedTasks.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const taskId of selectedTasks) {
      const task = localTasks.find(t => t.id === taskId);
      if (task) {
        const { error } = await updateTask(taskId, { status: newStatus });
        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    }

    if (successCount > 0) {
      toast.success(`Moved ${successCount} task${successCount > 1 ? 's' : ''} to ${newStatus.replace('_', ' ')}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to move ${errorCount} task${errorCount > 1 ? 's' : ''}`);
    }

    setSelectedTasks([]);
    setShowMoveModal(false);
    fetchTasks(projectId);
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
          {/* Batch mode toggle */}
          <Button
            variant={isBatchMode ? 'primary' : 'secondary'}
            icon={<CheckSquare size={18} />}
            onClick={handleToggleBatchMode}
          >
            {isBatchMode ? 'Exit Selection' : 'Select Tasks'}
          </Button>

          {/* Batch actions toolbar */}
          {isBatchMode && selectedTasks.length > 0 && (
            <div className="batch-actions-toolbar">
              <span className="batch-count">{selectedTasks.length} selected</span>
              <Button
                variant="ghost"
                size="small"
                icon={<ArrowRight size={16} />}
                onClick={() => setShowMoveModal(true)}
              >
                Move
              </Button>
              <Button
                variant="ghost"
                size="small"
                icon={<CheckSquare size={16} />}
                onClick={handleBatchComplete}
              >
                Complete
              </Button>
              <Button
                variant="ghost"
                size="small"
                icon={<Trash2 size={16} />}
                onClick={handleBatchDelete}
                className="delete-btn"
              >
                Delete
              </Button>
            </div>
          )}

          {!isBatchMode && (
            <>
              <div className="board-search">
                <Search size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search tasks... (press / to focus)"
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
                variant="ghost"
                icon={<HelpCircle size={18} />}
                onClick={() => setShowShortcutsModal(true)}
                title="Keyboard shortcuts (?)"
              >
              </Button>
              <Button
                variant="primary"
                icon={<Plus size={18} />}
                onClick={() => handleAddTask('not_started')}
              >
                Add Task
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="board-tabs">
        <button
          className={`board-tab ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <LayoutGrid size={18} />
          Board
        </button>
        <button
          className={`board-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Folder size={18} />
          Files
        </button>
      </div>

      {/* Board */}
      <div className="board-content">
        {activeTab === 'board' && (
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
                    showCheckbox={isBatchMode}
                    selectedTasks={selectedTasks}
                    onToggleSelect={handleToggleSelect}
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
                          isSelected={selectedTasks.includes(task.id)}
                          onSelect={handleToggleSelect}
                          showCheckbox={isBatchMode}
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
        )}

        {activeTab === 'files' && (
          <ProjectFiles projectId={projectId} />
        )}
      </div>

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
        size="xlarge"
      >
        {getSelectedTask() ? (
          <ErrorBoundary onError={handleTaskDetailClose}>
            <TaskDetail
              task={getSelectedTask()}
              onClose={handleTaskDetailClose}
              onEdit={() => {
                setShowTaskDetail(false);
                setShowTaskForm(true);
              }}
              members={currentProject.project_members || []}
            />
          </ErrorBoundary>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>Loading task details...</p>
          </div>
        )}
      </Modal>

      {/* Batch Move Modal */}
      <Modal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        title="Move Tasks"
        size="small"
      >
        <div className="batch-move-options">
          <p>Select a status to move {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} to:</p>
          <div className="move-options-list">
            {COLUMNS.map((column) => (
              <button
                key={column.id}
                className="move-option-btn"
                onClick={() => handleBatchMove(column.id)}
              >
                <div
                  className="move-option-dot"
                  style={{ backgroundColor: column.color }}
                />
                <span>{column.title}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};

export default ProjectBoard;
