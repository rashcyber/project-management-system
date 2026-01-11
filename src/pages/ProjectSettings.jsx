import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  ArrowLeft,
  Save,
  Trash2,
  Users,
  FolderKanban,
  Palette,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { Button, Input, Modal, Loading } from '../components/common';
import EmailNotificationSettings from '../components/EmailNotificationSettings';
import useProjectStore from '../store/projectStore';
import useAuthStore from '../store/authStore';
import useActivityStore from '../store/activityStore';
import { toast } from '../store/toastStore';
import './ProjectSettings.css';

const PROJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#64748b',
];

const ProjectSettings = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, fetchProject, updateProject, deleteProject, loading } = useProjectStore();
  const { profile, isAdmin } = useAuthStore();
  const { logActivity } = useActivityStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject]);

  useEffect(() => {
    if (currentProject) {
      setFormData({
        name: currentProject.name || '',
        description: currentProject.description || '',
        color: currentProject.color || '#3b82f6',
      });
    }
  }, [currentProject]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorSelect = (color) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setSaving(true);
    const { error } = await updateProject(projectId, formData);
    setSaving(false);

    if (error) {
      toast.error('Failed to update project');
    } else {
      toast.success('Project settings saved');
      await logActivity('project_updated', { changes: formData }, projectId);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== currentProject?.name) {
      toast.error('Please type the project name to confirm');
      return;
    }

    const { error } = await deleteProject(projectId);
    if (error) {
      toast.error('Failed to delete project');
    } else {
      toast.success('Project deleted successfully');
      navigate('/projects');
    }
  };

  const canEditProject = () => {
    if (isAdmin()) return true;
    return currentProject?.owner_id === profile?.id;
  };

  const canDeleteProject = () => {
    if (isAdmin()) return true;
    return currentProject?.owner_id === profile?.id;
  };

  if (loading && !currentProject) {
    return (
      <div className="settings-loading">
        <Loading />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="settings-error">
        <h2>Project not found</h2>
        <Button variant="secondary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="project-settings">
      <div className="settings-header">
        <button className="back-btn" onClick={() => navigate(`/projects/${projectId}/board`)}>
          <ArrowLeft size={18} />
          Back to Board
        </button>

        <div className="header-content">
          <div
            className="project-indicator"
            style={{ backgroundColor: currentProject.color || '#3b82f6' }}
          />
          <div>
            <h1>Project Settings</h1>
            <p>{currentProject.name}</p>
          </div>
        </div>
      </div>

      <div className="settings-content">
        {/* Navigation */}
        <div className="settings-nav">
          <button
            className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={18} />
            General
          </button>
          <button
            className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} />
            Notifications
          </button>
          <button
            className="nav-item"
            onClick={() => navigate(`/projects/${projectId}/team`)}
          >
            <Users size={18} />
            Team Members
          </button>
        </div>

        {/* Settings Form */}
        <div className="settings-main">
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
            <div className="settings-section">
              <div className="section-header">
                <FolderKanban size={20} />
                <div>
                  <h2>Project Details</h2>
                  <p>Basic information about your project</p>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="name">Project Name</label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter project name"
                  disabled={!canEditProject()}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter project description (optional)"
                  rows={4}
                  disabled={!canEditProject()}
                  className="textarea-input"
                />
              </div>
            </div>

            <div className="settings-section">
              <div className="section-header">
                <Palette size={20} />
                <div>
                  <h2>Project Color</h2>
                  <p>Choose a color to identify this project</p>
                </div>
              </div>

              <div className="color-picker">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-option ${formData.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                    disabled={!canEditProject()}
                  />
                ))}
              </div>

              <div className="color-preview">
                <span>Preview:</span>
                <div
                  className="preview-bar"
                  style={{ backgroundColor: formData.color }}
                />
              </div>
            </div>

            {canEditProject() && (
              <div className="form-actions">
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Save size={18} />}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </div>
            )}

              {/* Danger Zone */}
              {canDeleteProject() && (
                <div className="settings-section danger-zone">
                  <div className="section-header">
                    <AlertTriangle size={20} />
                    <div>
                      <h2>Danger Zone</h2>
                      <p>Irreversible and destructive actions</p>
                    </div>
                  </div>

                  <div className="danger-action">
                    <div className="danger-info">
                      <h3>Delete this project</h3>
                      <p>
                        Once you delete a project, there is no going back. All tasks, comments,
                        and data associated with this project will be permanently removed.
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      icon={<Trash2 size={18} />}
                      onClick={() => setShowDeleteModal(true)}
                    >
                      Delete Project
                    </Button>
                  </div>
                </div>
              )}
            </form>
          )}

          {activeTab === 'notifications' && (
            <EmailNotificationSettings projectId={projectId} />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmation('');
        }}
        title="Delete Project"
        size="small"
      >
        <div className="delete-modal-content">
          <div className="warning-banner">
            <AlertTriangle size={24} />
            <span>This action cannot be undone</span>
          </div>

          <p>
            This will permanently delete the <strong>{currentProject?.name}</strong> project,
            including all of its tasks, comments, and related data.
          </p>

          <div className="confirm-input">
            <label>
              Type <strong>{currentProject?.name}</strong> to confirm:
            </label>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteConfirmation !== currentProject?.name}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectSettings;
