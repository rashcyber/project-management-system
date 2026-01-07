import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSearchStore from '../store/searchStore';
import { toast } from '../store/toastStore';

// Keyboard shortcut definitions
const SHORTCUTS = [
  { key: 'k', ctrl: true, description: 'Open search', category: 'Global' },
  { key: 'Escape', description: 'Close modal / Clear selection', category: 'Global' },
  { key: 'n', ctrl: true, shift: true, description: 'Create new project', category: 'Global' },
  { key: '/', description: 'Focus search in board', category: 'Board' },
  { key: 'b', ctrl: true, description: 'Toggle batch selection mode', category: 'Board' },
  { key: 'Delete', description: 'Delete selected task(s)', category: 'Board', requiresSelection: true },
  { key: 'c', description: 'Complete selected task(s)', category: 'Board', requiresSelection: true },
  { key: '1', description: 'Navigate to Dashboard', category: 'Navigation' },
  { key: '2', description: 'Navigate to Projects', category: 'Navigation' },
  { key: '3', description: 'Navigate to My Tasks', category: 'Navigation' },
  { key: '4', description: 'Navigate to Calendar', category: 'Navigation' },
  { key: '?', description: 'Show keyboard shortcuts', category: 'Help' },
];

const useKeyboardShortcuts = (options = {}) => {
  const {
    onSearchOpen,
    onBatchModeToggle,
    onDeleteSelected,
    onCompleteSelected,
    onFocusSearch,
    onShowHelp,
    isBatchMode = false,
    hasSelection = false,
    canDelete = false,
    canComplete = false,
  } = options;

  const navigate = useNavigate();
  const { setOpen: openSearch } = useSearchStore();

  const handleKeyDown = useCallback((e) => {
    const { key, ctrlKey, metaKey, shiftKey, altKey } = e;

    // Ignore if typing in input/textarea
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.isContentEditable
    ) {
      // But allow specific shortcuts in inputs
      if (key === 'Escape' || (ctrlKey && key === 'a')) {
        // Allow Escape and Ctrl+A
      } else {
        return;
      }
    }

    // Ignore if modifier keys are pressed (except Ctrl/Meta for combos)
    if (altKey) return;

    const isModKey = ctrlKey || metaKey;

    // Global shortcuts
    if (isModKey && key === 'k') {
      e.preventDefault();
      openSearch(true);
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      if (isBatchMode) {
        onBatchModeToggle?.();
      }
      return;
    }

    if (isModKey && shiftKey && key === 'n') {
      e.preventDefault();
      navigate('/projects/new');
      return;
    }

    // Help shortcut
    if (key === '?') {
      e.preventDefault();
      onShowHelp?.();
      return;
    }

    // Board shortcuts
    if (key === '/' && !isModKey && !e.target.matches('input, textarea')) {
      e.preventDefault();
      onFocusSearch?.();
      return;
    }

    if (isModKey && key === 'b') {
      e.preventDefault();
      onBatchModeToggle?.();
      return;
    }

    if (key === 'Delete' && !isModKey && hasSelection && canDelete) {
      e.preventDefault();
      onDeleteSelected?.();
      return;
    }

    if ((key === 'c' || key === 'C') && !isModKey && hasSelection && canComplete) {
      e.preventDefault();
      onCompleteSelected?.();
      return;
    }

    // Navigation shortcuts
    if (key === '1' && !isModKey && !shiftKey && !e.target.matches('input, textarea')) {
      e.preventDefault();
      navigate('/dashboard');
      return;
    }

    if (key === '2' && !isModKey && !shiftKey && !e.target.matches('input, textarea')) {
      e.preventDefault();
      navigate('/projects');
      return;
    }

    if (key === '3' && !isModKey && !shiftKey && !e.target.matches('input, textarea')) {
      e.preventDefault();
      navigate('/tasks');
      return;
    }

    if (key === '4' && !isModKey && !shiftKey && !e.target.matches('input, textarea')) {
      e.preventDefault();
      navigate('/calendar');
      return;
    }
  }, [navigate, openSearch, isBatchMode, hasSelection, canDelete, canComplete, onBatchModeToggle, onDeleteSelected, onCompleteSelected, onFocusSearch]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts: SHORTCUTS };
};

export default useKeyboardShortcuts;
