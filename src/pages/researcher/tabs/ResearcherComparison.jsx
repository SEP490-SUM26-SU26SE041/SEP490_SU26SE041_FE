import React, { useEffect, useMemo, useState } from 'react';
import { experimentsApi } from '../../../api/experimentApi';
import { stagesApi, groupsApi, measurementsApi, schedulesApi, batchesApi } from '../../../api/researcherApi';
import { measurementRecordsApi } from '../../../api/measurementApi';
import { comparisonApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { BarChart, MultiLineChart, Gauge } from '../../../components/dashboard/Charts';

const GROUP_TYPE_LABELS = {
  1: 'Đối chứng',
  2: 'Xử lý'
};

const palette = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : v ?? '—');

// ── Component ────────────────────────────────────────────────────────────────

const ResearcherComparison = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [selectedExpId, setSelectedExpId] = useState('');
  const [groups, setGroups] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [metricName, setMetricName] = useState('');
  const [recordsByBatch, setRecordsByBatch] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [comparisonData, setComparisonData] = useState(null); // Real comparison data from API

  // Initial load experiments
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

  // Load experiment details
  useEffect(() => {
    if (!selectedExpId) return;
    const fetchDetails = async () => {
      try {
        setLoadingRecords(true);
        const [grp, meas, bat, comp] = await Promise.allSettled([
          groupsApi.getByExperiment(selectedExpId),
          measurementsApi.getByExperiment(selectedExpId),
          batchesApi.getByExperiment(selectedExpId),
          comparisonApi.getComparison(selectedExpId)
        ]);
        
        const groupsData = grp.status === 'fulfilled' ? (Array.isArray(grp.value) ? grp.value : []) : [];
        const measurementsData = meas.status === 'fulfilled' ? (Array.isArray(meas.value) ? meas.value : []) : [];
        const batchList = bat.status === 'fulfilled' ? (Array.isArray(bat.value) ? bat.value : []) : [];
        
        console.log('Groups fetched:', groupsData);
        console.log('Measurements fetched:', measurementsData);
        console.log('Batches fetched:', batchList);
        
        setGroups(groupsData);
        setMeasurements(measurementsData);
        setBatches(batchList);
        
        // Handle comparison data
        if (comp.status === 'fulfilled') {
          console.log('Comparison API response:', comp.value);
          setComparisonData(comp.value);
        } else {
          console.log('Comparison API error:', comp.reason?.message || comp.reason);
          setComparisonData(null);
        }
        
        // Default metric to first one
        if (measurementsData.length > 0 && !metricName) setMetricName(measurementsData[0].metricName);
      } catch (err) {
        showToast(err.message || 'Không thể tải chi tiết thí nghiệm', 'error');
      } finally {
        setLoadingRecords(false);
      }
    };
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExpId]);

  // Load measurement records for each batch when batch list or metric changes
  useEffect(() => {
    if (!batches.length || !metricName) return;
    const fetchAll = async () => {
      try {
        setLoadingRecords(true);
        const all = await Promise.all(
          batches.map(b => measurementRecordsApi.getByBatch(b.id).catch(() => []))
        );
        const map = {};
        batches.forEach((b, idx) => {
          map[b.id] = Array.isArray(all[idx]) ? all[idx] : [];
        });
        setRecordsByBatch(map);
      } catch (err) {
        showToast(err.message || 'Không thể tải đo lường', 'error');
      } finally {
        setLoadingRecords(false);
      }
    };
    fetchAll();
  }, [batches, metricName, showToast]);

  // ── Build comparison data from API ──────────────────────────────────────────────────
  const metricOptions = useMemo(() => {
    // First check if we have API comparison data with metric comparisons
    if (comparisonData?.groupComparisons?.length > 0) {
      const set = new Set();
      comparisonData.groupComparisons.forEach(g => {
        if (g.metricComparisons) {
          g.metricComparisons.forEach(m => {
            if (m.metricName) set.add(m.metricName);
          });
        }
      });
      return Array.from(set);
    }
    // Fallback to local data
    const set = new Set();
    measurements.forEach(m => { if (m.metricName) set.add(m.metricName); });
    batches.forEach(b => {
      (recordsByBatch[b.id] || []).forEach(r => { if (r.metricName) set.add(r.metricName); });
    });
    return Array.from(set);
  }, [comparisonData, measurements, batches, recordsByBatch]);

  // Use API comparison data or fallback to computed data
  const groupComparison = useMemo(() => {
    // Use API comparison data if available and has data
    if (comparisonData?.groupComparisons?.length > 0) {
      return comparisonData.groupComparisons.map(g => ({
        id: g.groupId,
        groupName: g.groupName,
        groupType: g.groupType,
        treatmentDescription: g.treatmentDescription,
        batchCount: g.totalBatches,
        recordCount: g.totalMeasurements,
        avg: g.metricComparisons?.find(m => m.metricName === metricName)?.averageValue || 
             (g.metricComparisons?.length > 0 ? g.metricComparisons[0].averageValue : 0) || 0,
        max: g.metricComparisons?.find(m => m.metricName === metricName)?.maxValue ||
             (g.metricComparisons?.length > 0 ? g.metricComparisons[0].maxValue : 0) || 0,
        min: g.metricComparisons?.find(m => m.metricName === metricName)?.minValue ||
             (g.metricComparisons?.length > 0 ? g.metricComparisons[0].minValue : 0) || 0,
        targetAvg: g.metricComparisons?.find(m => m.metricName === metricName)?.targetValue || 0,
        achievementPct: g.metricComparisons?.find(m => m.metricName === metricName)?.targetAchievementRate || 0,
        metricComparisons: g.metricComparisons || [],
        batchMetrics: g.batchMetrics || [],
        records: g.batchMetrics?.flatMap(b => b.metricTimeSeries || []) || []
      }));
    }

    // Fallback to computed data from local records
    if (!groups.length || !batches.length) return [];

    // Map batch -> group
    const batchGroupMap = {};
    batches.forEach(b => { batchGroupMap[b.id] = b.groupId; });

    const result = groups.map(g => {
      const groupBatches = batches.filter(b => b.groupId === g.id);
      const records = groupBatches.flatMap(b =>
        (recordsByBatch[b.id] || []).filter(r => !metricName || r.metricName === metricName)
      );

      const numericValues = records
        .map(r => parseFloat(r.value))
        .filter(v => !isNaN(v));

      const sum = numericValues.reduce((s, v) => s + v, 0);
      const avg = numericValues.length ? sum / numericValues.length : 0;
      const max = numericValues.length ? Math.max(...numericValues) : 0;
      const min = numericValues.length ? Math.min(...numericValues) : 0;
      const targetValues = records.map(r => parseFloat(r.targetValue)).filter(v => !isNaN(v));
      const avgTarget = targetValues.length ? targetValues.reduce((s, v) => s + v, 0) / targetValues.length : 0;
      const achievementPct = avgTarget > 0 ? Math.round((avg / avgTarget) * 100) : 0;

      return {
        ...g,
        batchCount: groupBatches.length,
        recordCount: records.length,
        avg,
        max,
        min,
        targetAvg: avgTarget,
        achievementPct,
        records
      };
    });

    return result;
  }, [comparisonData, groups, batches, recordsByBatch, metricName]);

  // ── Determine "công thức vàng" (golden formula) ───────────────────────────
  // Use real comparison data from API if available
  const goldenFormula = useMemo(() => {
    // If we have real comparison data from API, use it
    if (comparisonData?.groupComparisons?.length > 0) {
      const candidates = comparisonData.groupComparisons
        .filter(g => g.totalMeasurements > 0)
        .map(g => ({
          ...g,
          avg: g.metricComparisons?.[0]?.averageValue || 0,
          recordCount: g.totalMeasurements,
          targetAvg: g.metricComparisons?.[0]?.targetValue || 0,
          achievementPct: g.metricComparisons?.[0]?.targetAchievementRate || 0
        }));
      if (candidates.length === 0) return null;
      const maxAvg = Math.max(...candidates.map(c => c.avg || 0));
      return candidates
        .map(c => ({ ...c, score: maxAvg > 0 ? (c.avg / maxAvg) * 100 : 0 }))
        .sort((a, b) => b.score - a.score)[0];
    }
    
    // Fallback to computed data from batch records
    if (!groupComparison.length) return null;
    const candidates = groupComparison.filter(g => g.recordCount > 0);
    if (candidates.length === 0) return null;

    // Rank by: achievement rate first (closest to target), then avg value
    const maxAvg = Math.max(...candidates.map(c => c.avg));
    return candidates
      .map(c => ({ ...c, score: maxAvg > 0 ? (c.avg / maxAvg) * 100 : 0 }))
      .sort((a, b) => b.score - a.score)[0];
  }, [comparisonData, groupComparison]);

  // ── Time-series per group for line chart ──────────────────────────────────
  const timeSeries = useMemo(() => {
    // Use API comparison data if available
    if (comparisonData?.groupComparisons?.length > 0) {
      return comparisonData.groupComparisons
        .filter(g => g.batchMetrics?.length > 0)
        .map((g, idx) => {
          // Flatten all time series from all batches in this group
          const allRecords = g.batchMetrics?.flatMap(b => 
            (b.metricTimeSeries || []).filter(r => !metricName || r.metricName === metricName)
          ) || [];
          
          const sorted = allRecords
            .filter(r => r.recordedAt && !isNaN(parseFloat(r.value)))
            .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
          
          return {
            name: g.groupName,
            color: palette[idx % palette.length],
            data: sorted.map(r => ({
              label: new Date(r.recordedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
              value: parseFloat(r.value)
            }))
          };
        });
    }
    
    // Fallback to computed data
    if (!groupComparison.length) return [];
    return groupComparison
      .filter(g => g.records.length > 0)
      .map((g, idx) => {
        const sorted = [...g.records]
          .filter(r => r.measuredAt && !isNaN(parseFloat(r.value)))
          .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
        return {
          name: g.groupName,
          color: palette[idx % palette.length],
          data: sorted.map(r => ({
            label: new Date(r.measuredAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            value: parseFloat(r.value)
          }))
        };
      });
  }, [comparisonData, groupComparison, metricName]);

  // ── Bar chart data ─────────────────────────────────────────────────────────
  const avgBar = groupComparison.map((g, idx) => ({
    label: g.groupName?.length > 16 ? g.groupName.slice(0, 16) + '…' : (g.groupName || '—'),
    value: parseFloat(g.avg.toFixed(2)),
    color: palette[idx % palette.length]
  }));
  const achievementBar = groupComparison.map((g, idx) => ({
    label: g.groupName?.length > 16 ? g.groupName.slice(0, 16) + '…' : (g.groupName || '—'),
    value: g.achievementPct,
    color: g.achievementPct >= 100 ? '#10b981' : g.achievementPct >= 70 ? '#f59e0b' : '#ef4444'
  }));

  const selectedExperiment = experiments.find(e => e.id === selectedExpId);
  const experimentIsValid = selectedExperiment && (selectedExperiment.status === 'Active' || selectedExperiment.status === 'Completed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h3 className="font-hanken text-xl font-bold text-on-surface">T26 · So Sánh Phương Pháp Nuôi Trồng</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Phân tích hiệu quả giữa các nhóm xử lý để tìm ra "công thức vàng" cho sự phát triển cây trồng.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Thí Nghiệm</label>
            <select value={selectedExpId} onChange={e => setSelectedExpId(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[220px]">
              <option value="">— Chọn thí nghiệm —</option>
              {experiments.filter(e => e.status === 'Active' || e.status === 'Completed').map(e => (
                <option key={e.id} value={e.id}>{e.experimentCode} — {e.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Chỉ Số</label>
            <select value={metricName} onChange={e => setMetricName(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[180px]">
              <option value="">— Tất cả chỉ số —</option>
              {metricOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!experimentIsValid ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">⚖️</div>
          <p className="text-sm font-bold text-on-surface">Chưa chọn thí nghiệm đang chạy hoặc đã hoàn thành.</p>
          <p className="text-xs text-on-surface-variant mt-1">Vui lòng chọn một thí nghiệm ở trạng thái Active hoặc Completed để so sánh các nhóm xử lý.</p>
        </div>
      ) : (
        <>
          {/* Golden formula highlight */}
          {goldenFormula ? (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🏆</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Công thức vàng</span>
              </div>
              <h3 className="font-hanken text-2xl font-bold">{goldenFormula.groupName}</h3>
              <p className="text-sm text-amber-50 mt-1">
                Phương pháp xử lý cho chỉ số <strong>{metricName || 'tổng hợp'}</strong> đạt hiệu quả tốt nhất —
                giá trị trung bình <strong>{fmt(goldenFormula.avg)}</strong>
                {goldenFormula.targetAvg > 0 && <> (đạt {goldenFormula.achievementPct}% mục tiêu)</>}.
              </p>
              {goldenFormula.treatmentDescription && (
                <p className="text-xs text-amber-50 mt-2 italic line-clamp-2">📝 {goldenFormula.treatmentDescription}</p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
              ⚠️ Chưa có đủ dữ liệu đo lường để xác định công thức vàng. Hãy thêm nhóm xử lý và tiến hành ghi nhận số liệu.
            </div>
          )}

          {/* Top comparison stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số Nhóm Xử Lý</span>
              <div className="font-hanken text-3xl font-bold text-primary mt-2">{loading ? '…' : groups.length}</div>
              <p className="text-[10px] text-on-surface-variant mt-1">{groups.filter(g => g.groupType === 1).length} đối chứng · {groups.filter(g => g.groupType === 2).length} xử lý</p>
            </div>
            <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số Lô Thí Nghiệm</span>
              <div className="font-hanken text-3xl font-bold text-emerald-600 mt-2">{loading ? '…' : batches.length}</div>
              <p className="text-[10px] text-on-surface-variant mt-1">đã được triển khai</p>
            </div>
            <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tổng Đo Lường</span>
              <div className="font-hanken text-3xl font-bold text-blue-600 mt-2">
                {loadingRecords ? '…' : Object.values(recordsByBatch).reduce((s, arr) => s + arr.length, 0)}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1">bản ghi trên các lô</p>
            </div>
            <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chỉ Số Theo Dõi</span>
              <div className="font-hanken text-3xl font-bold text-amber-600 mt-2">{metricOptions.length}</div>
              <p className="text-[10px] text-on-surface-variant mt-1">loại chỉ số đã đo</p>
            </div>
          </div>

          {/* Multi-line chart comparing groups over time */}
          {timeSeries.length > 0 && (
            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-hanken text-base font-bold text-on-surface">Xu Hướng Phát Triển Theo Thời Gian</h3>
                  <p className="text-xs text-on-surface-variant">So sánh đường cong tăng trưởng giữa các nhóm</p>
                </div>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase">{metricName || 'Tất cả'}</span>
              </div>
              <MultiLineChart series={timeSeries} height={260} />
            </div>
          )}

          {/* Bar charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
              <div className="mb-3">
                <h3 className="font-hanken text-base font-bold text-on-surface">Giá Trị Trung Bình</h3>
                <p className="text-xs text-on-surface-variant">So sánh trung bình chỉ số giữa các nhóm</p>
              </div>
              {avgBar.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant">Chưa có dữ liệu</div>
              ) : (
                <BarChart data={avgBar} color="#486730" height={Math.max(160, avgBar.length * 36)} />
              )}
            </div>

            <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
              <div className="mb-3">
                <h3 className="font-hanken text-base font-bold text-on-surface">Tỷ Lệ Đạt Mục Tiêu</h3>
                <p className="text-xs text-on-surface-variant">% giá trị thực tế so với mục tiêu khoa học đề ra</p>
              </div>
              {achievementBar.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant">Chưa có dữ liệu mục tiêu</div>
              ) : (
                <BarChart data={achievementBar} color="#10b981" height={Math.max(160, achievementBar.length * 36)} unit="%" />
              )}
            </div>
          </div>

          {/* Detailed group comparison table */}
          <div className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h3 className="font-hanken text-base font-bold text-on-surface">Bảng So Sánh Chi Tiết</h3>
                <p className="text-xs text-on-surface-variant">Thống kê đầy đủ theo từng nhóm xử lý</p>
              </div>
            </div>
            {groupComparison.length === 0 ? (
              <div className="p-10 text-center text-xs text-on-surface-variant">
                <div className="text-3xl mb-2">🧪</div>
                <p>Thí nghiệm chưa có nhóm xử lý nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low/50 border-b border-outline-variant">
                    <tr>
                      {['Nhóm', 'Loại', 'Số Lô', 'Số Đo', 'TB', 'Min', 'Max', 'Mục Tiêu', 'Đạt %', 'Xếp Hạng'].map(h => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {[...groupComparison]
                      .sort((a, b) => b.avg - a.avg)
                      .map((g, idx) => {
                        const isWinner = goldenFormula && g.id === goldenFormula.id;
                        const typeLabel = GROUP_TYPE_LABELS[g.groupType] || `Loại ${g.groupType}`;
                        const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                        return (
                          <tr key={g.id} className={`hover:bg-surface-container/20 ${isWinner ? 'bg-amber-50/60' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{rankBadge}</span>
                                <span className="text-sm font-bold text-on-surface">{g.groupName || '—'}</span>
                                {isWinner && <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[10px] font-bold">VÀNG</span>}
                              </div>
                              {g.treatmentDescription && (
                                <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1 max-w-[220px]">{g.treatmentDescription}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${g.groupType === 1 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{typeLabel}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-on-surface font-semibold">{g.batchCount}</td>
                            <td className="px-4 py-3 text-sm text-on-surface">{g.recordCount}</td>
                            <td className="px-4 py-3 text-sm font-bold text-primary">{fmt(g.avg)}</td>
                            <td className="px-4 py-3 text-xs text-on-surface-variant">{fmt(g.min)}</td>
                            <td className="px-4 py-3 text-xs text-on-surface-variant">{fmt(g.max)}</td>
                            <td className="px-4 py-3 text-xs text-on-surface-variant">{g.targetAvg > 0 ? fmt(g.targetAvg) : '—'}</td>
                            <td className="px-4 py-3">
                              {g.targetAvg > 0 ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-12 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${g.achievementPct >= 100 ? 'bg-emerald-500' : g.achievementPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                      style={{ width: `${Math.min(100, g.achievementPct)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold">{g.achievementPct}%</span>
                                </div>
                              ) : <span className="text-[10px] text-on-surface-variant">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-on-surface">{rankBadge}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Statistical summary panel */}
          {goldenFormula && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
                <h3 className="font-hanken text-base font-bold text-on-surface mb-3">📋 Khuyến Nghị Khoa Học</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-emerald-700 mb-1">Phương pháp khuyến nghị</p>
                    <p className="text-sm text-on-surface">
                      Áp dụng phương pháp <strong>{goldenFormula.groupName}</strong> cho chỉ số <strong>{metricName || 'tổng hợp'}</strong>.
                      Giá trị trung bình đạt <strong>{fmt(goldenFormula.avg)}</strong>{goldenFormula.targetAvg > 0 && `, hoàn thành ${goldenFormula.achievementPct}% mục tiêu`}.
                    </p>
                  </div>
                  {goldenFormula.records.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-blue-700 mb-1">Mức độ ổn định</p>
                      <p className="text-sm text-on-surface">
                        Sai số giữa max và min là <strong>{fmt(goldenFormula.max - goldenFormula.min)}</strong>.
                        Số lượng mẫu đo: <strong>{goldenFormula.recordCount}</strong>.
                        Mức ổn định được đánh giá: <strong>{goldenFormula.max - goldenFormula.min < goldenFormula.avg * 0.2 ? 'Cao ✅' : goldenFormula.max - goldenFormula.min < goldenFormula.avg * 0.5 ? 'Trung bình ⚠️' : 'Thấp ❌'}</strong>.
                      </p>
                    </div>
                  )}
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-indigo-700 mb-1">Cần thêm dữ liệu</p>
                    <p className="text-sm text-on-surface">
                      Tiếp tục theo dõi trong <strong>{Math.max(0, batches.length - groupComparison.find(g => g.id === goldenFormula.id)?.batchCount || 0)}</strong> lô nữa
                      và bổ sung thêm các chỉ số như: năng suất, chất lượng, khả năng chống chịu sâu bệnh để có kết luận chắc chắn.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
                <h3 className="font-hanken text-base font-bold text-on-surface mb-3">🎯 Hiệu Quả Tổng Thể</h3>
                <div className="flex items-center justify-center">
                  <Gauge
                    value={goldenFormula.achievementPct || 0}
                    max={120}
                    label="Đạt mục tiêu"
                    color={goldenFormula.achievementPct >= 100 ? '#10b981' : goldenFormula.achievementPct >= 70 ? '#f59e0b' : '#ef4444'}
                    size={150}
                  />
                </div>
                <p className="text-[10px] text-center text-on-surface-variant mt-3">
                  Đánh giá dựa trên % hoàn thành mục tiêu của nhóm dẫn đầu.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResearcherComparison;