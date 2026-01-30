import React, { useState, useEffect } from 'react';
import { Copy, Trash2, Share2, Lock, Globe, Plus, Edit2, ChevronDown } from 'lucide-react';
import { Button, Avatar, Modal } from './common';
import useTemplateStore from '../store/templateStore';
import { toast } from '../store/toastStore';
import './TemplateManager.css';

/**
 * TemplateManager Component
 * Displays and manages task templates
 *
 * Props:
 * - onSelectTemplate: Callback when template is selected to create task
 * - projectId: Current project ID for filtering templates
 */
export const TemplateManager = ({ onSelectTemplate, projectId, showPublic = false }) => {
  const {
    templates,
    publicTemplates,
    loading,
    fetchTemplates,
    fetchPublicTemplates,
    deleteTemplate,
    updateTemplate,
    createTaskFromTemplate,
  } = useTemplateStore();

  const [expandedId, setExpandedId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    fetchTemplates();
    if (showPublic) {
      fetchPublicTemplates();
    }
  }, []);

  const handleDelete = async (templateId) => {
    const { error } = await deleteTemplate(templateId);
    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
    }
    setShowDeleteModal(false);
  };

  const handleTogglePublic = async (templateId, isPublic) => {
    const { error } = await updateTemplate(templateId, { is_public: !isPublic });
    if (error) {
      toast.error('Failed to update template');
    } else {
      toast.success(isPublic ? 'Template made private' : 'Template shared with team');
    }
  };

  const handleUseTemplate = async (template) => {
    if (onSelectTemplate) {
      // Pass template data to parent component
      onSelectTemplate(template);
    } else {
      toast.info('Select this template to create a task');
    }
  };

  const displayTemplates = showPublic ? publicTemplates : templates;
  const displayedTemplates = projectId
    ? displayTemplates.filter((t) => !t.project_id || t.project_id === projectId)
    : displayTemplates;

  return (
    <div className="template-manager">
      <div className="template-manager-header">
        <h3>Templates</h3>
        <Button
          variant="primary"
          size="small"
          icon={<Plus size={14} />}
          onClick={() => setShowNewModal(true)}
        >
          New Template
        </Button>
      </div>

      {loading ? (
        <div className="template-loading">Loading templates...</div>
      ) : displayedTemplates.length === 0 ? (
        <div className="template-empty">
          <p>No templates yet. Create one to save time!</p>
        </div>
      ) : (
        <div className="templates-list">
          {displayedTemplates.map((template) => (
            <div key={template.id} className="template-item">
              <div
                className="template-item-header"
                onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
              >
                <div className="template-item-info">
                  <ChevronDown
                    size={16}
                    className={`expand-icon ${expandedId === template.id ? 'expanded' : ''}`}
                  />
                  <div className="template-details">
                    <h4 className="template-name">{template.name}</h4>
                    <p className="template-desc">{template.description}</p>
                  </div>
                </div>

                <div className="template-item-actions">
                  <span className="template-usage">Used {template.use_count || 0}x</span>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePublic(template.id, template.is_public);
                    }}
                    title={template.is_public ? 'Make private' : 'Share with team'}
                  >
                    {template.is_public ? (
                      <Globe size={16} />
                    ) : (
                      <Lock size={16} />
                    )}
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTemplateToDelete(template);
                      setShowDeleteModal(true);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {expandedId === template.id && (
                <div className="template-item-expanded">
                  <div className="template-preview">
                    {template.title_template && (
                      <div className="preview-row">
                        <span className="label">Title:</span>
                        <span className="value">{template.title_template}</span>
                      </div>
                    )}

                    {template.priority && (
                      <div className="preview-row">
                        <span className="label">Priority:</span>
                        <span className={`priority-badge ${template.priority}`}>
                          {template.priority}
                        </span>
                      </div>
                    )}

                    {template.subtasks?.length > 0 && (
                      <div className="preview-row">
                        <span className="label">Subtasks:</span>
                        <ul className="subtasks-list">
                          {template.subtasks.map((st, idx) => (
                            <li key={idx}>{st.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {template.assignee_ids?.length > 0 && (
                      <div className="preview-row">
                        <span className="label">Assignees:</span>
                        <span>{template.assignee_ids.length} assigned</span>
                      </div>
                    )}

                    {template.estimated_hours && (
                      <div className="preview-row">
                        <span className="label">Est. Hours:</span>
                        <span>{template.estimated_hours}h</span>
                      </div>
                    )}
                  </div>

                  <div className="template-actions">
                    <Button
                      variant="primary"
                      size="small"
                      icon={<Copy size={14} />}
                      onClick={() => handleUseTemplate(template)}
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Template"
        size="small"
      >
        <div className="delete-modal-content">
          <p>Are you sure you want to delete the template "{templateToDelete?.name}"?</p>
          <p className="delete-warning">This action cannot be undone.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDelete(templateToDelete.id)}
            >
              Delete Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TemplateManager;
