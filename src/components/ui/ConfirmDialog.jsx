import { useState } from 'react';

export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Xóa', cancelText = 'Hủy', danger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[5000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
        <div className="p-6">
          <div className={`w-12 h-12 rounded-full ${danger ? 'bg-rose-100' : 'bg-indigo-100'} flex items-center justify-center mx-auto mb-4`}>
            <span className={`text-2xl ${danger ? 'text-rose-500' : 'text-indigo-500'}`}>
              {danger ? '⚠️' : '💡'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-center text-on-surface mb-2">{title}</h3>
          <p className="text-sm text-on-surface-variant text-center mb-6">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-on-surface rounded-xl text-sm font-semibold transition-colors">
              {cancelText}
            </button>
            <button onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors ${
                danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-500 hover:bg-indigo-600'
              }`}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
