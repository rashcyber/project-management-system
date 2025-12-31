import React from 'react';
import './Avatar.css';

const Avatar = ({ src, name, size = 'medium', className = '' }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getColorFromName = (name) => {
    if (!name) return '#94a3b8';
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16',
      '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`avatar avatar-${size} ${className}`}
      />
    );
  }

  return (
    <div
      className={`avatar avatar-${size} avatar-initials ${className}`}
      style={{ backgroundColor: getColorFromName(name) }}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
