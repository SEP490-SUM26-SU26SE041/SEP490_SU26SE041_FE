import React, { useState, useRef, useEffect } from 'react';
import chatStorage from '../../storage/chatStorage';
import ConfirmModal from './ConfirmModal';

/**
 * Sidebar liệt kê các cuộc hội thoại RAG (giống ChatGPT).
 *
 * - Click vào cuộc → switchConversation(id)
 * - Nút 3 chấm (⋯) bên phải mở menu: ✏️ Đổi tên / 🗑 Xóa
 * - Auto-group theo ngày (Today / Yesterday / ... / older)
 * - Nút "+" New chat ở top
 */
const ConversationSidebar = ({
  conversations = [],
  currentId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClearAll
}) => {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null); // id cần confirm xóa
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);

  // Đóng menu khi click bên ngoài
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  // Focus input khi vào chế độ rename
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (conv) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title);
    setMenuOpenId(null);
  };

  const confirmRename = (id) => {
    if (renameValue.trim()) {
      onRename?.(id, renameValue);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDelete = (id) => {
    setMenuOpenId(null);
    const conv = conversations.find(c => c.id === id);
    setPendingDelete({ id, title: conv?.title || 'cuộc này' });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onDelete?.(pendingDelete.id);
    setPendingDelete(null);
  };

  const confirmClearAll = () => {
    onClearAll?.();
    setPendingClearAll(false);
  };

  // Nhóm conversation theo ngày
  const grouped = groupByDay(conversations);

  return (
    <>
      <aside className="w-full md:w-60 lg:w-72 shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col h-full max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-green-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              💬 Hội thoại
            </h3>
            <span className="text-[10px] text-slate-500">
              {conversations.length} cuộc
            </span>
          </div>
        {/* New chat button */}
        <button
          type="button"
          onClick={onNew}
          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
        >
          ➕ Cuộc hội thoại mới
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-400">
            Chưa có cuộc hội thoại nào.
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label} className="py-1">
              <div className="px-3 py-1 text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                {group.label}
              </div>
              <ul>
                {group.convs.map(c => {
                  const isCurrent = c.id === currentId;
                  const isRenaming = renamingId === c.id;
                  return (
                    <li key={c.id} className="relative group/item">
                      <div
                        className={`flex items-center gap-1 mx-1 rounded-lg transition-colors ${
                          isCurrent ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {isRenaming ? (
                          <div className="flex-1 px-2 py-1.5 flex items-center gap-1">
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmRename(c.id);
                                else if (e.key === 'Escape') cancelRename();
                              }}
                              onBlur={() => confirmRename(c.id)}
                              className="flex-1 px-1.5 py-0.5 text-xs border border-emerald-300 rounded outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                            />
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onSelect?.(c.id)}
                              className="flex-1 text-left px-2.5 py-1.5 text-xs min-w-0"
                              title={c.title}
                            >
                              <div className={`truncate ${isCurrent ? 'font-bold' : 'font-medium'}`}>
                                💭 {c.title}
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(c.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </button>

                            {/* ⋯ menu button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === c.id ? null : c.id);
                              }}
                              className={`p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 ${
                                isCurrent ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'
                              } transition-opacity`}
                              title="Hành động"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Dropdown menu */}
                      {menuOpenId === c.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-2 top-full mt-0.5 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => startRename(c)}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            ✏️ Đổi tên
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                          >
                            🗑 Xóa
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Footer — nút "Xóa tất cả" đã ẩn vì không xóa được */}
    </aside>

    {/* Modal xác nhận xóa 1 cuộc */}
    <ConfirmModal
      open={!!pendingDelete}
      onClose={() => setPendingDelete(null)}
      onConfirm={confirmDelete}
      variant="danger"
      icon="🗑"
      title="Xóa cuộc hội thoại?"
      message={pendingDelete ? (
        <>
          Cuộc hội thoại <strong className="text-slate-900">"{pendingDelete.title}"</strong> sẽ bị xóa vĩnh viễn.
          <br />
          <span className="text-rose-600 font-bold">Hành động này không thể hoàn tác.</span>
        </>
      ) : ''}
      confirmText="Xóa vĩnh viễn"
      cancelText="Giữ lại"
    />

    {/* Modal xác nhận xóa tất cả */}
    <ConfirmModal
      open={pendingClearAll}
      onClose={() => setPendingClearAll(false)}
      onConfirm={confirmClearAll}
      variant="danger"
      icon="💥"
      title={`Xóa toàn bộ ${conversations.length} cuộc hội thoại?`}
      message={(
        <>
          Tất cả cuộc hội thoại và lịch sử chat sẽ bị xóa vĩnh viễn.
          <br />
          <span className="text-rose-600 font-bold">Không thể khôi phục sau khi xóa.</span>
        </>
      )}
      confirmText="Xóa tất cả"
      cancelText="Hủy"
    />
    </>
  );
};

// ── Group conversations by day label ───────────────────────────────────────────
function groupByDay(convs) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {
    'Hôm nay': [],
    'Hôm qua': [],
    'Tuần này': [],
    'Cũ hơn': []
  };

  for (const c of convs) {
    const d = new Date(c.updatedAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) {
      groups['Hôm nay'].push(c);
    } else if (d.getTime() === yesterday.getTime()) {
      groups['Hôm qua'].push(c);
    } else if (d.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
      groups['Tuần này'].push(c);
    } else {
      groups['Cũ hơn'].push(c);
    }
  }

  return Object.entries(groups)
    .filter(([_, list]) => list.length > 0)
    .map(([label, convs]) => ({ label, convs }));
}

export default ConversationSidebar;