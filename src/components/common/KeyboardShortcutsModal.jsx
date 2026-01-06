import React from 'react';
import { X, Command } from 'lucide-react';
import { Button, Modal } from '../common';
import './KeyboardShortcutsModal.css';

const KeyboardShortcutsModal = ({ isOpen, onClose }) => {
  const shortcuts = [
    {
      category: 'Global',
      items: [
        { keys: ['Ctrl', 'K'], description: 'Open search' },
        { keys: ['Ctrl', 'N'], description: 'Create new project' },
        { keys: ['Esc'], description: 'Close modal / Clear selection' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { keys: ['1'], description: 'Navigate to Dashboard' },
        { keys: ['2'], description: 'Navigate to Projects' },
        { keys: ['3'], description: 'Navigate to My Tasks' },
        { keys: ['4'], description: 'Navigate to Calendar' },
      ],
    },
    {
      category: 'Board',
      items: [
        { keys: ['/'], description: 'Focus search in board' },
        { keys: ['Ctrl', 'B'], description: 'Toggle batch selection mode' },
        { keys: ['C'], description: 'Complete selected task(s)' },
        { keys: ['Delete'], description: 'Delete selected task(s)' },
      ],
    },
  ];

  const renderKey = (key) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const displayKey = key === 'Ctrl' && isMac ? '⌘' : key === 'Ctrl' ? 'Ctrl' : key;

    return (
      <kbd key={key} className="shortcut-key">
        {displayKey}
      </kbd>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="medium">
      <div className="keyboard-shortcuts-modal">
        <p className="shortcuts-intro">
          Use these keyboard shortcuts to navigate and perform actions quickly.
        </p>

        <div className="shortcuts-list">
          {shortcuts.map((section) => (
            <div key={section.category} className="shortcuts-section">
              <h3 className="shortcuts-category">{section.category}</h3>
              <div className="shortcuts-items">
                {section.items.map((item, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {item.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {renderKey(key)}
                          {keyIndex < item.keys.length - 1 && (
                            <span className="key-separator">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="shortcut-description">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
