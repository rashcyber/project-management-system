import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FolderKanban,
  MoreVertical,
  Users,
  Calendar,
  Trash2,
  Edit2,
  ExternalLink,
  UserPlus,
  X,
  Check,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Button, Input, Modal, Avatar, Loading, SkeletonLoader } from '../components/common';
import useProjectStore from '../store/projectStore';
import useAuthStore from '../store/authStore';
import useUserStore from '../store/userStore';
import { toast } from '../store/toastStore';
import { format } from 'date-fns';
import useDebounce from '../hooks/useDebounce';
import './Projects.css';

const Projects = () => {
  const navigate = useNavigate();
  const { projects, loading, projectsHasMore, fetchProjectsPage, loadMoreProjects, resetProjectsPagination, deleteProject } = useProjectStore();
  const { profile, isAdmin } = useAuthStore();
  const { users, fetchUsers } = useUserStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search input for performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    resetProjectsPagination();
    fetchProjectsPage(0);
    fetchUsers();
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadMoreProjects();
    setLoadingMore(false);
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    project.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      const { error } = await deleteProject(projectToDelete.id);
      if (error) {
        toast.error('Failed to delete project');
      } else {
        toast.success('Project deleted successfully');
      }
      setShowDeleteModal(false);
      setProjectToDelete(null);
    }
  };

  const toggleMenu = (projectId) => {
    setActiveMenu(activeMenu === projectId ? null : projectId);
  };

  // Add members handlers
  const handleAddMembersClick = (project) => {
    setSelectedProject(project);
    setSelectedUserIds([]);
    setMemberSearch('');
    setActiveMenu(null);
    setShowAddMembersModal(true);
  };

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleConfirmAddMembers = async () => {
    if (!selectedProject || selectedUserIds.length === 0) return;

    const { addMember } = useProjectStore.getState();
    let success = true;

    for (const userId of selectedUserIds) {
      const { error } = await addMember(selectedProject.id, userId, 'member');
      if (error) {
        success = false;
        toast.error(`Failed to add ${users.find(u => u.id === userId)?.full_name || 'member'}`);
      }
    }

    if (success) {
      toast.success(`${selectedUserIds.length} member${selectedUserIds.length > 1 ? 's' : ''} added successfully`);
    }

    setShowAddMembersModal(false);
    setSelectedProject(null);
    setSelectedUserIds([]);
    fetchProjects(); // Refresh to show new members
  };

  // Get users not already in the project
  const getAvailableUsers = () => {
    if (!selectedProject) return [];
    const memberIds = selectedProject.project_members?.map((m) => m.user_id) || [];
    const currentUserId = profile?.id;

    return users.filter(
      (user) => !memberIds.includes(user.id) && user.id !== currentUserId
    );
  };

  const availableUsers = getAvailableUsers();
  const filteredAvailableUsers = availableUsers.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  return (
    <div className="projects-page">
      {/* Header */}
      <div className="projects-header">
        <div>
          <h1>Projects</h1>
          <p>Manage and organize your team's projects</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={18} />}
          onClick={() => navigate('/projects/new')}
        >
          New Project
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="projects-toolbar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="project-count">
          {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Projects Grid */}
      {loading && projects.length === 0 ? (
        <div className="projects-grid">
          <SkeletonLoader type="project-card" count={6} />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="projects-empty">
          <FolderKanban size={64} />
          <h2>No projects yet</h2>
          <p>Create your first project to start organizing your tasks</p>
          <Button
            variant="primary"
            icon={<Plus size={18} />}
            onClick={() => navigate('/projects/new')}
          >
            Create Project
          </Button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              style={{
                borderLeftColor: project.color || '#3b82f6',
                borderLeftWidth: '4px',
                borderTopColor: project.color || '#3b82f6',
                borderTopWidth: '3px',
                '--project-color': project.color || '#3b82f6'
              }}
            >

              <div className="project-card-header">
                <h3
                  className="project-title"
                  onClick={() => navigate(`/projects/${project.id}/board`)}
                >
                  {project.name}
                </h3>
                <div className="project-menu-wrapper">
                  <button
                    className="menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(project.id);
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {activeMenu === project.id && (
                    <div className="project-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => navigate(`/projects/${project.id}/board`)}>
                        <ExternalLink size={16} />
                        Open Board
                      </button>
                      <button onClick={() => navigate(`/projects/${project.id}/team`)}>
                        <Users size={16} />
                        Manage Team
                      </button>
                      <button onClick={() => navigate(`/projects/${project.id}/settings`)}>
                        <Edit2 size={16} />
                        Edit
                      </button>
                      {(isAdmin() || project.owner_id === profile?.id) && (
                        <button onClick={() => handleAddMembersClick(project)}>
                          <UserPlus size={16} />
                          Add Members
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <p className="project-description">
                {project.description || 'No description'}
              </p>

              {/* Task Progress Bar */}
              <div className="project-progress-section">
                <div className="progress-header">
                  <span className="progress-label" style={{ backgroundColor: project.color || '#3b82f6' }}>Progress</span>
                  <span className="progress-percent">
                    {project.task_completion_percentage ? Math.round(project.task_completion_percentage) : 0}%
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${project.task_completion_percentage ? Math.round(project.task_completion_percentage) : 0}%`,
                      backgroundColor: project.color || '#3b82f6',
                    }}
                  />
                </div>
              </div>

              {/* Activity Badge & Meta */}
              <div className="project-meta">
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{format(new Date(project.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="meta-item">
                  <Users size={14} />
                  <span>{project.project_members?.length || 1} members</span>
                </div>
                {/* Activity Badge - Shows if updated in last 24 hours */}
                {project.updated_at && new Date(project.updated_at).getTime() > Date.now() - 24 * 60 * 60 * 1000 && (
                  <div className="activity-badge">
                    <Activity size={12} />
                    <span>Active</span>
                  </div>
                )}
              </div>

              <div className="project-card-footer">
                <div className="project-members">
                  {project.project_members?.slice(0, 4).map((member, index) => (
                    <Avatar
                      key={member.user_id}
                      src={member.user?.avatar_url}
                      name={member.user?.full_name}
                      size="small"
                      className="member-avatar"
                      style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                    />
                  ))}
                  {(project.project_members?.length || 0) > 4 && (
                    <div className="more-members">
                      +{project.project_members.length - 4}
                    </div>
                  )}
                </div>
                <div className="project-card-actions">
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => navigate(`/projects/${project.id}/board`)}
                  >
                    View Board
                  </Button>
                  {(isAdmin() || project.owner_id === profile?.id) && (
                    <Button
                      variant="ghost"
                      size="small"
                      className="delete-btn"
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDeleteClick(project)}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {projectsHasMore && (
            <div className="projects-load-more">
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Projects'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Project"
        size="small"
      >
        <div className="delete-modal-content">
          <p>
            Are you sure you want to delete <strong>{projectToDelete?.name}</strong>?
          </p>
          <p className="delete-warning">
            This will permanently delete all tasks, comments, and data associated with this project.
            This action cannot be undone.
          </p>
          <div className="delete-modal-actions">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Members Modal */}
      <Modal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        title={`Add Members to ${selectedProject?.name || ''}`}
        size="medium"
      >
        <div className="add-members-modal-content">
          <div className="member-search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search users..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="search-input"
            />
          </div>

          {availableUsers.length === 0 ? (
            <div className="no-users-message">
              <p>All available users are already members of this project.</p>
            </div>
          ) : filteredAvailableUsers.length === 0 ? (
            <div className="no-users-message">
              <p>No users found matching "{memberSearch}"</p>
            </div>
          ) : (
            <div className="users-list">
              {filteredAvailableUsers.map((user) => (
                <div
                  key={user.id}
                  className={`user-item ${selectedUserIds.includes(user.id) ? 'selected' : ''}`}
                  onClick={() => handleToggleUser(user.id)}
                >
                  <Avatar
                    src={user.avatar_url}
                    name={user.full_name}
                    size="small"
                  />
                  <div className="user-info">
                    <span className="user-name">{user.full_name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                  {selectedUserIds.includes(user.id) && (
                    <Check size={16} className="check-icon" />
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedUserIds.length > 0 && (
            <div className="selected-count">
              {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''} selected
            </div>
          )}

          <div className="add-members-actions">
            <Button variant="secondary" onClick={() => setShowAddMembersModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmAddMembers}
              disabled={selectedUserIds.length === 0}
            >
              Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}Member{selectedUserIds.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Projects;
