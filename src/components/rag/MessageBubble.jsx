import React from 'react';
import SourceCard from './SourceCard';

/**
 * Bubble chat cho 1 message.
 * - User: xanh nhạt, bên phải.
 * - Assistant: xám, bên trái, kèm danh sách sources collapsible.
 */
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const sources = Array.isArray(msg.sources) ? msg.sources : [];
  const hasSources = sources.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? 'bg-emerald-600 text-white rounded-br-sm'
          : 'bg-slate-100 text-slate-900 rounded-bl-sm border border-slate-200'
      }`}>
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[11px] font-bold ${isUser ? 'text-emerald-100' : 'text-slate-500'}`}>
            {isUser ? '🧑 Bạn' : '🤖 AI Nông Nghiệp'}
          </span>
          {msg.knowledgeGroup && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              isUser ? 'bg-emerald-700/50 text-emerald-50' : 'bg-violet-100 text-violet-700'
            }`}>
              {msg.knowledgeGroup}
            </span>
          )}
          {msg.retrievalOnly && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isUser ? 'bg-emerald-700/50 text-emerald-50' : 'bg-amber-100 text-amber-700'
            }`}>
              🔍 retrieval-only
            </span>
          )}
        </div>

        {/* Content */}
        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
          isUser ? 'text-white' : 'text-slate-800'
        }`}>
          {msg.content}
        </p>

        {/* Sources */}
        {hasSources && (
          <details open className="mt-2 group">
            <summary className={`text-[11px] font-bold cursor-pointer list-none flex items-center gap-1 ${
              isUser ? 'text-emerald-100' : 'text-emerald-700'
            }`}>
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              📚 {sources.length} nguồn tham khảo
            </summary>
            <div className="mt-2 space-y-1.5">
              {sources.map((s, i) => (
                <SourceCard key={i} source={s} index={i} />
              ))}
            </div>
          </details>
        )}

        {/* Timestamp */}
        {msg.ts && (
          <div className={`text-[9px] mt-1 ${isUser ? 'text-emerald-100/70' : 'text-slate-400'}`}>
            {new Date(msg.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;