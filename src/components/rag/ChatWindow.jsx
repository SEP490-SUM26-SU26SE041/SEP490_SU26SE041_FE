import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import KnowledgeGroupFilter from './KnowledgeGroupFilter';
import ConversationSidebar from './ConversationSidebar';
import ConfirmModal from './ConfirmModal';
import useRagChat from '../../hooks/useRagChat';

/**
 * Chat window cho Student & Technician — Multi-Conversation (giống ChatGPT).
 *
 * Props:
 *  - enableRetrievalOnly: true → hiện toggle "Chỉ truy xuất" (mặc định true từ v1.3, dùng cho mọi role)
 *  - defaultKnowledgeGroup: group mặc định
 *  - title, subtitle: tiêu đề
 *  - scope: key localStorage ('student' | 'technician' | 'researcher' | 'default')
 */
const ChatWindow = ({
  enableRetrievalOnly = true,
  defaultKnowledgeGroup = null,
  title = '🌾 Trợ Lý AI Nông Nghiệp',
  subtitle = 'Hỏi đáp dựa trên tài liệu nông nghiệp đã index.',
  scope = 'default'
}) => {
  const {
    conversation,
    conversations,
    messages,
    loading,
    send,
    newConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    refreshIndex,
    knowledgeGroup,
    setKnowledgeGroup,
    retrievalOnly,
    setRetrievalOnly,
    healthOk
  } = useRagChat({
    initialKnowledgeGroup: defaultKnowledgeGroup,
    enableRetrievalOnly,
    scope
  });

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pendingNewChat, setPendingNewChat] = useState(false);
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const scrollRef = useRef(null);

  // Auto scroll xuống cuối khi có message mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, conversation?.id]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || loading || !conversation) return;
    setInput('');
    send(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    if (loading) return;
    if (messages.length > 0) {
      setPendingNewChat(true);
      return;
    }
    newConversation();
    setInput('');
  };

  const confirmNewChat = () => {
    newConversation();
    setInput('');
    setShowSettings(false);
  };

  const handleClearAll = () => {
    newConversation(); // tạo mới sau khi xóa hết
    refreshIndex();
  };

  const confirmClearAll = () => {
    handleClearAll();
    setShowSettings(false);
  };

  const healthWarn = healthOk === false;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3 h-full">
        {/* Sidebar conversation */}
      <ConversationSidebar
        conversations={conversations}
        currentId={conversation?.id}
        onSelect={switchConversation}
        onNew={handleNewChat}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onClearAll={handleClearAll}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-[500px]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-green-50">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="truncate">{conversation?.title || title}</span>
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {conversation?.messages?.length
                  ? `${conversation.messages.length} tin nhắn · ${subtitle}`
                  : subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                healthOk === true ? 'bg-emerald-100 text-emerald-700' :
                healthOk === false ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {healthOk === true ? '🟢 Trực tuyến' :
                 healthOk === false ? '🔴 Mất kết nối' : '⚪ Đang kiểm tra…'}
              </span>
              {/* 🆕 Nút chat mới */}
              <button
                type="button"
                onClick={handleNewChat}
                disabled={loading}
                title="Tạo cuộc hội thoại mới (cuộc hiện tại sẽ được lưu)"
                className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                🆕 <span className="hidden sm:inline">Mới</span>
              </button>
              {/* ⚙ Cài đặt */}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="Cài đặt chat"
                className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                ⚙ <span className="hidden sm:inline">Cài đặt</span>
              </button>
            </div>
          </div>

          {/* Health warning banner */}
          {healthWarn && (
            <div className="mt-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
              ⚠️ Không kết nối được RAG server. Có thể do Render free plan đang ngủ (sleep sau 15 phút không hoạt động).
              Vui lòng thử lại sau 30 giây.
            </div>
          )}

        {/* Filters */}
          <div className="mt-3">
            <KnowledgeGroupFilter value={knowledgeGroup} onChange={setKnowledgeGroup} />
          </div>

          {/* Retrieval-only toggle (Technician) */}
          {enableRetrievalOnly && (
            <label className="flex items-center gap-2 mt-1 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!retrievalOnly}
                onChange={e => setRetrievalOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-600"
              />
              <span className="font-bold text-slate-700">
                🔍 Chỉ truy xuất tài liệu gốc
              </span>
              <span className="text-[10px] text-slate-500">— xem nguyên văn đoạn trích, không qua AI tổng hợp</span>
            </label>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/40 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🌾</p>
              <p className="text-sm font-semibold">Bắt đầu hỏi đáp nông nghiệp</p>
              <p className="text-[11px] mt-1 max-w-sm mx-auto">
                Ví dụ: "Cách phòng bệnh đạo ôn trên lúa?", "Cây cà chua cần bao nhiêu nước mỗi ngày?"
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {[
                  'Phòng bệnh đạo ôn trên lúa?',
                  'Liều lượng phân bón cho cà chua?',
                  'Chăm sóc lúa giai đoạn trổ bông?'
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-[11px] px-3 py-1 rounded-full border border-slate-200 bg-white hover:border-emerald-400 hover:text-emerald-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => <MessageBubble key={`${conversation?.id}-${i}`} msg={m} />)}

          {loading && (
            <div className="flex justify-start mb-3">
              <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] text-slate-500 italic">AI đang suy nghĩ…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                knowledgeGroup
                  ? `Hỏi về nhóm ${knowledgeGroup}…`
                  : 'Hỏi về cây trồng, sâu bệnh, kỹ thuật canh tác…'
              }
              rows={2}
              disabled={loading || !conversation}
              className="flex-1 resize-none px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim() || !conversation}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center gap-1 transition-colors"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                </svg>
              ) : (
                <>📤 <span className="hidden sm:inline">Gửi</span></>
              )}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>Enter để gửi · Shift+Enter để xuống dòng</span>
            <span>{messages.length} tin nhắn trong cuộc này</span>
          </div>
        </div>
      </div>

      {/* ⚙ Modal cài đặt */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                ⚙ Cài đặt Chat
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Thông tin phiên</p>
                <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 shrink-0">Cuộc hiện tại:</span>
                    <span className="font-mono text-slate-700 truncate text-right">{conversation?.id?.slice(-8) || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 shrink-0">Tiêu đề:</span>
                    <span className="font-bold text-slate-700 truncate text-right">{conversation?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tổng cuộc:</span>
                    <span className="font-bold text-slate-700">{conversations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tin nhắn:</span>
                    <span className="font-bold text-slate-700">{messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Server:</span>
                    <span className={`font-bold ${
                      healthOk === true ? 'text-emerald-600' :
                      healthOk === false ? 'text-rose-600' : 'text-slate-500'
                    }`}>
                      {healthOk === true ? '🟢 Online' :
                       healthOk === false ? '🔴 Offline' : '⚪ Checking…'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Nhóm tri thức</p>
                <KnowledgeGroupFilter value={knowledgeGroup} onChange={setKnowledgeGroup} compact />
              </div>

              {enableRetrievalOnly && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Chế độ truy vấn</p>
                  <label className="flex items-start gap-2 text-xs cursor-pointer p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={!!retrievalOnly}
                      onChange={e => setRetrievalOnly(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-amber-600"
                    />
                    <div>
                      <p className="font-bold text-amber-800">🔍 Chỉ truy xuất tài liệu gốc (retrieval-only)</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">
                        Không gọi AI tổng hợp — chỉ trả về các đoạn trích nguyên văn từ tài liệu đã index.
                        Phù hợp khi cần tham khảo văn bản gốc để kiểm chứng.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase text-slate-500">Hành động</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    disabled={loading}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 disabled:bg-slate-50 disabled:text-slate-400 text-blue-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    🆕 Cuộc mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingClearAll(true)}
                    disabled={conversations.length === 0}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-50 disabled:text-slate-400 text-rose-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    🗑 Xóa tất cả
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500">
              💾 Mỗi cuộc hội thoại được lưu vào localStorage với key <code className="font-mono">rag_conv_&lt;id&gt;</code>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Modal xác nhận tạo cuộc mới */}
      <ConfirmModal
        open={pendingNewChat}
        onClose={() => setPendingNewChat(false)}
        onConfirm={confirmNewChat}
        variant="primary"
        icon="🌱"
        title="Bắt đầu cuộc hội thoại mới?"
        message={(
          <>
            Cuộc hiện tại <strong className="text-slate-900">"{conversation?.title}"</strong> có <strong>{messages.length} tin nhắn</strong> sẽ được lưu giữ trong danh sách bên trái.
            <br />
            Cuộc mới sẽ bắt đầu với khung chat trống.
          </>
        )}
        confirmText="🌱 Tạo cuộc mới"
        cancelText="Ở lại"
      />

      {/* 💥 Modal xác nhận xóa tất cả */}
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
      </div>
    </>
  );
};

export default ChatWindow;