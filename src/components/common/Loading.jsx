import React from 'react';
import './Loading.css';

const Loading = ({ fullscreen = false, size = 'medium', text = '' }) => {
  if (fullscreen) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-content">
          <div className={`loading-spinner loading-${size}`}></div>
          {text && <p className="loading-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-inline">
      <div className={`loading-spinner loading-${size}`}></div>
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
};

export default Loading;
