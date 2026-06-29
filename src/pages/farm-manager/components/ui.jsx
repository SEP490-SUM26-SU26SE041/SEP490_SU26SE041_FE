import React from 'react';
import { createPortal } from 'react-dom';

export const StatCard = ({ label, value, color = 'text-primary', sub }) => (
  <div className="bg-white border border-outline-variant p-4 lg:p-6 rounded-xl flex flex-col gap-1 lg:gap-2 transition-transform hover:-translate-y-1 shadow-sm">
    <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
    <span className={`font-hanken text-2xl lg:text-4xl font-bold ${color}`}>{value}</span>
    {sub && <span className="text-[10px] text-on-surface-variant">{sub}</span>}
  </div>
);

export const SectionTitle = ({ title, description, action }) => (
  <div className="flex justify-between items-end gap-4">
    <div>
      <h3 className="font-hanken text-lg lg:text-2xl font-bold text-on-surface">{title}</h3>
      {description && <p className="text-[10px] lg:text-sm text-on-surface-variant mt-1">{description}</p>}
    </div>
    {action}
  </div>
);

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-outline-variant rounded-xl shadow-sm ${className}`}>
    {children}
  </div>
);

export const EmptyState = ({ message = 'Không có dữ liệu', icon }) => (
  <div className="py-12 flex flex-col items-center text-on-surface-variant gap-3">
    {icon || (
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
    )}
    <span className="text-xs font-medium">{message}</span>
  </div>
);

export const StatusPill = ({ status }) => {
  const map = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-rose-100 text-rose-700',
    Cancelled: 'bg-slate-100 text-slate-600',
    Available: 'bg-emerald-100 text-emerald-700',
    InUse: 'bg-primary-container text-primary',
    Maintenance: 'bg-orange-100 text-orange-700',
    Unavailable: 'bg-rose-100 text-rose-700',
    Active: 'bg-emerald-100 text-emerald-700',
    Draft: 'bg-slate-100 text-slate-600',
    Completed: 'bg-emerald-100 text-emerald-700',
    Low: 'bg-slate-100 text-slate-600',
    Medium: 'bg-amber-100 text-amber-700',
    High: 'bg-rose-100 text-rose-700',
    Occupied: 'bg-primary-container text-primary'
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status || 'N/A'}
    </span>
  );
};

export const LoadingRows = ({ cols = 5, rows = 4 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-b border-outline-variant">
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className="px-6 py-4">
            <div className="h-3 bg-surface-container rounded animate-pulse" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

export const PrimaryButton = ({ children, onClick, type = 'button', disabled, icon, className = '' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`bg-primary hover:bg-[#3d5728] text-white px-6 py-3.5 rounded-xl flex items-center gap-2 font-bold text-[10px] tracking-wider uppercase shadow-md transition-all active:scale-95 disabled:opacity-50 ${className}`}
  >
    {icon}
    {children}
  </button>
);

export const OutlineButton = ({ children, onClick, type = 'button', disabled, icon, className = '' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2.5 bg-white text-[#1a1c1c] border border-[#c4c8ba] rounded-xl hover:bg-[#e8e8e7] transition-all text-[10px] font-bold uppercase tracking-wider shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2 ${className}`}
  >
    {icon}
    {children}
  </button>
);

export const DangerButton = ({ children, onClick, type = 'button', disabled, icon }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] tracking-wider uppercase shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
  >
    {icon}
    {children}
  </button>
);

export const Input = ({ label, error, required, hint, ...rest }) => (
  <div className="col-span-1">
    {label && (
      <label className="block text-xs font-bold text-on-surface-variant mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
    )}
    <input
      {...rest}
      className={`w-full px-3 py-2 border rounded-lg outline-none bg-white text-on-surface transition-colors ${
        error
          ? 'border-rose-400 focus:ring-2 focus:ring-rose-100 focus:border-rose-500'
          : 'border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary'
      } ${rest.className || ''}`}
    />
    {error ? (
      <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-fade-in">
        <ErrorIcon /> {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-[11px] text-on-surface-variant">{hint}</p>
    ) : null}
  </div>
);

export const Textarea = ({ label, error, required, hint, ...rest }) => (
  <div className="col-span-1">
    {label && (
      <label className="block text-xs font-bold text-on-surface-variant mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
    )}
    <textarea
      {...rest}
      className={`w-full px-3 py-2 border rounded-lg outline-none bg-white text-on-surface transition-colors resize-none ${
        error
          ? 'border-rose-400 focus:ring-2 focus:ring-rose-100 focus:border-rose-500'
          : 'border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary'
      } ${rest.className || ''}`}
    />
    {error ? (
      <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-fade-in">
        <ErrorIcon /> {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-[11px] text-on-surface-variant">{hint}</p>
    ) : null}
  </div>
);

export const Select = ({ label, error, required, hint, children, ...rest }) => (
  <div className="col-span-1">
    {label && (
      <label className="block text-xs font-bold text-on-surface-variant mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
    )}
    <select
      {...rest}
      className={`w-full px-3 py-2 border rounded-lg outline-none bg-white text-on-surface transition-colors ${
        error
          ? 'border-rose-400 focus:ring-2 focus:ring-rose-100 focus:border-rose-500'
          : 'border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary'
      } ${rest.className || ''}`}
    >
      {children}
    </select>
    {error ? (
      <p className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-fade-in">
        <ErrorIcon /> {error}
      </p>
    ) : hint ? (
      <p className="mt-1 text-[11px] text-on-surface-variant">{hint}</p>
    ) : null}
  </div>
);

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);

export const Modal = ({ open, onClose, title, children, width = 'max-w-2xl' }) => {
  if (!open) return null;
  
  const modalContent = (
    <div 
      className="fixed z-[9999]"
      style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100vh', width: '100vw', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full ${width} flex flex-col`}
        style={{ maxHeight: '95vh', boxSizing: 'border-box' }}
      >
        {title !== null && (
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
            <h3 className="font-hanken font-bold text-lg text-primary">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
  
  return createPortal(modalContent, document.body);
};
