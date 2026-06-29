import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function useConfirm() {
  const [state, setState] = useState({ open: false });
  const resolverRef = useRef(null);

  const ask = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options.title || 'Xác nhận',
        message: options.message || '',
        confirmText: options.confirmText || 'Xác nhận',
        cancelText: options.cancelText || 'Hủy',
        variant: options.variant || 'danger'
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    setState({ open: false });
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  return { ask, state, handleClose };
}

export function ConfirmDialog({ state, onClose }) {
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open, onClose]);

  if (!state.open) return null;
  const confirmBtn =
    state.variant === 'danger'
      ? 'bg-rose-500 hover:bg-rose-600 text-white'
      : 'bg-indigo-500 hover:bg-indigo-600 text-white';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{state.title}</h3>
        {state.message && <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            {state.cancelText}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${confirmBtn}`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}