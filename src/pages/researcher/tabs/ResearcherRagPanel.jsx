import React from 'react';
import PdfUploader from '../../../components/rag/PdfUploader';
import IndexStatusBadge from '../../../components/rag/IndexStatusBadge';
import ChatWindow from '../../../components/rag/ChatWindow';
import { RAG_BASE_URL } from '../../../api/ragApi';

/**
 * Tab "Trợ Lý AI" cho Researcher:
 *  - Upload PDF + Indexing
 *  - Theo dõi trạng thái index (auto-refresh)
 *  - Test nhanh qua chat (để kiểm tra index có truy xuất được không)
 *  - Link Swagger docs để debug
 */
const ResearcherRagPanel = () => {
  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-500 rounded-2xl p-5 text-white shadow-lg">
        <h3 className="font-bold text-lg flex items-center gap-2">
          🌾 Trợ Lý AI Nông Nghiệp (RAG)
        </h3>
        <p className="text-[12px] text-emerald-50/90 mt-1 max-w-3xl">
          Upload tài liệu PDF nông nghiệp → tạo vector index → Student & Technician
          có thể truy vấn trên web qua ô chat AI.
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <a
            href={`${RAG_BASE_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            📘 Swagger Docs ↗
          </a>
          <span className="text-[10px] text-emerald-50/80">
            Endpoint: <code className="font-mono">{RAG_BASE_URL}</code>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              📤 Upload tài liệu PDF
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Upload file PDF nông nghiệp để đưa vào knowledge base.
            </p>
          </div>
          <div className="p-4">
            <PdfUploader />
          </div>
        </div>

        {/* Index status */}
        <IndexStatusBadge />
      </div>

      {/* Quick test chat */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            🧪 Test truy vấn nhanh
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Thử chat để kiểm tra index có hoạt động đúng không (cùng UI Student/Technician dùng).
          </p>
        </div>
        <div className="p-4">
          <ChatWindow
            title="🔧 Test chat (Researcher)"
            subtitle="Kiểm tra RAG có truy xuất đúng từ tài liệu đã upload."
            enableRetrievalOnly
            scope="researcher"
          />
        </div>
      </div>
    </div>
  );
};

export default ResearcherRagPanel;