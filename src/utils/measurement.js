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
 * Build bảng so sánh giữa các nhóm dựa trên `crossGroupComparison`
 * Trả về Array<{ metricName, unit, groups: {groupName, average}[] }>
 */
export function buildComparisonTable(crossGroupComparison) {
  if (!crossGroupComparison?.metrics) return [];
  return crossGroupComparison.metrics.map(m => ({
    definitionId: m.definitionId,
    metricName: m.metricName,
    unit: m.unit,
    groups: m.groupValues,
    maxDifference: m.maxDifference,
    bestGroupName: m.bestGroupName,
    significantDifference: m.significantDifference
  }));
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
