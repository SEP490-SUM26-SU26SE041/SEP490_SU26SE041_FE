import React, { useState } from 'react';

/**
 * Card hiển thị 1 nguồn trích dẫn trong câu trả lời RAG.
 * Hiển thị file_name, page_number, section, knowledge_group, text snippet.
 * Có nút "Copy citation" (file_name + page_number) cho Technician.
 */
const SourceCard = ({ source, index = 0 }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!source) return null;

  const file = source.file_name || source.source || 'unknown.pdf';
  const page = source.page_number;
  const section = source.section || source.title;
  const group = source.knowledge_group;
  const text = source.text || '';

  const citation = `${file}${page != null ? ` (trang ${page})` : ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = citation;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const TEXT_PREVIEW_LEN = 220;
  const isLong = text.length > TEXT_PREVIEW_LEN;
  const displayText = expanded || !isLong ? text : text.slice(0, TEXT_PREVIEW_LEN) + '…';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 hover:border-emerald-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400">#{index + 1}</span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 truncate" title={file}>
              📄 {file}
            </span>
            {page != null && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                trang {page}
              </span>
            )}
            {group && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 uppercase">
                {group}
              </span>
            )}
          </div>
          {section && (
            <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={section}>
              📑 {section}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded transition-colors ${
            copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title="Copy citation"
        >
          {copied ? '✓ Đã copy' : '📋 Copy'}
        </button>
      </div>
      <p className="text-[11px] text-slate-700 leading-relaxed italic">
        "{displayText}"
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold mt-1"
        >
          {expanded ? '↑ Thu gọn' : '↓ Xem thêm'}
        </button>
      )}
    </div>
  );
};

export default SourceCard;