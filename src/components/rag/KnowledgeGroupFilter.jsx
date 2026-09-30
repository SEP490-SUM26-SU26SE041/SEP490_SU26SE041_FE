import React from 'react';
import { KNOWLEDGE_GROUPS } from '../../api/ragApi';

/**
 * Bộ lọc nhóm tri thức (Cây trồng / Chăn nuôi / Đất / Sâu bệnh / Tổng hợp).
 * Student & Technician dùng để giới hạn phạm vi truy vấn RAG.
 */
const KnowledgeGroupFilter = ({ value, onChange, compact = false }) => {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mb-3'}`}>
      {KNOWLEDGE_GROUPS.map(g => {
        const active = value === g.value;
        return (
          <button
            key={String(g.value)}
            type="button"
            onClick={() => onChange(g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              active
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700'
            }`}
            title={g.hint}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
};

export default KnowledgeGroupFilter;