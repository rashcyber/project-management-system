import React from 'react';
import './SkeletonLoader.css';

/**
 * Reusable Skeleton Loader Component
 * Provides shimmer animation for loading states
 *
 * Usage:
 * <SkeletonLoader type="project-card" count={3} />
 * <SkeletonLoader type="task-card" count={5} />
 * <SkeletonLoader type="comment" count={2} />
 */

export const SkeletonLoader = ({ type = 'project-card', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'project-card':
        return (
          <div className="skeleton skeleton-project-card">
            <div className="skeleton-project-color-bar" />
            <div className="skeleton-project-header">
              <div className="skeleton-text skeleton-title" />
              <div className="skeleton-icon" />
            </div>
            <div className="skeleton-project-description">
              <div className="skeleton-text" />
              <div className="skeleton-text" style={{ width: '80%' }} />
            </div>
            <div className="skeleton-project-footer">
              <div className="skeleton-avatars">
                <div className="skeleton-avatar" />
                <div className="skeleton-avatar" />
                <div className="skeleton-avatar" />
              </div>
              <div className="skeleton-button" />
            </div>
          </div>
        );

      case 'task-card':
        return (
          <div className="skeleton skeleton-task-card">
            <div className="skeleton-task-header">
              <div className="skeleton-text skeleton-title" />
              <div className="skeleton-badge" />
            </div>
            <div className="skeleton-task-content">
              <div className="skeleton-text" style={{ width: '90%' }} />
              <div className="skeleton-text" style={{ width: '70%' }} />
            </div>
            <div className="skeleton-task-footer">
              <div className="skeleton-avatar" style={{ width: '32px', height: '32px' }} />
              <div className="skeleton-text" style={{ width: '100px' }} />
            </div>
          </div>
        );

      case 'comment':
        return (
          <div className="skeleton skeleton-comment">
            <div className="skeleton-comment-header">
              <div className="skeleton-avatar" style={{ width: '40px', height: '40px' }} />
              <div className="skeleton-comment-info">
                <div className="skeleton-text skeleton-subtitle" />
                <div className="skeleton-text" style={{ width: '60%' }} />
              </div>
            </div>
            <div className="skeleton-comment-body">
              <div className="skeleton-text" />
              <div className="skeleton-text" />
              <div className="skeleton-text" style={{ width: '80%' }} />
            </div>
          </div>
        );

      case 'task-detail':
        return (
          <div className="skeleton skeleton-task-detail">
            <div className="skeleton-task-detail-header">
              <div className="skeleton-text skeleton-title" />
              <div className="skeleton-badges">
                <div className="skeleton-badge" />
                <div className="skeleton-badge" />
                <div className="skeleton-badge" />
              </div>
            </div>
            <div className="skeleton-task-detail-content">
              <div className="skeleton-text" />
              <div className="skeleton-text" />
              <div className="skeleton-text" style={{ width: '85%' }} />
            </div>
            <div className="skeleton-task-detail-section">
              <div className="skeleton-text skeleton-subtitle" />
              <div className="skeleton-avatar" style={{ width: '32px', height: '32px' }} />
            </div>
          </div>
        );

      case 'activity-item':
        return (
          <div className="skeleton skeleton-activity-item">
            <div className="skeleton-avatar" style={{ width: '36px', height: '36px' }} />
            <div className="skeleton-activity-content">
              <div className="skeleton-text skeleton-subtitle" />
              <div className="skeleton-text" style={{ width: '70%' }} />
            </div>
            <div className="skeleton-text skeleton-small" />
          </div>
        );

      default:
        return <div className="skeleton skeleton-default" />;
    }
  };

  return (
    <div className="skeleton-loader">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
