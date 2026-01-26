import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import './DeleteConfirmModal.css';

const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item?',
  isLoading = false,
  confirmText = 'Delete',
  variant = 'danger',
}) => {
  const variantStyles = {
    danger: 'danger',
    warning: 'warning',
    info: 'primary',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      showClose={!isLoading}
    >
      <div className="delete-confirm-content">
        <div className="delete-confirm-icon">
          <AlertTriangle size={48} />
        </div>
        <p className="delete-confirm-message">{message}</p>
        <div className="delete-confirm-actions">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={variantStyles[variant] || 'danger'}
            onClick={onConfirm}
            loading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteConfirmModal;
