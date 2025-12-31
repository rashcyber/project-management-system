import React, { useState, useRef, useEffect } from 'react';
import { Avatar } from './index';
import './MentionInput.css';

const MentionInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type @ to mention someone...',
  members = [],
  className = '',
  rows = 3,
  disabled = false,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    // Check for @ symbol and show suggestions
    const text = value;
    const position = cursorPosition;

    // Find the last @ before cursor
    let atIndex = -1;
    for (let i = position - 1; i >= 0; i--) {
      if (text[i] === '@') {
        // Check if there's a space or start of text before @
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          atIndex = i;
          break;
        }
      }
      // Stop if we hit a space
      if (text[i] === ' ' || text[i] === '\n') {
        break;
      }
    }

    if (atIndex !== -1) {
      const query = text.substring(atIndex + 1, position).toLowerCase();
      setMentionQuery(query);

      // Filter members based on query
      const filtered = members.filter((member) => {
        const name = (member.user?.full_name || member.full_name || '').toLowerCase();
        const email = (member.user?.email || member.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
      });

      setSuggestions(filtered.slice(0, 5));
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [value, cursorPosition, members]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setCursorPosition(e.target.selectionStart);
  };

  const handleKeyDown = (e) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && suggestions.length > 0) {
        e.preventDefault();
        selectMention(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const selectMention = (member) => {
    const name = member.user?.full_name || member.full_name || 'Unknown';
    const text = value;
    const position = cursorPosition;

    // Find the @ symbol position
    let atIndex = -1;
    for (let i = position - 1; i >= 0; i--) {
      if (text[i] === '@') {
        atIndex = i;
        break;
      }
    }

    if (atIndex !== -1) {
      const before = text.substring(0, atIndex);
      const after = text.substring(position);
      const newValue = `${before}@${name} ${after}`;

      onChange(newValue);
      setShowSuggestions(false);

      // Set cursor after the mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = atIndex + name.length + 2;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  return (
    <div className={`mention-input-wrapper ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onSelect={(e) => setCursorPosition(e.target.selectionStart)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="mention-textarea"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="mention-suggestions">
          {suggestions.map((member, index) => {
            const user = member.user || member;
            return (
              <div
                key={user.id || index}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => selectMention(member)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Avatar
                  src={user.avatar_url}
                  name={user.full_name}
                  size="small"
                />
                <div className="suggestion-info">
                  <span className="suggestion-name">{user.full_name || 'Unknown User'}</span>
                  <span className="suggestion-email">{user.email}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onSubmit && (
        <div className="mention-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for new line
        </div>
      )}
    </div>
  );
};

export default MentionInput;
