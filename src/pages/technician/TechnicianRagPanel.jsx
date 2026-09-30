import React from 'react';
import ChatWindow from '../../components/rag/ChatWindow';

/**
 * Tab "Tra cứu AI" cho Technician:
 *  - Chat RAG tra cứu kỹ thuật canh tác
 *  - Toggle "Chỉ truy xuất" để xem nguyên văn đoạn trích (retrieval_only=true)
 *  - SourceCard có nút "Copy citation" (file_name + page_number)
 */
const TechnicianRagPanel = () => {
  return (
    <div className="space-y-3">
      {/* Intro card */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-md">
        <h3 className="font-bold text-base flex items-center gap-2">
          🧑‍🌾 Tra Cứu Kỹ Thuật Nông Nghiệp (AI)
        </h3>
        <p className="text-[12px] text-amber-50/90 mt-1 max-w-3xl">
          Hỏi AI về kỹ thuật canh tác, sâu bệnh, phân bón... với trích dẫn đầy đủ
          <strong> file + trang + section</strong> để đối chiếu tài liệu gốc.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">🔍 Chỉ truy xuất</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">📋 Copy citation</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">📚 Nguồn rõ ràng</span>
        </div>
      </div>

      <ChatWindow
        title="🔧 Tra cứu kỹ thuật"
        subtitle="Toggle 'Chỉ truy xuất' để xem nguyên văn đoạn trích không qua LLM."
        enableRetrievalOnly
        defaultKnowledgeGroup="crops"
        scope="technician"
      />
    </div>
  );
};

export default TechnicianRagPanel;