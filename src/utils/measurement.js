/**
 * helpers/measurement.js
 *
 * Helper cho Measurement Records:
 *  - Bulk payload builder (theo spec MeasurementStatistics v1.0)
 *  - Per-definition value validator (kết hợp /validate API + rule local)
 *  - Format utilities cho UI hiển thị thống kê
 */

/**
 * Convert từ Technician form rows → items[] cho POST /measurement-records/bulk
 *
 * @param {Array<{ definitionId, value }>} rows - Mỗi row 1 metric
 * @returns {Array<{ measurementDefinitionId, value }>}
 */
export function buildBulkItems(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(r => r.definitionId && r.value !== '' && r.value !== null && r.value !== undefined)
    .map(r => {
      let v = r.value;
      if (typeof v === 'string') v = parseFloat(v);
      return {
        measurementDefinitionId: r.definitionId,
        value: isNaN(v) ? 0 : v
      };
    });
}

/**
 * Validate một giá trị theo rule local (sanity check trước khi gọi /validate)
 *
 * @param {{ unit, targetValue, metricName }} definition
 * @param {number|string} value
 * @returns {string|null} - Thông báo lỗi hoặc null nếu hợp lệ
 */
export function localValidateValue(definition, value) {
  if (value === '' || value === null || value === undefined) return null; // Để trống OK ở step này
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Giá trị phải là số';
  if (num < 0) return 'Giá trị không được âm';
  const unit = (definition?.unit || '').trim();
  const name = (definition?.metricName || '').toLowerCase();
  const target = parseFloat(definition?.targetValue);

  // Phần trăm 0–100
  if (unit === '%' && num > 100) {
    return `Giá trị ${definition.metricName} là phần trăm nên phải nằm trong [0, 100].`;
  }
  // Thang điểm màu sắc 1–5
  if (name.includes('màu sắc') && (num < 1 || num > 5)) {
    return `${definition.metricName} theo thang điểm 1–5, giá trị ${num} không hợp lệ.`;
  }
  // Sanity target * 5
  if (!isNaN(target) && target > 0 && num > target * 5) {
    return `Giá trị ${definition.metricName} vượt quá 5 lần target ${target}. Vui lòng kiếm tra lại.`;
  }
  return null;
}

/**
 * Phân loại status theo target
 */
export function getValueStatus(definition, value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || value === '' || value === null || value === undefined) return 'unknown';
  const target = parseFloat(definition?.targetValue);
  if (isNaN(target)) return 'ok';
  if (num >= target) return 'exceeded';
  if (num >= target * 0.8) return 'close';
  return 'below';
}

/**
 * Format 1 ô giá trị thống kê (avg/min/max/stddev/…)
 */
export function formatStat(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return n.toFixed(digits);
}

/**
 * Format tỉ lệ đạt target (0.95 → "95%")
 */
export function formatRatio(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

/**
 * Helper: Chuẩn hoá key `metricName + unit` để gom nhóm các metric trùng tên.
 * - Trim khoảng trắng đầu/cuối
 * - Lowercase toàn bộ
 * - VD: "Chiều cao cây" + " cm" === "Chiều cao cây " + "cm"
 */
export function metricGroupKey(metricName, unit) {
  const name = (metricName || '').trim().toLowerCase();
  const u = (unit || '').trim().toLowerCase();
  return `${name}__${u}`;
}

/**
 * Helper: Lấy tên hiển thị chuẩn hoá (trim). Dùng làm label cho row đã gom.
 */
export function metricDisplayName(metricName) {
  return (metricName || '').trim();
}

/**
 * Build bảng so sánh giữa các nhóm dựa trên `crossGroupComparison`
 *
 * Gom các metric có cùng `metricName + unit` (sau trim/lowercase) thành 1 row,
 * rồi TỰ TÍNH LẠI winner (`bestGroupName`) và `maxDifference` dựa trên tập
 * `groupValues` đã gom — KHÔNG tin tưởng `bestGroupName` / `maxDifference` từ
 * API, vì BE thống kê theo `definitionId` nên các row con có thể chỉ ra winner
 * khác nhau (một metric không có data ở group A, có data ở group B → BE đánh dấu
 * group B thắng, mặc dù group A có data với giá trị cao hơn từ metric khác cùng
 * tên).
 *
 * Quy tắc gom:
 * - Key: `metricName.trim().toLowerCase() + "__" + unit.trim().toLowerCase()`.
 * - GroupValues: merge theo `groupId`, ưu tiên record có `sampleCount > 0`.
 *   Khi cả 2 cùng có data → giữ giá trị có `sampleCount` lớn hơn (data phong phú).
 * - Winner: trên tập groups có `sampleCount > 0`, lấy group có `average` lớn nhất
 *   (giả định nghiệp vụ cây trồng: average CAO = TỐT).
 * - maxDifference: `max(average) - min(average)` trên tập groups có data.
 *
 * @param {object} crossGroupComparison
 * @returns {Array<{
 *   key, metricName, unit, groups, maxDifference, bestGroupName, significantDifference, _mergedFrom
 * }>}
 */
export function buildComparisonTable(crossGroupComparison) {
  if (!crossGroupComparison?.metrics) return [];

  // Bước 1: Gom các metric trùng `metricName + unit`
  const map = new Map();
  for (const m of crossGroupComparison.metrics) {
    const key = metricGroupKey(m.metricName, m.unit);
    if (!map.has(key)) {
      map.set(key, {
        key,
        metricName: metricDisplayName(m.metricName),
        unit: m.unit || '',
        groups: [],
        maxDifference: 0,
        bestGroupName: null,
        bestGroupId: null,
        significantDifference: false,
        _mergedFrom: 0
      });
    }
    const agg = map.get(key);
    agg._mergedFrom += 1;

    for (const gv of m.groupValues || []) {
      const existing = agg.groups.find(x => x.groupId === gv.groupId);
      if (existing) {
        const incomingHasData = (gv.sampleCount || 0) > 0;
        const existingHasData = (existing.sampleCount || 0) > 0;
        if (incomingHasData && !existingHasData) {
          Object.assign(existing, gv);
        } else if (incomingHasData && existingHasData) {
          // Cả 2 cùng có data → ưu tiên record có sampleCount lớn hơn
          if ((gv.sampleCount || 0) > (existing.sampleCount || 0)) {
            Object.assign(existing, gv);
          }
        }
        // Nếu incoming không có data mà existing có data → giữ existing
      } else {
        agg.groups.push({ ...gv });
      }
    }

    // Track significantDifference (chỉ true nếu CÓ metric gốc đánh dấu)
    if (m.significantDifference) agg.significantDifference = true;
  }

  // Bước 2: TỰ TÍNH LẠI winner và maxDifference trên tập groups đã gom
  // (KHÔNG tin tưởng bestGroupName/maxDifference từ BE)
  for (const agg of map.values()) {
    const dataGroups = agg.groups.filter(g => (g.sampleCount || 0) > 0);
    if (dataGroups.length === 0) {
      // Không có data ở group nào
      agg.bestGroupName = null;
      agg.bestGroupId = null;
      agg.maxDifference = 0;
      continue;
    }
    // Tìm group có average lớn nhất (với metrics cây trồng: cao = tốt)
    let best = dataGroups[0];
    for (const g of dataGroups.slice(1)) {
      if ((g.average || 0) > (best.average || 0)) best = g;
    }
    agg.bestGroupName = best.groupName;
    agg.bestGroupId = best.groupId;
    // maxDifference = max - min trên tập groups có data
    const max = Math.max(...dataGroups.map(g => g.average || 0));
    const min = Math.min(...dataGroups.map(g => g.average || 0));
    agg.maxDifference = max - min;
  }

  return Array.from(map.values());
}

/**
 * Tính lại `summary` dựa trên bảng comparison đã gom.
 * BE trả summary theo `definitionId` (đếm sai khi có duplicate metricName).
 * FE tự đếm lại: trong số các metricName (unique) có data ở ≥2 group,
 * group nào thắng nhiều row nhất.
 *
 * @param {Array} comparisonRows - output của buildComparisonTable
 * @param {Array<string>} allGroupNames - danh sách tên group
 * @returns {{ bestGroupId, bestGroupName, summary }}
 */
export function buildComparisonSummary(comparisonRows, allGroupNames = []) {
  if (!comparisonRows || comparisonRows.length === 0) {
    return { bestGroupId: null, bestGroupName: null, summary: null };
  }
  const winCount = {};
  for (const r of comparisonRows) {
    if (!r.bestGroupName) continue;
    winCount[r.bestGroupName] = (winCount[r.bestGroupName] || 0) + 1;
  }
  const entries = Object.entries(winCount);
  if (entries.length === 0) {
    return { bestGroupId: null, bestGroupName: null, summary: null };
  }
  // Sắp theo số lần thắng giảm dần
  entries.sort((a, b) => b[1] - a[1]);
  const [bestName, bestCount] = entries[0];
  const totalRows = comparisonRows.length;
  const bestGroupId = comparisonRows.find(r => r.bestGroupName === bestName)?.bestGroupId || null;
  return {
    bestGroupId,
    bestGroupName: bestName,
    summary: `Nhóm ${bestName} đạt kết quả tốt nhất ở ${bestCount}/${totalRows} chỉ số.`
  };
}

/**
 * Gom metrics trong 1 group (per-group table) theo `metricName + unit`.
 * Cùng lý do như buildComparisonTable: gom các row trùng tên trong bảng
 * "Chi tiết theo nhóm" để người dùng không phải nhìn N row giống nhau.
 *
 * Mỗi metric trả về là bản GỘP — giữ giá trị "tốt nhất" (có sampleCount > 0
 * và average lớn/nhỏ tùy nghiệp vụ). Với metric nghiệp vụ cây trồng thì
 * average CAO = TỐT.
 *
 * Trả về Array<mergedMetric>
 */
export function mergeGroupMetrics(metrics) {
  if (!Array.isArray(metrics)) return [];
  const map = new Map();
  for (const m of metrics) {
    const key = metricGroupKey(m.metricName, m.unit);
    if (!map.has(key)) {
      map.set(key, {
        key,
        metricName: metricDisplayName(m.metricName),
        unit: m.unit || '',
        // giữ 1 bản ghi gốc, sau đó merge
        _sources: []
      });
    }
    map.get(key)._sources.push(m);
  }

  const result = [];
  for (const [, bucket] of map.entries()) {
    const merged = { ...bucket._sources[0], metricName: bucket.metricName, unit: bucket.unit };
    for (const src of bucket._sources.slice(1)) {
      // Ưu tiên giá trị có sampleCount > 0 (data thật)
      const existingHasData = (merged.sampleCount || 0) > 0;
      const incomingHasData = (src.sampleCount || 0) > 0;
      if (incomingHasData && !existingHasData) {
        Object.assign(merged, src, { metricName: bucket.metricName, unit: bucket.unit });
      } else if (incomingHasData && existingHasData) {
        // 2 nguồn đều có data: lấy sampleCount lớn hơn (data phong phú hơn)
        if ((src.sampleCount || 0) > (merged.sampleCount || 0)) {
          Object.assign(merged, src, { metricName: bucket.metricName, unit: bucket.unit });
        }
      }
    }
    result.push(merged);
  }
  return result;
}

/**
 * Helper: parse `measuredAt` để hiển thị ngày (YYYY-MM-DD) trong growthOverTime
 */
export function formatGrowthDate(measuredAt) {
  if (!measuredAt) return '';
  const d = new Date(measuredAt);
  if (isNaN(d.getTime())) return measuredAt;
  return d.toISOString().split('T')[0];
}

/**
 * Helper để tải blob từ API xuống file
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
