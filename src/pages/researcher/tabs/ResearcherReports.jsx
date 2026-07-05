import React, { useEffect, useMemo, useRef, useState } from 'react';
import { experimentsApi, tasksApi } from '../../../api/experimentApi';
import { stagesApi, groupsApi, measurementsApi, batchesApi } from '../../../api/researcherApi';
import { measurementRecordsApi } from '../../../api/measurementApi';
import { useToast } from '../../../context/ToastContext';
import { BarChart } from '../../../components/dashboard/Charts';

const REPORT_TYPES = [
  { id: 'summary', label: 'Báo Cáo Tổng Kết', icon: '📋', desc: 'Tóm tắt kết quả, nhóm xử lý, KPI và khuyến nghị' },
  { id: 'raw', label: 'Dữ Liệu Thô', icon: '📊', desc: 'Bảng số liệu đo lường chi tiết từng lô' },
  { id: 'stat', label: 'Phân Tích Thống Kê', icon: '📈', desc: 'Giá trị TB, min, max, độ lệch chuẩn, tỷ lệ đạt mục tiêu' },
];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-100 text-emerald-700',
  Approved: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-200 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : v ?? '—');

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const printReport = (content, title) => {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:900px;margin:0 auto;color:#1a1a1a}
    h1{font-size:22px;color:#1e293b;border-bottom:2px solid #4f46e5;padding-bottom:10px}
    h2{font-size:16px;color:#334155;margin-top:24px}
    h3{font-size:13px;color:#475569;margin-top:16px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
    th{background:#f1f5f9;border:1px solid #e2e8f0;padding:8px;text-align:left}
    td{border:1px solid #e2e8f0;padding:8px}
    tr:nth-child(even){background:#f8fafc}
    .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700}
    .kpi-card{display:inline-block;padding:12px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:4px}
    .kpi-num{font-size:24px;font-weight:700;color:#1e293b}
    .kpi-label{font-size:11px;color:#64748b;text-transform:uppercase}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
    @media print{body{padding:20px}}
  </style></head><body>${content}<div class="footer">SmartFarm Research Portal · Generated on ${new Date().toLocaleString('vi-VN')}</div></body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
};

// ── Report Sections ──────────────────────────────────────────────────────────

const SummaryReport = ({ exp, groups, batches, recordsByBatch, measurements, tasks }) => {
  const totalRecords = Object.values(recordsByBatch).reduce((s, a) => s + a.length, 0);
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
  const expTasks = tasks.filter(t => t.experimentId === exp.id || t.experimentId === exp.experimentId);

  const groupStats = groups.map(g => {
    const grpBatches = batches.filter(b => b.groupId === g.id);
    const records = grpBatches.flatMap(b => recordsByBatch[b.id] || []);
    const nums = records.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
    const avg = nums.length ? (nums.reduce((s, v) => s + v, 0) / nums.length) : 0;
    const targetNums = records.map(r => parseFloat(r.targetValue)).filter(v => !isNaN(v));
    const avgTarget = targetNums.length ? (targetNums.reduce((s, v) => s + v, 0) / targetNums.length) : 0;
    const achievementPct = avgTarget > 0 ? Math.round((avg / avgTarget) * 100) : null;
    return { ...g, avg, achievementPct, recordCount: records.length, batchCount: grpBatches.length };
  });

  const bestGroup = groupStats.filter(g => g.recordCount > 0).sort((a, b) => b.avg - a.avg)[0];

  return (
    <div className="space-y-5">
      {/* Report header */}
      <div className="bg-indigo-950 text-white rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-1">Báo Cáo Tổng Kết Thực Nghiệm</p>
            <h2 className="font-hanken text-xl font-bold">{exp.title}</h2>
            <p className="text-indigo-200 text-sm mt-1">{exp.experimentCode}</p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[exp.status] || 'bg-slate-100 text-slate-600'}`}>
              {exp.status}
            </span>
            <p className="text-indigo-300 text-[10px] mt-2">
              {exp.startDate ? new Date(exp.startDate).toLocaleDateString('vi-VN') : '—'} →{' '}
              {exp.endDate ? new Date(exp.endDate).toLocaleDateString('vi-VN') : 'Đang tiến hành'}
            </p>
          </div>
        </div>
      </div>

      {/* Objectives */}
      {exp.objective && (
        <div className="bg-white border border-outline-variant rounded-2xl p-5">
          <h3 className="font-hanken text-sm font-bold text-on-surface mb-2">🎯 Mục Tiêu Nghiên Cứu</h3>
          <p className="text-sm text-on-surface leading-relaxed">{exp.objective}</p>
          {exp.hypothesis && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-[10px] font-bold uppercase text-indigo-700 mb-1">Giả Thuyết</p>
              <p className="text-sm text-indigo-900">{exp.hypothesis}</p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant rounded-2xl p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số Nhóm</p>
          <div className="font-hanken text-3xl font-bold text-primary mt-2">{groups.length}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">{groups.filter(g => g.groupType === 1).length} đối chứng · {groups.filter(g => g.groupType === 2).length} xử lý</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số Lô TN</p>
          <div className="font-hanken text-3xl font-bold text-emerald-600 mt-2">{batches.length}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">lô đã triển khai</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số Đo Lường</p>
          <div className="font-hanken text-3xl font-bold text-blue-600 mt-2">{totalRecords}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">bản ghi số liệu</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tác Vụ</p>
          <div className="font-hanken text-3xl font-bold text-amber-600 mt-2">{completedTasks}/{tasks.length}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">{overdueTasks} quá hạn</p>
        </div>
      </div>

      {/* Group comparison */}
      {groupStats.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-hanken text-base font-bold text-on-surface">📊 Kết Quả So Sánh Nhóm Xử Lý</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Giá trị trung bình và tỷ lệ đạt mục tiêu theo từng nhóm</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant">
                <tr>
                  {['Nhóm', 'Loại', 'Lô', 'Số Đo', 'TB', 'Mục Tiêu', 'Đạt %'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {[...groupStats].sort((a, b) => b.avg - a.avg).map((g, idx) => (
                  <tr key={g.id} className={`hover:bg-surface-container/20 ${bestGroup && g.id === bestGroup.id ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-on-surface">{g.groupName || '—'}</span>
                      {bestGroup && g.id === bestGroup.id && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[10px] font-bold">TỐT NHẤT</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${g.groupType === 1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {g.groupType === 1 ? 'Đối chứng' : 'Xử lý'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface font-semibold">{g.batchCount}</td>
                    <td className="px-4 py-3 text-sm text-on-surface">{g.recordCount}</td>
                    <td className="px-4 py-3 text-sm font-bold text-primary">{fmt(g.avg)}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{g.targetAvg > 0 ? fmt(g.targetAvg) : '—'}</td>
                    <td className="px-4 py-3">
                      {g.achievementPct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${g.achievementPct >= 100 ? 'bg-emerald-500' : g.achievementPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, g.achievementPct)}%` }} />
                          </div>
                          <span className="text-xs font-bold">{g.achievementPct}%</span>
                        </div>
                      ) : <span className="text-xs text-on-surface-variant">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metrics table */}
      {measurements.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-hanken text-base font-bold text-on-surface">📏 Các Chỉ Số Theo Dõi</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/50 border-b border-outline-variant">
              <tr>
                {['Chỉ Số', 'Mục Tiêu', 'Đơn Vị', 'Số Lần Đo'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {measurements.map(m => (
                <tr key={m.id} className="hover:bg-surface-container/20">
                  <td className="px-4 py-3 text-sm font-semibold text-on-surface">{m.metricName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{m.targetValue != null ? fmt(parseFloat(m.targetValue)) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{m.unit || '—'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{Object.values(recordsByBatch).flat().filter(r => r.metricName === m.metricName).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <h3 className="font-hanken text-base font-bold mb-3">💡 Kết Luận & Khuyến Nghị</h3>
        {bestGroup ? (
          <div className="space-y-2 text-sm text-indigo-100">
            <p>Phương pháp <strong className="text-white">{bestGroup.groupName}</strong> cho kết quả tốt nhất với giá trị trung bình <strong className="text-white">{fmt(bestGroup.avg)}</strong>.</p>
            {bestGroup.achievementPct !== null && (
              <p>Tỷ lệ đạt mục tiêu: <strong className="text-white">{bestGroup.achievementPct}%</strong>.</p>
            )}
            {exp.objective && <p>Kiểm chứng với mục tiêu nghiên cứu: <strong className="text-white">{exp.objective.slice(0, 80)}{exp.objective.length > 80 ? '…' : ''}</strong>.</p>}
          </div>
        ) : (
          <p className="text-sm text-indigo-200">Chưa đủ dữ liệu để đưa ra kết luận. Cần bổ sung thêm số liệu đo lường.</p>
        )}
      </div>
    </div>
  );
};

const RawDataReport = ({ exp, groups, batches, recordsByBatch, measurements }) => {
  const allRecords = batches.flatMap(b => (recordsByBatch[b.id] || []).map(r => ({
    ...r,
    batchName: b.batchCode || b.name || b.id,
    groupName: groups.find(g => g.id === b.groupId)?.groupName || '—',
    groupType: groups.find(g => g.id === b.groupId)?.groupType || 0,
  })));

  const allMetrics = [...new Set(allRecords.map(r => r.metricName).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-outline-variant rounded-2xl p-5">
        <h3 className="font-hanken text-base font-bold text-on-surface mb-1">📊 Dữ Liệu Đo Lường Thô</h3>
        <p className="text-xs text-on-surface-variant">
          Tổng cộng {allRecords.length} bản ghi từ {batches.length} lô trong {groups.length} nhóm xử lý
        </p>
      </div>

      {allRecords.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-bold text-on-surface">Chưa có dữ liệu đo lường</p>
          <p className="text-xs text-on-surface-variant mt-1">Hãy tiến hành ghi nhận số liệu từ các lô thí nghiệm.</p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-surface-container-low/50 border-b border-outline-variant">
              <tr>
                {['STT', 'Nhóm', 'Lô', 'Chỉ Số', 'Giá Trị', 'Mục Tiêu', 'Thời Gian', 'Ghi Chú'].map(h => (
                  <th key={h} className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {allRecords.map((r, idx) => (
                <tr key={idx} className="hover:bg-surface-container/20">
                  <td className="px-3 py-2 text-on-surface-variant">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.groupType === 1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.groupName}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-on-surface">{r.batchName}</td>
                  <td className="px-3 py-2 text-on-surface">{r.metricName || '—'}</td>
                  <td className="px-3 py-2 font-bold text-primary">{r.value ?? '—'}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{r.targetValue != null ? r.targetValue : '—'}</td>
                  <td className="px-3 py-2 text-on-surface-variant font-mono">
                    {r.measuredAt ? new Date(r.measuredAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant max-w-[160px] truncate">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-metric mini summary */}
      {allMetrics.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-hanken text-base font-bold text-on-surface">📈 Tổng Hợp Theo Chỉ Số</h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {allMetrics.map(m => {
              const vals = allRecords.filter(r => r.metricName === m).map(r => parseFloat(r.value)).filter(v => !isNaN(v));
              if (vals.length === 0) return null;
              const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
              const barData = groups.map((g, idx) => {
                const gVals = allRecords.filter(r => r.metricName === m && r.groupType === g.groupType).map(r => parseFloat(r.value)).filter(v => !isNaN(v));
                return { label: g.groupName || `Nhóm ${g.groupType}`, value: gVals.length ? gVals.reduce((s, v) => s + v, 0) / gVals.length : 0, color: idx === 0 ? '#4f46e5' : '#10b981' };
              }).filter(b => b.value > 0);
              return (
                <div key={m} className="border border-outline-variant rounded-xl p-4">
                  <p className="text-xs font-bold text-on-surface mb-3">{m}</p>
                  <div className="text-[10px] text-on-surface-variant mb-2">TB: <span className="font-bold text-primary">{avg.toFixed(2)}</span> · Min: <span>{Math.min(...vals).toFixed(2)}</span> · Max: <span>{Math.max(...vals).toFixed(2)}</span></div>
                  {barData.length > 0 && <BarChart data={barData} color="#4f46e5" height={Math.max(60, barData.length * 32)} unit="" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const StatReport = ({ exp, groups, batches, recordsByBatch }) => {
  const stats = groups.map(g => {
    const grpBatches = batches.filter(b => b.groupId === g.id);
    const records = grpBatches.flatMap(b => recordsByBatch[b.id] || []);
    const nums = records.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
    const sum = nums.reduce((s, v) => s + v, 0);
    const avg = nums.length ? sum / nums.length : 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const min = nums.length ? sorted[0] : 0;
    const max = nums.length ? sorted[sorted.length - 1] : 0;
    const variance = nums.length ? nums.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / nums.length : 0;
    const stdDev = Math.sqrt(variance);
    const cv = avg !== 0 ? Math.round((stdDev / Math.abs(avg)) * 100) : 0;
    const targetNums = records.map(r => parseFloat(r.targetValue)).filter(v => !isNaN(v));
    const avgTarget = targetNums.length ? targetNums.reduce((s, v) => s + v, 0) / targetNums.length : 0;
    const achievementPct = avgTarget > 0 ? Math.round((avg / avgTarget) * 100) : null;
    const median = nums.length ? (nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)]) : 0;
    return { ...g, sum, avg, min, max, stdDev, cv, median, achievementPct, n: nums.length };
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-outline-variant rounded-2xl p-5">
        <h3 className="font-hanken text-base font-bold text-on-surface mb-1">📈 Phân Tích Thống Kê Chi Tiết</h3>
        <p className="text-xs text-on-surface-variant">
          Giá trị trung bình (Mean), độ lệch chuẩn (SD), hệ số biến thiên (CV%), min/max/median cho từng nhóm
        </p>
      </div>

      {stats.every(s => s.n === 0) ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📉</div>
          <p className="text-sm font-bold text-on-surface">Chưa có đủ dữ liệu</p>
          <p className="text-xs text-on-surface-variant mt-1">Cần ít nhất 1 bản ghi đo lường để phân tích thống kê.</p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-surface-container-low/50 border-b border-outline-variant">
              <tr>
                {['Nhóm', 'Loại', 'N', 'Tổng', 'TB (Mean)', 'Median', 'Min', 'Max', 'SD', 'CV%', 'Đạt %'].map(h => (
                  <th key={h} className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {[...stats].sort((a, b) => b.avg - a.avg).map((s, idx) => (
                <tr key={s.id} className="hover:bg-surface-container/20">
                  <td className="px-3 py-2">
                    <span className="text-sm font-bold text-on-surface">{s.groupName || '—'}</span>
                    {idx === 0 && s.n > 0 && <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[10px] font-bold">🏆</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.groupType === 1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {s.groupType === 1 ? 'Đối chứng' : 'Xử lý'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n}</td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n > 0 ? fmt(s.sum) : '—'}</td>
                  <td className="px-3 py-2 font-mono font-bold text-primary">{s.n > 0 ? fmt(s.avg) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n > 0 ? fmt(s.median) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n > 0 ? fmt(s.min) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n > 0 ? fmt(s.max) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-on-surface">{s.n > 0 ? fmt(s.stdDev) : '—'}</td>
                  <td className="px-3 py-2">
                    {s.n > 0 ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cv <= 10 ? 'bg-emerald-100 text-emerald-700' : s.cv <= 25 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {s.cv}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {s.achievementPct !== null ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.achievementPct >= 100 ? 'bg-emerald-100 text-emerald-700' : s.achievementPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {s.achievementPct}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statistical notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h4 className="font-hanken text-sm font-bold text-amber-800 mb-2">📖 Hướng Dẫn Đọc Bảng Thống Kê</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-amber-900">
          <div><strong>Mean (TB):</strong> Giá trị trung bình cộng</div>
          <div><strong>SD:</strong> Độ lệch chuẩn — đo mức độ phân tán</div>
          <div><strong>CV%:</strong> Hệ số biến thiên — CV thấp = ổn định hơn</div>
          <div><strong>Đạt %:</strong> Tỷ lệ giá trị thực / mục tiêu khoa học</div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const ResearcherReports = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [selectedExpId, setSelectedExpId] = useState('');
  const [reportType, setReportType] = useState('summary');
  const [groups, setGroups] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [recordsByBatch, setRecordsByBatch] = useState({});
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const data = await experimentsApi.getAll();
        const list = Array.isArray(data) ? data : [];
        setExperiments(list.filter(e => e.status === 'Active' || e.status === 'Completed'));
        if (list.length > 0) setSelectedExpId(list[0].id);
      } catch (err) {
        showToast(err.message || 'Không thể tải thí nghiệm', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchExperiments();
  }, [showToast]);

  useEffect(() => {
    if (!selectedExpId) return;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const [grp, meas, bat, tsk] = await Promise.allSettled([
          groupsApi.getByExperiment(selectedExpId),
          measurementsApi.getByExperiment(selectedExpId),
          batchesApi.getByExperiment(selectedExpId),
          tasksApi.getByExperiment(selectedExpId)
        ]);
        setGroups(grp.status === 'fulfilled' ? (Array.isArray(grp.value) ? grp.value : []) : []);
        setMeasurements(meas.status === 'fulfilled' ? (Array.isArray(meas.value) ? meas.value : []) : []);
        const batchList = bat.status === 'fulfilled' ? (Array.isArray(bat.value) ? bat.value : []) : [];
        setBatches(batchList);
        const tskList = tsk.status === 'fulfilled' ? (Array.isArray(tsk.value) ? tsk.value : []) : [];
        setTasks(tskList);

        const recordResults = await Promise.allSettled(
          batchList.map(b => measurementRecordsApi.getByBatch(b.id))
        );
        const recMap = {};
        batchList.forEach((b, idx) => {
          recMap[b.id] = recordResults[idx].status === 'fulfilled' && Array.isArray(recordResults[idx].value)
            ? recordResults[idx].value
            : [];
        });
        setRecordsByBatch(recMap);
      } catch (err) {
        showToast(err.message || 'Không thể tải chi tiết thí nghiệm', 'error');
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedExpId, showToast]);

  const selectedExp = experiments.find(e => e.id === selectedExpId);

  // Export handlers
  const handleExportCSV = () => {
    if (!selectedExp) { showToast('Chưa chọn thí nghiệm', 'error'); return; }
    if (reportType === 'summary') {
      const rows = [
        ['Mã TN', 'Tiêu đề', 'Trạng thái', 'Bắt đầu', 'Kết thúc', 'Số nhóm', 'Số lô', 'Mục tiêu'],
        ...groups.map(g => {
          const gb = batches.filter(b => b.groupId === g.id);
          const recs = gb.flatMap(b => recordsByBatch[b.id] || []);
          const nums = recs.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
          const avg = nums.length ? (nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2) : '—';
          return [selectedExp.experimentCode, selectedExp.title, selectedExp.status, selectedExp.startDate, selectedExp.endDate, groups.length, batches.length, selectedExp.objective];
        })
      ];
      const csv = rows.map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadFile('\ufeff' + csv, `baocao_tongket_${selectedExp.experimentCode || selectedExpId}.csv`, 'text/csv;charset=utf-8');
    } else if (reportType === 'raw') {
      const rows = [['STT', 'Nhóm', 'Lô', 'Chỉ số', 'Giá trị', 'Mục tiêu', 'Thời gian']];
      batches.forEach(b => {
        const gName = groups.find(g => g.id === b.groupId)?.groupName || '';
        (recordsByBatch[b.id] || []).forEach(r => {
          rows.push([rows.length, gName, b.name || b.id, r.metricName || '', r.value ?? '', r.targetValue ?? '', r.measuredAt ? new Date(r.measuredAt).toISOString() : '']);
        });
      });
      const csv = rows.map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadFile('\ufeff' + csv, `dulieu_tho_${selectedExp.experimentCode || selectedExpId}.csv`, 'text/csv;charset=utf-8');
    } else {
      const rows = [['Nhóm', 'Loại', 'N', 'Tổng', 'TB', 'Median', 'Min', 'Max', 'SD', 'CV%', 'Đạt %']];
      groups.forEach(g => {
        const gb = batches.filter(b => b.groupId === g.id);
        const recs = gb.flatMap(b => recordsByBatch[b.id] || []);
        const nums = recs.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
        const avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
        const sorted = [...nums].sort((a, b) => a - b);
        const stdDev = nums.length ? Math.sqrt(nums.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / nums.length) : 0;
        const cv = avg !== 0 ? Math.round((stdDev / Math.abs(avg)) * 100) : 0;
        const median = nums.length ? (nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)]) : 0;
        const targets = recs.map(r => parseFloat(r.targetValue)).filter(v => !isNaN(v));
        const avgT = targets.length ? targets.reduce((s, v) => s + v, 0) / targets.length : 0;
        const ach = avgT > 0 ? Math.round((avg / avgT) * 100) : '';
        rows.push([g.groupName || '', g.groupType === 1 ? 'Đối chứng' : 'Xử lý', nums.length, nums.length ? nums.reduce((s, v) => s + v, 0).toFixed(2) : '', avg.toFixed(2), median.toFixed(2), nums.length ? sorted[0].toFixed(2) : '', nums.length ? sorted[sorted.length - 1].toFixed(2) : '', stdDev.toFixed(2), cv, ach]);
      });
      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
      downloadFile('\ufeff' + csv, `thongke_${selectedExp.experimentCode || selectedExpId}.csv`, 'text/csv;charset=utf-8');
    }
    showToast('Đã tải file CSV!', 'success');
  };

  const handleExportJSON = () => {
    if (!selectedExp) { showToast('Chưa chọn thí nghiệm', 'error'); return; }
    const reportData = {
      metadata: {
        title: 'Báo Cáo Tổng Kết Thực Nghiệm',
        experimentCode: selectedExp.experimentCode,
        experimentTitle: selectedExp.title,
        status: selectedExp.status,
        startDate: selectedExp.startDate,
        endDate: selectedExp.endDate,
        objective: selectedExp.objective,
        hypothesis: selectedExp.hypothesis,
        generatedAt: new Date().toISOString(),
        reportType
      },
      summary: {
        totalGroups: groups.length,
        totalBatches: batches.length,
        controlGroups: groups.filter(g => g.groupType === 1).length,
        treatmentGroups: groups.filter(g => g.groupType === 2).length,
        totalMeasurements: Object.values(recordsByBatch).reduce((s, a) => s + a.length, 0),
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'Completed').length
      },
      groups: groups.map(g => {
        const gb = batches.filter(b => b.groupId === g.id);
        const recs = gb.flatMap(b => recordsByBatch[b.id] || []);
        const nums = recs.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
        const avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
        const sorted = [...nums].sort((a, b) => a - b);
        const targets = recs.map(r => parseFloat(r.targetValue)).filter(v => !isNaN(v));
        const avgTarget = targets.length ? targets.reduce((s, v) => s + v, 0) / targets.length : 0;
        const ach = avgTarget > 0 ? Math.round((avg / avgTarget) * 100) : null;
        return {
          id: g.id,
          name: g.groupName,
          type: g.groupType === 1 ? 'Control' : 'Treatment',
          batchCount: gb.length,
          measurementCount: recs.length,
          mean: avg || null,
          min: nums.length ? sorted[0] : null,
          max: nums.length ? sorted[sorted.length - 1] : null,
          median: nums.length ? (nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)]) : null,
          stdDev: nums.length ? Math.sqrt(nums.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / nums.length) : null,
          achievementPct: ach,
          targetAvg: avgTarget || null,
          treatmentDescription: g.treatmentDescription
        };
      }),
      measurements: measurements.map(m => ({
        id: m.id,
        metricName: m.metricName,
        targetValue: m.targetValue,
        unit: m.unit,
        recordCount: Object.values(recordsByBatch).flat().filter(r => r.metricName === m.metricName).length
      })),
      rawRecords: batches.flatMap(b =>
        (recordsByBatch[b.id] || []).map(r => ({
          batchId: b.id,
          batchName: b.name,
          groupName: groups.find(g => g.id === b.groupId)?.groupName,
          ...r
        }))
      )
    };
    const json = JSON.stringify(reportData, null, 2);
    downloadFile(json, `baocao_${selectedExp.experimentCode || selectedExpId}.json`, 'application/json');
    showToast('Đã tải file JSON!', 'success');
  };

  const handlePrint = () => {
    if (!selectedExp || !previewRef.current) { showToast('Chưa có nội dung để in', 'error'); return; }
    const title = `Báo Cáo Tổng Kết - ${selectedExp.experimentCode || ''} - ${new Date().toLocaleDateString('vi-VN')}`;
    const innerHTML = previewRef.current.innerHTML;
    printReport(innerHTML, title);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h3 className="font-hanken text-xl font-bold text-on-surface">T27 · Xuất Báo Cáo Tổng Kết Thực Nghiệm</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Chính thức hóa kết quả nghiên cứu thành văn bản để lưu trữ, nghiệm thu hoặc chia sẻ.
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Experiment selector */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Thí Nghiệm</label>
            <select
              value={selectedExpId}
              onChange={e => setSelectedExpId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">— Chọn thí nghiệm —</option>
              {experiments.map(e => (
                <option key={e.id} value={e.id}>{e.experimentCode} — {e.title}</option>
              ))}
            </select>
          </div>

          {/* Report type */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Loại Báo Cáo</label>
            <div className="flex gap-2">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => setReportType(rt.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    reportType === rt.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="mr-1">{rt.icon}</span>{rt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-outline-variant">
          <button
            onClick={handleExportCSV}
            disabled={!selectedExpId || loadingDetail}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-40 active:scale-95 flex items-center gap-2"
          >
            <span>📥</span> Xuất CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!selectedExpId || loadingDetail}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-all disabled:opacity-40 active:scale-95 flex items-center gap-2"
          >
            <span>📦</span> Xuất JSON
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedExpId || loadingDetail}
            className="px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-40 active:scale-95 flex items-center gap-2"
          >
            <span>🖨️</span> In / PDF
          </button>
          <div className="ml-auto text-xs text-on-surface-variant">
            {loadingDetail && <span className="text-indigo-600 animate-pulse">Đang tải dữ liệu…</span>}
            {!loadingDetail && selectedExp && (
              <span>{REPORT_TYPES.find(r => r.id === reportType)?.desc}</span>
            )}
          </div>
        </div>
      </div>

      {/* Report preview */}
      {!selectedExpId ? (
        <div className="bg-white border border-dashed border-outline-variant rounded-2xl p-16 text-center">
          <div className="text-5xl mb-4">📤</div>
          <p className="text-sm font-bold text-on-surface">Chọn thí nghiệm để xem trước báo cáo</p>
          <p className="text-xs text-on-surface-variant mt-2">Chọn một thí nghiệm Active hoặc Completed, chọn loại báo cáo và nhấn xuất để tải về.</p>
        </div>
      ) : loadingDetail ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-16 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-surface-container-low rounded-xl w-2/3 mx-auto" />
            <div className="h-4 bg-surface-container-low rounded-xl w-1/2 mx-auto" />
            <div className="h-32 bg-surface-container-low rounded-xl w-full" />
          </div>
          <p className="text-sm text-on-surface-variant mt-4">Đang tải dữ liệu thí nghiệm…</p>
        </div>
      ) : (
        <div ref={previewRef} className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
          {reportType === 'summary' && (
            <SummaryReport
              exp={selectedExp}
              groups={groups}
              batches={batches}
              recordsByBatch={recordsByBatch}
              measurements={measurements}
              tasks={tasks}
            />
          )}
          {reportType === 'raw' && (
            <RawDataReport
              exp={selectedExp}
              groups={groups}
              batches={batches}
              recordsByBatch={recordsByBatch}
              measurements={measurements}
            />
          )}
          {reportType === 'stat' && (
            <StatReport
              exp={selectedExp}
              groups={groups}
              batches={batches}
              recordsByBatch={recordsByBatch}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ResearcherReports;
