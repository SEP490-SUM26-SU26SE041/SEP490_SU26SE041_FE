import React, { useEffect, useMemo, useState } from 'react';
import { statisticsApi, measurementDefinitionsApi } from '../../api/experimentApi';
import {
  formatStat, formatRatio,
  buildComparisonTable, buildComparisonSummary, mergeGroupMetrics,
  formatGrowthDate, downloadBlob
} from '../../utils/measurement';

/**
 * StatisticsDashboard
 * Hiển thị thống kê (AVG/MIN/MAX/STDDEV/Median/Q1/Q3) cho researcher.
 * Có 2 mode:
 *   - Theo stage (stageId)
 *   - Toàn experiment (experimentId)
 *
 * Props:
 *  - experimentId
 *  - stages: Array<{id, stageName, startDate, endDate}>
 *  - showToast
 */
const StatisticsDashboard = ({ experimentId, stages = [], showToast }) => {
  const [selectedStage, setSelectedStage] = useState('overall');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchStats = async () => {
    if (!experimentId) return;
    const params = {};
    if (fromDate) params.fromDate = new Date(fromDate).toISOString();
    if (toDate) params.toDate = new Date(toDate).toISOString();
    if (filterGroupId) params.groupId = filterGroupId;

    try {
      setLoading(true);
      const result = (selectedStage === 'overall')
        ? await statisticsApi.byExperiment(experimentId, params)
        : await statisticsApi.byStage(selectedStage, params);
      setData(result);
    } catch (err) {
      showToast?.(err.message || 'Lỗi tải thống kê', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (experimentId) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, experimentId]);

  const comparisonRows = useMemo(() => buildComparisonTable(data?.crossGroupComparison), [data]);
  // Tự tính lại summary trên tập rows đã gom (BE đếm theo definitionId → sai khi trùng metricName)
  const computedSummary = useMemo(() => {
    const allGroupNames = (data?.groups || []).map(g => g.groupName);
    return buildComparisonSummary(comparisonRows, allGroupNames);
  }, [comparisonRows, data]);

  const exportFile = async (format) => {
    if (selectedStage === 'overall') {
      showToast?.('Xuất báo cáo chỉ hỗ trợ theo từng giai đoạn', 'warning');
      return;
    }
    try {
      setExporting(true);
      const blob = await statisticsApi.export(selectedStage, { format, includeComparison: true });
      const ext = format === 'xlsx' ? 'xls' : 'csv';
      const fname = `stage-statistics-${selectedStage}-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}.${ext}`;
      downloadBlob(blob, fname);
      showToast?.(`Đã tải ${fname}`, 'success');
    } catch (err) {
      showToast?.(err.message || 'Xuất báo cáo thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ===== RENDER =====

  if (!experimentId) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl">
        Vui lòng chọn experiment để xem thống kê.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Giai đoạn thống kê</label>
            <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="overall">📊 Tổng hợp toàn experiment</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>📅 {s.stageName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Từ ngày</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Đến ngày</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchStats} disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2">
            {loading ? <>⏳ Đang tải...</> : <>🔍 Phân tích</>}
          </button>
          <button onClick={() => { setFromDate(''); setToDate(''); setFilterGroupId(''); fetchStats(); }}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">
            ↺ Reset
          </button>
          <div className="flex-1" />
          <button onClick={() => exportFile('csv')} disabled={exporting || selectedStage === 'overall'}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1">
            📥 Xuất CSV
          </button>
          <button onClick={() => exportFile('xlsx')} disabled={exporting || selectedStage === 'overall'}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1">
            📥 Xuất Excel
          </button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-indigo-900">{data.stageName || 'Thống kê'}</h3>
              <p className="text-[10px] text-indigo-700/70 mt-0.5">
                {data.statisticsType} · {data.definitionCount} chỉ số · Tạo lúc {data.generatedAt ? new Date(data.generatedAt).toLocaleString('vi-VN') : '—'}
              </p>
            </div>
            {data.crossGroupComparison && (
              <div className="text-right">
                <p className="text-[10px] text-indigo-700/70">Nhóm tốt nhất</p>
                <p className="text-lg font-bold text-indigo-900">🏆 {computedSummary.bestGroupName || data.crossGroupComparison.bestGroupName || '—'}</p>
                {computedSummary.summary && (
                  <p className="text-[10px] text-indigo-700/70 mt-0.5">{computedSummary.summary}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">⏳ Đang tải thống kê...</div>
      ) : !data ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">Vui lòng chọn giai đoạn và bấm Phân tích.</div>
      ) : (
        <>
          {/* Per-group table */}
          {data.groups?.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
              Không có dữ liệu đo lường trong khoảng đã chọn.
            </div>
          )}
          {data.groups?.map(group => (
            <div key={group.groupId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">📊 {group.groupName}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Loại: <span className="font-mono font-bold">{group.groupType}</span> · {group.batchCount} lô · {group.totalSamples} mẫu
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Chỉ số', 'Đơn vị', 'Target', 'Mẫu', 'Trung bình', 'Min', 'Max', 'StdDev', 'Median', 'Q1', 'Q3', 'Đạt target'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-slate-600 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mergeGroupMetrics(group.metrics).map(m => (
                      <tr key={m.key || m.definitionId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-900">{m.metricName}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{m.unit || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{formatStat(m.targetValue)}</td>
                        <td className="px-3 py-2 font-bold text-slate-700">{m.sampleCount}</td>
                        <td className="px-3 py-2 font-bold text-indigo-700">{formatStat(m.average)}</td>
                        <td className="px-3 py-2 font-mono">{formatStat(m.min)}</td>
                        <td className="px-3 py-2 font-mono">{formatStat(m.max)}</td>
                        <td className="px-3 py-2 font-mono text-amber-700">{formatStat(m.stdDev)}</td>
                        <td className="px-3 py-2 font-mono">{formatStat(m.median)}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{formatStat(m.q1)}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{formatStat(m.q3)}</td>
                        <td className="px-3 py-2">
                          {m.reachesTarget
                            ? <span className="text-emerald-600 font-bold">✅ {formatRatio(m.targetAchievementRatio)}</span>
                            : <span className="text-amber-700 font-bold">{formatRatio(m.targetAchievementRatio)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Growth over time */}
              {group.growthOverTime?.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
                  <h5 className="text-[10px] font-bold uppercase text-slate-600 mb-2">📈 Tăng trưởng theo thời gian</h5>
                  <div className="flex items-end gap-3 h-24 pb-2 overflow-x-auto">
                    {group.growthOverTime.map((g, i) => {
                      const max = Math.max(...group.growthOverTime.map(x => x.average || 0), 0.001);
                      const h = Math.max(10, (g.average / max) * 80);
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 shrink-0" title={`${formatGrowthDate(g.measuredAt)}: avg=${formatStat(g.average)}, mẫu=${g.sampleCount}, growth=${formatStat(g.growthRatePercent)}%`}>
                          <div className="text-[9px] font-bold text-slate-700">{formatStat(g.average)}</div>
                          <div className="w-6 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300"
                            style={{ height: `${h}px` }} />
                          <div className="text-[8px] text-slate-500 font-mono">{formatGrowthDate(g.measuredAt)?.slice(5)}</div>
                          {i > 0 && (
                            <div className={`text-[9px] font-bold ${g.growthRatePercent >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {g.growthRatePercent >= 0 ? '↑' : '↓'}{formatStat(g.growthRatePercent)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Cross-group comparison */}
          {comparisonRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-slate-200">
                <h4 className="text-sm font-bold text-slate-900">🆚 So sánh giữa các nhóm</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Nhóm nào cho kết quả tốt nhất cho từng chỉ số.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Chỉ số</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase">Đơn vị</th>
                      {data.groups?.map(g => (
                        <th key={g.groupId} className="px-3 py-2 text-right font-bold text-slate-600 uppercase">{g.groupName}</th>
                      ))}
                      <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase">Δ Max</th>
                      <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase">Tốt nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonRows.map(row => (
                      <tr key={row.key || row.definitionId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-900">{row.metricName}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.unit || '—'}</td>
                        {row.groups.map(g => (
                          <td key={g.groupId} className={`px-3 py-2 text-right font-mono font-bold ${g.groupName === row.bestGroupName ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'}`}>
                            {formatStat(g.average)}
                            <span className="text-[9px] text-slate-400 ml-1">(n={g.sampleCount})</span>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{formatStat(row.maxDifference)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                            🏆 {row.bestGroupName}
                          </span>
                          {row.significantDifference && <span className="ml-1 text-[9px] text-rose-500 font-bold">(p&lt;0.05)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StatisticsDashboard;
