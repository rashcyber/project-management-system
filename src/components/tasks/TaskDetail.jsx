import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Flag,
  User,
  Edit2,
  Trash2,
  CheckSquare,
  Plus,
  MessageSquare,
  Send,
  X,
  Reply,
  CornerDownRight,
  Pencil,
  Check,
  UserPlus,
  Paperclip,
  Download,
  Upload,
  File as FileIcon,
  Eye,
  Link2,
} from 'lucide-react';
import { Button, Modal, Avatar, Input, MentionInput, Loading } from '../common';
import TaskDependencies from './TaskDependencies';
import TimeTracker from '../TimeTracker';
import useDependencyStore from '../../store/dependencyStore';
import useTaskStore from '../../store/taskStore';
import useAuthStore from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { useRealtimeComments } from '../../hooks/useRealtimeSubscription';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import './TaskDetail.css';

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#f97316' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#94a3b8' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  review: { label: 'Review', color: '#8b5cf6' },
  completed: { label: 'Completed', color: '#22c55e' },
};

const TaskDetail = ({ task, onClose, onEdit, members }) => {
  const [searchParams] = useSearchParams();
  const { profile } = useAuthStore();
  const {
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateSubtaskAssignment,
    addComment,
    editComment,
    deleteComment,
    uploadFile,
    deleteFile,
    fetchTaskFiles,
  } = useTaskStore();

  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignedTo, setNewSubtaskAssignedTo] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [assigningSubtaskId, setAssigningSubtaskId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileUrls, setFileUrls] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;

  // Subscribe to real-time comment changes
  useRealtimeComments(task.id, {
    onInsert: (newComment) => {
      // Update the task with the new comment
      const updatedTask = {
        ...task,
        comments: [
          ...(task.comments || []),
          {
            ...newComment,
            user: newComment.user || { id: newComment.user_id, full_name: 'Unknown', avatar_url: null }
          }
        ]
      };
      // Refresh the task in the store
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map(t => t.id === task.id ? updatedTask : t),
        currentTask: task.id === state.currentTask?.id ? updatedTask : state.currentTask
      }));
    },
    onUpdate: (updatedComment) => {
      // Update the comment in the task
      const updatedTask = {
        ...task,
        comments: (task.comments || []).map(c =>
          c.id === updatedComment.id ? { ...c, ...updatedComment } : c
        )
      };
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map(t => t.id === task.id ? updatedTask : t),
        currentTask: task.id === state.currentTask?.id ? updatedTask : state.currentTask
      }));
    },
    onDelete: (deletedComment) => {
      // Remove the comment from the task
      const updatedTask = {
        ...task,
        comments: (task.comments || []).filter(c => c.id !== deletedComment.id)
      };
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map(t => t.id === task.id ? updatedTask : t),
        currentTask: task.id === state.currentTask?.id ? updatedTask : state.currentTask
      }));
    }
  });

  // Fetch files when task changes
  useEffect(() => {
    const loadFiles = async () => {
      const { data: filesData } = await fetchTaskFiles(task.id);
      if (filesData) {
        setFiles(filesData);
        // Generate public URLs for image previews (non-blocking)
        const urls = {};
        const promises = filesData.map(async (file) => {
          const { data: { publicUrl } } = await supabase.storage
            .from('task-files')
            .getPublicUrl(file.file_path);
          return { id: file.id, url: publicUrl };
        });

        Promise.all(promises).then(results => {
          results.forEach(({ id, url }) => {
            urls[id] = url;
          });
          setFileUrls(urls);
        });
      }
    };
    loadFiles();
  }, [task.id]);

  // Handle deep linking to comments
  useEffect(() => {
    const commentId = searchParams.get('comment');
    if (commentId) {
      // Set the highlighted comment ID
      setHighlightedCommentId(commentId);

      // Wait for DOM to render, then scroll to the comment
      setTimeout(() => {
        const commentElement = document.getElementById(`comment-${commentId}`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove highlight after 3 seconds
          setTimeout(() => setHighlightedCommentId(null), 3000);
        }
      }, 100);
    }
  }, [searchParams]);

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;

    const { error } = await addSubtask(task.id, newSubtask.trim(), newSubtaskAssignedTo);
    if (error) {
      toast.error('Failed to add subtask');
    } else {
      setNewSubtask('');
      setNewSubtaskAssignedTo(null);
      setShowSubtaskInput(false);
    }
  };

  const handleToggleSubtask = async (subtaskId, completed) => {
    const { error } = await toggleSubtask(subtaskId, !completed);
    if (error) {
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    const { error } = await deleteSubtask(task.id, subtaskId);
    if (error) {
      toast.error('Failed to delete subtask');
    }
  };

  const handleAddSubtaskAssignment = async (subtaskId, userId) => {
    if (!userId) return;
    const { error } = await updateSubtaskAssignment(task.id, subtaskId, userId);
    if (error) {
      toast.error('Failed to assign subtask');
    } else {
      setAssigningSubtaskId(null);
    }
  };

  const handleRemoveSubtaskAssignment = async (subtaskId) => {
    const { error } = await updateSubtaskAssignment(task.id, subtaskId, null);
    if (error) {
      toast.error('Failed to remove assignment');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const { error } = await addComment(task.id, newComment.trim());
    if (error) {
      toast.error('Failed to add comment');
    } else {
      setNewComment('');
    }
  };

  const handleAddReply = async (parentId) => {
    if (!replyContent.trim()) return;

    const { error } = await addComment(task.id, replyContent.trim(), parentId);
    if (error) {
      toast.error('Failed to add reply');
    } else {
      setReplyContent('');
      setReplyingTo(null);
    }
  };

  const handleStartEdit = (comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    const { error } = await editComment(task.id, commentId, editContent.trim());
    if (error) {
      toast.error('Failed to update comment');
    } else {
      setEditingComment(null);
      setEditContent('');
      toast.success('Comment updated');
    }
  };

  // Organize comments into threads (top-level and replies)
  const organizeComments = () => {
    const comments = task.comments || [];
    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);

    // Sort by created_at
    topLevel.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Group replies by parent_id
    const replyMap = {};
    replies.forEach((reply) => {
      if (!replyMap[reply.parent_id]) {
        replyMap[reply.parent_id] = [];
      }
      replyMap[reply.parent_id].push(reply);
    });

    // Sort replies by created_at
    Object.values(replyMap).forEach((arr) => {
      arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });

    return { topLevel, replyMap };
  };

  const { topLevel: topLevelComments, replyMap } = organizeComments();

  const handleDeleteComment = async (commentId) => {
    const { error } = await deleteComment(task.id, commentId);
    if (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleDeleteTask = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      const { error } = await deleteTask(task.id);
      if (error) {
        toast.error('Failed to delete task');
      } else {
        toast.success('Task deleted');
        onClose();
      }
    }
  };

  // File upload handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { error, data: uploadedFile } = await uploadFile(task.id, file);
      if (error) {
        console.error('File upload error:', error);
        if (error.message?.includes('404') || error.message?.includes('bucket not found')) {
          toast.error('Storage bucket not found. Create "task-files" bucket in Supabase Storage.');
        } else if (error.message?.includes('400') || error.message?.includes('permission')) {
          toast.error('Storage permission error. Check bucket RLS policies in Supabase.');
        } else {
          toast.error('Failed to upload file: ' + (error.message || 'Unknown error'));
        }
      } else {
        toast.success('File uploaded');
        // Refresh files list
        const { data: filesData } = await fetchTaskFiles(task.id);
        if (filesData) setFiles(filesData);
      }
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDeleteFile = async (fileId) => {
    setDeletingFileId(fileId);
    const { error } = await deleteFile(task.id, fileId);
    if (error) {
      toast.error('Failed to delete file');
    } else {
      toast.success('File deleted');
      // Refresh files list
      const { data: filesData } = await fetchTaskFiles(task.id);
      if (filesData) setFiles(filesData);
    }
    setDeletingFileId(null);
  };

  const handleDownloadFile = async (file) => {
    try {
      // Get fresh public URL to avoid caching
      const { data: { publicUrl } } = await supabase.storage
        .from('task-files')
        .getPublicUrl(file.file_path);

      // Force download by using fetch and blob
      const response = await fetch(publicUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handlePreviewFile = (file) => {
    window.open(fileUrls[file.id], '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return 'File';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Music';
    if (mimeType.startsWith('application/pdf')) return 'FileText';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'FileText';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'Table';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archive';
    return 'File';
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div className="task-detail">
      {/* Header */}
      <div className="task-detail-header">
        <div className="task-status-badge" style={{ backgroundColor: status.color }}>
          {status.label}
        </div>
        <div className="task-detail-actions">
          <Button variant="ghost" size="small" onClick={onEdit}>
            <Edit2 size={16} />
          </Button>
          <Button variant="ghost" size="small" onClick={handleDeleteTask}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Title & Description */}
      <div className="task-detail-main">
        <h2 className="task-detail-title">{task.title}</h2>
        {task.description && (
          <p className="task-detail-description">{task.description}</p>
        )}
      </div>

      {/* Meta info */}
      <div className="task-detail-meta">
        <div className="meta-row">
          <div className="meta-item">
            <Flag size={16} style={{ color: priority.color }} />
            <span>Priority:</span>
            <span className="meta-value" style={{ color: priority.color }}>
              {priority.label}
            </span>
          </div>

          {task.due_date && (
            <div className="meta-item">
              <Calendar size={16} />
              <span>Due:</span>
              <span className="meta-value">
                {format(new Date(task.due_date), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        <div className="meta-row">
          <div className="meta-item">
            <User size={16} />
            <span>Assignees:</span>
            {task.assignees && task.assignees.length > 0 ? (
              <div className="assignees-list">
                {task.assignees.map((assignee) => (
                  <div key={assignee.id} className="assignee-info">
                    <Avatar
                      src={assignee.avatar_url}
                      name={assignee.full_name}
                      size="small"
                    />
                    <span className="meta-value">{assignee.full_name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="meta-value unassigned">Unassigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Subtasks */}
      <div className="task-detail-section">
        <div className="section-header">
          <h3>
            <CheckSquare size={18} />
            Subtasks
            {totalSubtasks > 0 && (
              <span className="subtask-count">
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </h3>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              setShowSubtaskInput(true);
              setNewSubtaskAssignedTo(null);
            }}
          >
            <Plus size={16} />
            Add
          </Button>
        </div>

        <div className="subtasks-list">
          {task.subtasks?.map((subtask) => (
            <div key={subtask.id} className="subtask-item">
              <label className="subtask-checkbox">
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => handleToggleSubtask(subtask.id, subtask.completed)}
                />
                <span className={subtask.completed ? 'completed' : ''}>
                  {subtask.title}
                </span>
              </label>

              {/* Subtask assignee */}
              <div className="subtask-assignee">
                {assigningSubtaskId === subtask.id ? (
                  <select
                    className="subtask-assign-select"
                    defaultValue=""
                    onChange={(e) => handleAddSubtaskAssignment(subtask.id, e.target.value)}
                    onBlur={() => setAssigningSubtaskId(null)}
                    autoFocus
                  >
                    <option value="">Select...</option>
                    {members?.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.user?.full_name || member.user?.email}
                      </option>
                    ))}
                  </select>
                ) : subtask.assignee ? (
                  <div
                    className="subtask-assignee-avatar"
                    title={subtask.assignee.full_name}
                    onClick={() => setAssigningSubtaskId(subtask.id)}
                  >
                    <Avatar
                      src={subtask.assignee.avatar_url}
                      name={subtask.assignee.full_name}
                      size="xsmall"
                    />
                    <button
                      className="remove-assignee-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSubtaskAssignment(subtask.id);
                      }}
                      title="Remove assignment"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="add-subtask-assignee"
                    onClick={() => setAssigningSubtaskId(subtask.id)}
                    title="Assign to someone"
                  >
                    <UserPlus size={14} />
                  </button>
                )}
              </div>

              <button
                className="subtask-delete"
                onClick={() => handleDeleteSubtask(subtask.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {showSubtaskInput && (
            <div className="subtask-input">
              <input
                type="text"
                placeholder="Add a subtask..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                autoFocus
              />
              {members && members.length > 0 && (
                <select
                  className="subtask-assign-select"
                  value={newSubtaskAssignedTo || ''}
                  onChange={(e) => setNewSubtaskAssignedTo(e.target.value || null)}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user?.full_name || member.user?.email}
                    </option>
                  ))}
                </select>
              )}
              <Button variant="primary" size="small" onClick={handleAddSubtask}>
                Add
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() => {
                  setShowSubtaskInput(false);
                  setNewSubtask('');
                  setNewSubtaskAssignedTo(null);
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {!showSubtaskInput && totalSubtasks === 0 && (
            <p className="no-subtasks">No subtasks yet</p>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="task-detail-section">
        <div className="section-header">
          <h3>
            <MessageSquare size={18} />
            Comments
            {task.comments?.length > 0 && (
              <span className="comment-count">{task.comments.length}</span>
            )}
          </h3>
        </div>

        <div className="comments-list">
          {topLevelComments.map((comment) => (
            <div key={comment.id} className="comment-thread">
              {/* Parent comment */}
              <div
                id={`comment-${comment.id}`}
                className={`comment-item ${highlightedCommentId === comment.id ? 'highlight-comment' : ''}`}
              >
                <Avatar
                  src={comment.user?.avatar_url}
                  name={comment.user?.full_name}
                  size="small"
                />
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">
                      {comment.user?.full_name || 'Unknown'}
                    </span>
                    <span className="comment-time">
                      {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      {comment.updated_at && comment.updated_at !== comment.created_at && (
                        <span className="edited-label">(edited)</span>
                      )}
                    </span>
                    {comment.user_id === profile?.id && (
                      <div className="comment-actions">
                        <button
                          className="comment-edit"
                          onClick={() => handleStartEdit(comment)}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="comment-delete"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingComment === comment.id ? (
                    <div className="comment-edit-section">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="comment-edit-input"
                        rows={2}
                        autoFocus
                      />
                      <div className="comment-edit-actions">
                        <Button variant="ghost" size="small" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={!editContent.trim()}
                        >
                          <Check size={14} />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="comment-text">{comment.content}</p>
                      <button
                        className="reply-btn"
                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      >
                        <Reply size={14} />
                        Reply
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Replies */}
              {replyMap[comment.id]?.map((reply) => (
                <div
                  key={reply.id}
                  id={`comment-${reply.id}`}
                  className={`comment-item comment-reply ${highlightedCommentId === reply.id ? 'highlight-comment' : ''}`}
                >
                  <CornerDownRight size={16} className="reply-indicator" />
                  <Avatar
                    src={reply.user?.avatar_url}
                    name={reply.user?.full_name}
                    size="small"
                  />
                  <div className="comment-content">
                    <div className="comment-header">
                      <span className="comment-author">
                        {reply.user?.full_name || 'Unknown'}
                      </span>
                      <span className="comment-time">
                        {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                        {reply.updated_at && reply.updated_at !== reply.created_at && (
                          <span className="edited-label">(edited)</span>
                        )}
                      </span>
                      {reply.user_id === profile?.id && (
                        <div className="comment-actions">
                          <button
                            className="comment-edit"
                            onClick={() => handleStartEdit(reply)}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="comment-delete"
                            onClick={() => handleDeleteComment(reply.id)}
                            title="Delete"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {editingComment === reply.id ? (
                      <div className="comment-edit-section">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="comment-edit-input"
                          rows={2}
                          autoFocus
                        />
                        <div className="comment-edit-actions">
                          <Button variant="ghost" size="small" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handleSaveEdit(reply.id)}
                            disabled={!editContent.trim()}
                          >
                            <Check size={14} />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="comment-text">{reply.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Reply input */}
              {replyingTo === comment.id && (
                <div className="reply-input-section">
                  <CornerDownRight size={16} className="reply-indicator" />
                  <Avatar src={profile?.avatar_url} name={profile?.full_name} size="small" />
                  <div className="reply-input-wrapper">
                    <MentionInput
                      value={replyContent}
                      onChange={setReplyContent}
                      onSubmit={() => handleAddReply(comment.id)}
                      placeholder={`Reply to ${comment.user?.full_name || 'comment'}...`}
                      members={members}
                      rows={2}
                      className="reply-mention-input"
                    />
                    <div className="reply-input-actions">
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => handleAddReply(comment.id)}
                        disabled={!replyContent.trim()}
                      >
                        <Send size={14} />
                        Reply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {topLevelComments.length === 0 && (
            <p className="no-comments">No comments yet</p>
          )}
        </div>

        <div className="comment-input-section">
          <div className="comment-input-row">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="small" />
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={handleAddComment}
              placeholder="Write a comment... Type @ to mention someone"
              members={members}
              rows={2}
              className="comment-mention-input"
            />
          </div>
          <div className="comment-input-actions">
            <Button
              variant="primary"
              size="small"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Send size={16} />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Files */}
      <div className="task-detail-section">
        <div className="section-header">
          <h3>
            <Paperclip size={18} />
            Attachments
            {files && files.length > 0 && (
              <span className="file-count">{files.length}</span>
            )}
          </h3>
          <Button
            variant="ghost"
            size="small"
            onClick={() => {
              const input = document.getElementById('file-upload-input');
              if (input) input.click();
            }}
          >
            <Upload size={16} />
            Upload
          </Button>
        </div>

        <input
          type="file"
          id="file-upload-input"
          className="file-upload-input"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        <div className="files-list">
          {files && files.length > 0 ? (
            files.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-icon">
                  {getFileIcon(file.mime_type) === 'Image' && fileUrls[file.id] && (
                    <img src={fileUrls[file.id]} alt="" className="file-preview" />
                  )}
                  {getFileIcon(file.mime_type) !== 'Image' && (
                    <FileIcon size={32} strokeWidth={1.5} />
                  )}
                </div>
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-meta">
                    <span className="file-size">{formatFileSize(file.file_size)}</span>
                    {' • '}
                    <span className="file-uploader">
                      by {file.uploader?.full_name || 'Unknown'}
                    </span>
                  </span>
                </div>
                <div className="file-actions">
                  {getFileIcon(file.mime_type) !== 'Image' && (
                    <button
                      className="file-preview"
                      onClick={() => handlePreviewFile(file)}
                      title="Preview"
                      disabled={deletingFileId === file.id || uploading}
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <button
                    className="file-download"
                    onClick={() => handleDownloadFile(file)}
                    title="Download"
                    disabled={deletingFileId === file.id || uploading}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="file-delete"
                    onClick={() => handleDeleteFile(file.id)}
                    title="Delete"
                    disabled={deletingFileId === file.id || uploading}
                  >
                    {deletingFileId === file.id ? (
                      <span>...</span>
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="no-files">No attachments yet</p>
          )}
        </div>

        {uploading && (
          <div className="uploading-overlay">
            <Loading />
            <span>Uploading...</span>
          </div>
        )}
      </div>

      {/* Time Tracking */}
      <TimeTracker task={task} />

      {/* Task Dependencies */}
      <TaskDependencies
        task={task}
        projectId={task.project_id}
        members={members}
      />
    </div>
  );
};

export default TaskDetail;
