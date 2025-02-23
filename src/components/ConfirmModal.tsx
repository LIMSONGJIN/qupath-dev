// ConfirmModal.tsx
import React from 'react';

interface ConfirmModalProps {
  visible: boolean;
  message: string;
  onConfirm: () => void; // Yes 클릭 시 동작
  onCancel: () => void; // No 클릭 시 동작
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ visible, message, onConfirm, onCancel }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '300px',
          textAlign: 'center',
          pointerEvents: 'auto', // 모달 자체도 클릭 가능
        }}
      >
        <p>{message}</p>
        <button onClick={onConfirm} style={{ marginRight: '10px' }}>
          Yes
        </button>
        <button onClick={onCancel}>No</button>
      </div>
    </div>
  );
};

export default ConfirmModal;
