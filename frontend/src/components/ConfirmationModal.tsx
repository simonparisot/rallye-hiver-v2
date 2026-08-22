import React from 'react';
import './ConfirmationModal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'danger' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" data-testid="confirmation-modal-overlay" onClick={onCancel}>
      <div className={`modal-content modal-${variant}`} data-testid="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" data-testid="confirmation-modal-title">{title}</h2>
        <p className="modal-message" data-testid="confirmation-modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" data-testid="confirmation-modal-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`btn btn-${variant}`} data-testid="confirmation-modal-confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
