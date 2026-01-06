import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FolderKanban,
  CheckSquare,
  File,
  X,
  Loader2,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import useSearchStore from '../../store/searchStore';
import { format } from 'date-fns';
import './Search.css';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [localQuery, setLocalQuery] = useState('');

  const {
    query,
    results,
    loading,
    isOpen,
    setOpen,
    setQuery,
    search,
    clearSearch,
  } = useSearchStore();

  // Handle keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        clearSearch();
        setLocalQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setOpen, clearSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== query) {
        setQuery(localQuery);
        search(localQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery, setQuery, query, search]);

  const handleClose = () => {
    setOpen(false);
    clearSearch();
    setLocalQuery('');
  };

  const handleNavigate = (type, item) => {
    handleClose();
    // Navigate after closing to ensure clean state
    setTimeout(() => {
      if (type === 'project') {
        navigate(`/projects/${item.id}/board`);
      } else if (type === 'task') {
        navigate(`/projects/${item.project_id}/board?task=${item.id}`);
      } else if (type === 'file') {
        navigate(`/projects/${item.project_id}/board?tab=files`);
      }
    }, 100);
  };

  const hasResults = results.projects.length > 0 ||
    results.tasks.length > 0 ||
    results.files.length > 0;

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={handleClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <Search size={20} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, and files..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            className="search-input"
          />
          {loading ? (
            <Loader2 size={18} className="search-spinner" />
          ) : localQuery && (
            <button className="search-clear" onClick={() => setLocalQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>

        <div className="search-results">
          {!localQuery && (
            <div className="search-hint">
              <p>Type to search across all your projects</p>
              <div className="search-shortcut-hint">
                <kbd>Esc</kbd> to close
              </div>
            </div>
          )}

          {localQuery && loading && (
            <div className="search-loading">
              <Loader2 size={24} className="animate-spin" />
              <p>Searching...</p>
            </div>
          )}

          {localQuery && !loading && !hasResults && (
            <div className="search-empty">
              <Search size={32} />
              <p>No results found for "{localQuery}"</p>
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="search-section">
              <h3>Projects</h3>
              {results.projects.map((project) => (
                <div
                  key={project.id}
                  className="search-item"
                  onClick={() => handleNavigate('project', project)}
                >
                  <div
                    className="search-item-icon"
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                  >
                    <FolderKanban size={16} />
                  </div>
                  <div className="search-item-content">
                    <span className="search-item-title">{project.name}</span>
                    <span className="search-item-meta">
                      {project.description || 'No description'}
                    </span>
                  </div>
                  <ArrowRight size={16} className="search-item-arrow" />
                </div>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="search-section">
              <h3>Tasks</h3>
              {results.tasks.map((task) => (
                <div
                  key={task.id}
                  className="search-item"
                  onClick={() => handleNavigate('task', task)}
                >
                  <div className="search-item-icon">
                    <CheckSquare size={16} />
                  </div>
                  <div className="search-item-content">
                    <span className="search-item-title">{task.title}</span>
                    <span className="search-item-meta">
                      {task.project?.name}
                    </span>
                  </div>
                  <span className={`task-status-badge status-${task.status}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {results.files.length > 0 && (
            <div className="search-section">
              <h3>Files</h3>
              {results.files.map((file) => (
                <div
                  key={file.id}
                  className="search-item"
                  onClick={() => handleNavigate('file', file)}
                >
                  <div className="search-item-icon">
                    <File size={16} />
                  </div>
                  <div className="search-item-content">
                    <span className="search-item-title">{file.name}</span>
                    <span className="search-item-meta">
                      {file.project?.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="search-footer">
          <div className="search-shortcuts">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
