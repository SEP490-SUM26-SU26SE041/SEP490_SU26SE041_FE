import React from 'react';

/**
 * Modal xác nhận custom — thay thế window.confirm() và window.alert().
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onConfirm: () => void  (nếu không truyền thì modal chỉ OK để đóng — dùng cho alert)
 *  - title: string
 *  - message: ReactNode (có thể là string hoặc JSX)
 *  - confirmText?: string (mặc định "Xác nhận")
 *  - cancelText?: string (mặc định "Hủy")
 *  - variant?: 'danger' | 'primary' | 'warning' (đổi màu nút confirm)
 *  - icon?: string (emoji, mặc định theo variant)
 *  - hideCancel?: boolean (true → chỉ hiện nút OK, dùng cho alert)
 */
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'primary',
  icon,
  hideCancel = false
}) => {
  if (!open) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      icon: '⚠️',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
      glow: 'shadow-rose-500/20'
    },
    warning: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      icon: '⚠️',
      btn: 'bg-amber-500 hover:bg-amber-600 text-white',
      glow: 'shadow-amber-500/20'
    },
    primary: {
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      icon: '🌾',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      glow: 'shadow-emerald-500/20'
    }
  };

  const style = variantStyles[variant] || variantStyles.primary;
  const displayIcon = icon || style.icon;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose?.();
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose?.();
    if (e.key === 'Enter' && !hideCancel) handleConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 ${style.glow}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-full ${style.iconBg} ${style.iconColor} flex items-center justify-center text-xl font-bold`}>
            {displayIcon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base">
              {title || 'Xác nhận'}
            </h3>
            <div className="mt-1.5 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
              {message}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 hover:bg-slate-200 rounded-lg text-slate-500"
            aria-label="Đóng"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            autoFocus
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm ${style.btn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

/**
 * Hook tiện ích dùng thay thế window.confirm/window.alert.
 * Trả về { confirm, ConfirmModalElement, alert: confirm ở chế độ hideCancel }.
 *
 * Ví dụ:
 *   const { confirm, ConfirmEl } = useConfirm();
 *   const handleDelete = () => confirm({ title: 'Xóa?', message: '...', variant: 'danger',
 *     onConfirm: () => { ... } });
 *   return (<>{ConfirmEl}...);
 */
export function useConfirm() {
  const [state, setState] = React.useState(null);

  const open = (cfg) => setState({ ...cfg, open: true });
  const close = () => setState(s => (s ? { ...s, open: false } : s));

  const confirm = (cfg) => {
    open({ ...cfg, hideCancel: cfg?.hideCancel || false });
  };

  const ConfirmEl = (
    <ConfirmModal
      {...state}
      onClose={close}
      onConfirm={state?.onConfirm}
    />
  );

  return { confirm, close, ConfirmEl, state };
}