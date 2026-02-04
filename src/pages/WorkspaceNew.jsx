import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/common';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import './WorkspaceNew.css';

const WorkspaceNew = () => {
  const navigate = useNavigate();
  const { createWorkspace } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Workspace name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Workspace name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Workspace name must be less than 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    const { data, error } = await createWorkspace({
      name: formData.name.trim(),
      description: formData.description.trim(),
    });

    if (error) {
      toast.error(error.message || 'Failed to create workspace');
      setLoading(false);
      return;
    }

    toast.success('Workspace created successfully!');
    navigate('/dashboard');
  };

  return (
    <div className="workspace-new-page">
      <div className="workspace-new-container">
        {/* Header */}
        <div className="workspace-new-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>Create Your Workspace</h1>
            <p>Set up your workspace to get started</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="workspace-form">
          <div className="form-card">
            <h2>Workspace Details</h2>

            <Input
              label="Workspace Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter workspace name"
              error={errors.name}
              required
            />

            <div className="input-group">
              <label className="input-label">Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your workspace..."
                className={`textarea ${errors.description ? 'error' : ''}`}
                rows={4}
              />
              {errors.description && (
                <span className="input-error">{errors.description}</span>
              )}
              <span className="char-count">
                {formData.description.length}/500
              </span>
            </div>

            {/* Preview */}
            <div className="workspace-preview">
              <label className="input-label">Preview</label>
              <div className="preview-card">
                <div className="preview-content">
                  <h3>{formData.name || 'Workspace Name'}</h3>
                  <p>{formData.description || 'Workspace description will appear here...'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkspaceNew;
