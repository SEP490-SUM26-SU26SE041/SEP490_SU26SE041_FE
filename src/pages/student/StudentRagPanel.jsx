import React from 'react';
import ChatWindow from '../../components/rag/ChatWindow';

/**
 * Tab "AI Chat" cho Student:
 *  - Chat RAG học tập nông nghiệp
 *  - Lọc theo nhóm tri thức
 *  - Hiển thị nguồn trích dẫn để kiểm chứng
 */
const StudentRagPanel = () => {
  return (
    <div className="space-y-3">
      {/* Intro card */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-2xl p-4 text-white shadow-md">
        <h3 className="font-bold text-base flex items-center gap-2">
          🤖 AI Chat Học Tập Nông Nghiệp
        </h3>
        <p className="text-[12px] text-emerald-50/90 mt-1 max-w-3xl">
          Hỏi đáp trực tiếp với AI dựa trên tài liệu nông nghiệp đã được nhà nghiên cứu upload.
          Mỗi câu trả lời đều kèm nguồn trích dẫn để bạn kiểm chứng.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">📚 Đa tài liệu</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">🔍 Có nguồn</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">💬 Đa lượt</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">📅 Lưu lịch sử</span>
        </div>
      </div>

      <ChatWindow
        title="🎓 Hỏi đáp nông nghiệp"
        subtitle="Hỏi bất kỳ điều gì về cây trồng, sâu bệnh, kỹ thuật canh tác… Bật 'Chỉ truy xuất' để xem nguyên văn tài liệu."
        scope="student"
      />
    </div>
  );
};

export default StudentRagPanel;