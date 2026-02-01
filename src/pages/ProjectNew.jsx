import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palette } from 'lucide-react';
import { Button, Input } from '../components/common';
import useProjectStore from '../store/projectStore';
import { toast } from '../store/toastStore';
import './ProjectNew.css';

const PROJECT_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#a855f7', // Violet
  '#d946ef', // Fuchsia
  '#0891b2', // Cyan-dark
  '#059669', // Emerald
  '#7c3aed', // Violet-dark
  '#db2777', // Rose
  '#ea580c', // Orange-dark
  '#4f46e5', // Indigo-dark
  '#1e40af', // Blue-dark
  '#991b1b', // Red-dark
];

const ProjectNew = () => {
  const navigate = useNavigate();
  const { createProject, loading } = useProjectStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
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

  const handleColorSelect = (color) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const { data, error, queued } = await createProject({
      name: formData.name.trim(),
      description: formData.description.trim(),
      color: formData.color,
    });

    if (error) {
      toast.error(error.message || 'Failed to create project');
      return;
    }

    if (queued) {
      toast.success('Project queued! Will be created when you\'re back online.');
      navigate('/projects');
      return;
    }

    toast.success('Project created successfully!');
    navigate(`/projects/${data.id}/board`);
  };

  return (
    <div className="project-new-page">
      <div className="project-new-container">
        {/* Header */}
        <div className="project-new-header">
          <button className="back-btn" onClick={() => navigate('/projects')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>Create New Project</h1>
            <p>Set up a new project for your team</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-card">
            <h2>Project Details</h2>

            <Input
              label="Project Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter project name"
              error={errors.name}
              required
            />

            <div className="input-group">
              <label className="input-label">Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe what this project is about..."
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

            <div className="color-selector">
              <label className="input-label">
                <Palette size={16} />
                Project Color
              </label>
              <div className="color-options">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-option ${formData.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="project-preview">
              <label className="input-label">Preview</label>
              <div className="preview-card">
                <div
                  className="preview-color-bar"
                  style={{ backgroundColor: formData.color }}
                />
                <div className="preview-content">
                  <h3>{formData.name || 'Project Name'}</h3>
                  <p>{formData.description || 'Project description will appear here...'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/projects')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectNew;
