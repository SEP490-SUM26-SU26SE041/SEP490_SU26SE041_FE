import React, { useEffect, useState } from 'react';
import { experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';

const STATUS_MAP = {
  Draft: 'draft',
  Approved: 'approved',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled'
};

const ResearcherOverview = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [recentExp, setRecentExp] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await experimentsApi.getAll();
        const list = Array.isArray(data) ? data : [];
        setExperiments(list);
        setRecentExp(list.slice(0, 5));
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = {
    total: experiments.length,
    draft: experiments.filter(e => e.status === 'Draft').length,
    active: experiments.filter(e => e.status === 'Active').length,
    completed: experiments.filter(e => e.status === 'Completed').length,
  };

  const statusColors = {
    Draft: 'bg-slate-100 text-slate-600',
    Active: 'bg-emerald-100 text-emerald-700',
    Approved: 'bg-blue-100 text-blue-700',
    Completed: 'bg-emerald-200 text-emerald-800',
    Cancelled: 'bg-rose-100 text-rose-700'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng Thí Nghiệm', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Đang Soạn Thảo', value: stats.draft, color: 'text-slate-500', bg: 'bg-slate-100' },
          { label: 'Đang Triển Khai', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Hoàn Thành', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-outline-variant rounded-2xl p-5 flex flex-col gap-1`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</span>
            <span className={`font-hanken text-3xl lg:text-4xl font-bold ${s.color}`}>{loading ? '…' : s.value}</span>
          </div>
        ))}
      </div>

      {/* Recent experiments */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-2">
          <span className="text-lg">🧪</span>
          <h3 className="font-hanken font-bold text-on-surface">Thí Nghiệm Gần Đây</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : recentExp.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có thí nghiệm nào.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mã</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tiêu Đề</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông Trại</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Ngày Tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {recentExp.map(exp => (
                <tr key={exp.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-[12px] text-primary font-bold">{exp.experimentCode || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-on-surface line-clamp-1">{exp.title || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[exp.status] || 'bg-slate-100 text-slate-600'}`}>
                      {exp.status || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{exp.farmName || '—'}</td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                    {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResearcherOverview;
