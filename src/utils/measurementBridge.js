/**
 * measurementBridge.js
 *
 * Cầu nối giữa TaskReport (dữ liệu báo cáo từ Student/Tech) và MeasurementRecord
 * (dữ liệu tăng trưởng chuẩn hoá theo stage của Researcher).
 *
 * Khi Student/Tech gửi TaskReport với các field đo lường, hệ thống TỰ ĐỘNG tạo
 * các MeasurementRecord tương ứng gắn vào stage mà task đó thuộc về.
 */

import { batchesApi } from '../api/experimentApi';

/**
 * Schema MeasurementRecord (theo BE response):
 * {
 *   id, experimentId, experimentStageId, batchId,
 *   measurementDefinitionId, metricName, unit, targetValue,
 *   value, measuredBy, measuredAt
 * }
 *
 * Vì vậy payload tối thiểu cần gửi:
 *   { experimentId, experimentStageId, batchId, measurementDefinitionId, value, measuredAt }
 * (BE tự populate metricName/unit/targetValue từ measurementDefinitionId)
 */

// Map key trong TaskReport.resultData → danh sách MeasurementRecord cần tạo
//   targetName: tên measurement chuẩn (BE dùng để lookup definition nếu không có measurementDefinitionId)
//   targetUnit: đơn vị
//   description: mô tả ngắn
export const MEASUREMENT_FIELD_MAP = {
  // ── Plant metrics ────────────────────────────────────────────────
  plantHeight: {
    targetName: 'height',
    targetUnit: 'cm',
    description: 'Chiều cao cây'
  },
  chieuCaoCm: {
    targetName: 'height',
    targetUnit: 'cm',
    description: 'Chiều cao cây'
  },
  leafCount: {
    targetName: 'leafCount',
    targetUnit: 'lá',
    description: 'Số lá trung bình'
  },
  soLaTrungBinh: {
    targetName: 'leafCount',
    targetUnit: 'lá',
    description: 'Số lá trung bình'
  },
  tocDoSinhTruong: {
    targetName: 'growthRate',
    targetUnit: 'cm/ngày',
    description: 'Tốc độ sinh trưởng'
  },
  tiLeSong: {
    targetName: 'survivalRate',
    targetUnit: '%',
    description: 'Tỷ lệ sống'
  },
  tiLeDauQua: {
    targetName: 'fruitingRate',
    targetUnit: '%',
    description: 'Tỷ lệ đậu quả'
  },

  // ── Watering ─────────────────────────────────────────────────────
  waterAmount: {
    targetName: 'waterAmount',
    targetUnit: 'L/m²',
    description: 'Lượng nước tưới'
  },
  luongNuocTong: {
    targetName: 'totalWater',
    targetUnit: 'lít',
    description: 'Tổng lượng nước'
  },
  soLanTuoi: {
    targetName: 'wateringCount',
    targetUnit: 'lần',
    description: 'Số lần tưới'
  },
  duration: {
    targetName: 'wateringDuration',
    targetUnit: 'phút',
    description: 'Thời gian tưới'
  },
  soilMoistureBefore: {
    targetName: 'soilMoistureBefore',
    targetUnit: '%',
    description: 'Độ ẩm đất trước tưới'
  },
  soilMoistureAfter: {
    targetName: 'soilMoistureAfter',
    targetUnit: '%',
    description: 'Độ ẩm đất sau tưới'
  },

  // ── Fertilizing ──────────────────────────────────────────────────
  fertilizerAmount: {
    targetName: 'fertilizerAmount',
    targetUnit: 'g/cây',
    description: 'Liều lượng phân bón'
  },
  soLanBonPhan: {
    targetName: 'fertilizingCount',
    targetUnit: 'lần',
    description: 'Số lần bón phân'
  },
  soLanPhunThuoc: {
    targetName: 'pesticideCount',
    targetUnit: 'lần',
    description: 'Số lần phun thuốc BVTV'
  },

  // ── Planting ─────────────────────────────────────────────────────
  plantCount: {
    targetName: 'plantCount',
    targetUnit: 'cây',
    description: 'Số cây trồng/thu hoạch'
  },
  plantSpacing: {
    targetName: 'plantSpacing',
    targetUnit: 'cm',
    description: 'Khoảng cách cây'
  },
  soLuong: {
    targetName: 'plantCount',
    targetUnit: 'cây',
    description: 'Số lượng'
  },

  // ── Inspection / Health ──────────────────────────────────────────
  affectedPlantCount: {
    targetName: 'affectedPlantCount',
    targetUnit: 'cây',
    description: 'Số cây bị ảnh hưởng'
  },
  tyLeHaoHut: {
    targetName: 'lossRate',
    targetUnit: '%',
    description: 'Tỷ lệ hao hụt'
  },

  // ── Harvest ──────────────────────────────────────────────────────
  harvestWeight: {
    targetName: 'weight',
    targetUnit: 'kg',
    description: 'Khối lượng thu hoạch'
  },
  sanLuongKg: {
    targetName: 'weight',
    targetUnit: 'kg',
    description: 'Sản lượng (kg)'
  },
  sanLuongTan: {
    targetName: 'weightTon',
    targetUnit: 'tấn',
    description: 'Sản lượng (tấn)'
  },
  averagePerPlant: {
    targetName: 'yieldPerPlant',
    targetUnit: 'kg/cây',
    description: 'Trung bình/cây'
  },
  moistureContent: {
    targetName: 'moistureContent',
    targetUnit: '%',
    description: 'Độ ẩm sản phẩm'
  },

  // ── PostHarvest ──────────────────────────────────────────────────
  khoiLuongBaoQuan: {
    targetName: 'storageWeight',
    targetUnit: 'kg',
    description: 'Khối lượng bảo quản'
  },
  nhietDoBaoQuan: {
    targetName: 'storageTemp',
    targetUnit: '°C',
    description: 'Nhiệt độ bảo quản'
  }
};

/**
 * Trích xuất các MeasurementRecord từ TaskReport.resultData
 *
 * @param {Object} resultData - { key: value, ... } từ task report
 * @returns {Array<{ name, value, unit, description, sourceKey }>}
 */
export function extractMeasurementsFromReport(resultData = {}) {
  if (!resultData || typeof resultData !== 'object') return [];

  const measurements = [];
  for (const [key, value] of Object.entries(resultData)) {
    const mapping = MEASUREMENT_FIELD_MAP[key];
    if (!mapping) continue;

    // Bỏ qua giá trị rỗng/không hợp lệ
    if (value === '' || value === null || value === undefined) continue;

    // Convert string → number nếu có thể
    let numericValue = value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) numericValue = parsed;
    }

    measurements.push({
      name: mapping.targetName,
      value: numericValue,
      unit: mapping.targetUnit,
      description: mapping.description,
      sourceKey: key // Giữ lại key gốc để debug
    });
  }

  return measurements;
}

/**
 * Build payload cho /measurement-records (legacy - không có MeasurementDefinitionId).
 *
 * ⚠️ Schema response của MeasurementRecord KHÔNG có các field sau:
 *   measurementName, aggregate, sourceType, sourceId, sortOrder, notes.
 * BE sẽ tự populate metricName/unit/targetValue từ definition (nếu measurementDefinitionId có),
 * hoặc từ name lookup (legacy).
 *
 * Vì vậy payload chỉ chứa:
 *   { experimentId, experimentStageId, batchId, measurementDefinitionId?, value, measuredAt, extraData? }
 *
 * @param {Object} task - Task object (cần có experimentId/stageId/batchId)
 * @param {Array} measurements - Output từ extractMeasurementsFromReport
 * @param {Object} extraMeta - { measuredAt, notes, definitions? }
 * @param {Map} [definitionLookup] - Optional: Map<name, MeasurementDefinition> để map measurementName → definitionId
 * @returns {Array<Object>} - Danh sách payloads
 */
export function buildMeasurementPayloads(task, measurements, extraMeta = {}, definitionLookup = null) {
  if (!measurements || measurements.length === 0) return [];

  const experimentId = task?.experimentId || task?.experiment?.id;
  const stageId = task?.stageId || task?.experimentStageId || task?.stage?.id;
  const batchId = task?.batchId || task?.batch?.id;

  if (!experimentId) {
    console.warn('[measurementBridge] task thiếu experimentId, không thể tạo measurement:', task);
    return [];
  }

  const measuredAt = extraMeta.measuredAt || extraMeta.performedAt || new Date().toISOString();

  return measurements.map((m) => {
    // Nếu có definitionLookup, tìm measurementDefinitionId theo name hoặc metricName match
    let measurementDefinitionId = null;
    if (definitionLookup && definitionLookup instanceof Map) {
      const def = definitionLookup.get(m.name) || definitionLookup.get(m.metricName);
      if (def && def.id) measurementDefinitionId = def.id;
    }

    const payload = {
      experimentId,
      experimentStageId: stageId || null,
      batchId: batchId || null,
      taskId: task.id || task?.taskId || null,
      value: typeof m.value === 'number' ? m.value : parseFloat(m.value) || 0,
      measuredAt
    };

    if (measurementDefinitionId) {
      payload.measurementDefinitionId = measurementDefinitionId;
    } else {
      // Legacy fallback - gửi name để BE có thể lookup
      payload.metricName = m.name;
    }

    if (extraMeta.notes) {
      payload.extraData = { note: extraMeta.notes, sourceKey: m.sourceKey };
    }

    return payload;
  });
}

/**
 * Gọi API tạo measurement records song song (Promise.allSettled để không fail cả batch)
 *
 * @param {Array} payloads - Output từ buildMeasurementPayloads
 * @param {Object} measurementApi - measurementRecordsApi (inject để test)
 * @returns {Promise<{ success: number, failed: number, errors: any[] }>}
 */
export async function createMeasurementsFromTaskReport(payloads, measurementApi) {
  if (!payloads || payloads.length === 0) {
    return { success: 0, failed: 0, errors: [], measurements: [] };
  }

  const results = await Promise.allSettled(
    payloads.map(p => measurementApi.create(p))
  );

  const success = [];
  const errors = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      success.push(r.value);
    } else {
      errors.push({ payload: payloads[idx], error: r.reason?.message || String(r.reason) });
    }
  });

  return {
    success: success.length,
    failed: errors.length,
    errors,
    measurements: success
  };
}

/**
 * Gọi POST /measurement-records/bulk — gom nhiều record thành 1 request.
 * Theo spec MeasurementStatistics v1.0: mỗi lần đo 1 cây → tạo N records
 * (1 record / metric) với cùng MeasuredAt, BatchId, StageId.
 *
 * Mỗi item gồm:
 *   { measurementDefinitionId, value, metricName?, unit?, targetValue? }
 *
 * @param {Object} task - Task có experimentId, batchId, stageId
 * @param {Array<{definitionId, value, metricName?, unit?, targetValue?}>} items - Mỗi item 1 metric
 * @param {Object} extraMeta - { measuredAt, notes }
 * @param {Object} bulkApi - measurementRecordsApi.bulk (inject để test)
 * @returns {Promise<{ created: number, skipped: number, warnings: string[], records: any[] }>}
 */
export async function createMeasurementsBulk(task, items, extraMeta, bulkApi) {
  if (!items || items.length === 0) {
    return { created: 0, skipped: 0, warnings: [], records: [] };
  }

  const experimentId = task?.experimentId || task?.experiment?.id;
  const stageId = task?.stageId || task?.experimentStageId || task?.stage?.id;
  const batchId = task?.batchId || task?.batch?.id;

  if (!experimentId || !batchId) {
    return {
      created: 0,
      skipped: items.length,
      warnings: ['Thiếu experimentId hoặc batchId — không thể tạo measurement.'],
      records: []
    };
  }

  const payload = {
    experimentId,
    experimentStageId: stageId || null,
    batchId,
    measuredAt: extraMeta?.measuredAt || extraMeta?.performedAt || new Date().toISOString(),
    extraData: extraMeta?.notes ? { note: extraMeta.notes } : null,
    items: items
    .filter(i => i.definitionId && i.value !== '' && i.value !== null && i.value !== undefined)
    .map(i => {
      const v = typeof i.value === 'string' ? parseFloat(i.value) : i.value;
      const item = {
        measurementDefinitionId: i.definitionId,
        value: isNaN(v) ? 0 : v
      };
      // Truyền kèm metricName/unit/targetValue để BE không phải lookup lại
      if (i.metricName) item.metricName = i.metricName;
      if (i.unit) item.unit = i.unit;
      if (i.targetValue != null) item.targetValue = i.targetValue;
      return item;
    })
  };

  if (payload.items.length === 0) {
    return { created: 0, skipped: 0, warnings: [], records: [] };
  }

  try {
    const res = await bulkApi(payload);
    // BE trả về { success, message, data: { created, skipped, warnings, records } }
    const data = res?.data || res;
    return {
      created: data?.created ?? payload.items.length,
      skipped: data?.skipped ?? 0,
      warnings: data?.warnings || [],
      records: data?.records || []
    };
  } catch (err) {
    return {
      created: 0,
      skipped: payload.items.length,
      warnings: [err.message || 'Lỗi gọi API bulk'],
      records: []
    };
  }
}

/**
 * Trích xuất items[] cho POST /bulk từ resultData có key dạng "def_<uuid>"
 * (Dùng cho luồng Measurement Task có dynamic form theo MeasurementDefinition)
 *
 * Mỗi item sẽ kèm theo metricName/unit/targetValue nếu có definitions.
 *
 * @param {Array<{key, value}>} resultData - từ TaskReport form
 * @param {Array<MeasurementDefinition>} [definitions] - danh sách definitions đã fetch
 * @returns {Array<{definitionId, value, metricName?, unit?, targetValue?}>}
 */
export function extractBulkItemsFromResultData(resultData = [], definitions = null) {
  if (!Array.isArray(resultData)) return [];
  const defsById = Array.isArray(definitions)
    ? Object.fromEntries(definitions.map(d => [d.id, d]))
    : {};
  const items = [];
  for (const r of resultData) {
    if (!r.key || !r.key.startsWith('def_')) continue;
    const definitionId = r.key.slice(4); // bỏ "def_"
    if (!definitionId) continue;
    if (r.value === '' || r.value === null || r.value === undefined) continue;
    const def = defsById[definitionId];
    const item = { definitionId, value: r.value };
    if (def) {
      item.metricName = def.metricName;
      item.unit = def.unit;
      if (def.targetValue != null) item.targetValue = def.targetValue;
    }
    items.push(item);
  }
  return items;
}

/**
 * Helper lấy tên measurement tiếng Việt (dùng để hiển thị ở UI)
 */
export function getMeasurementNameVi(key) {
  const mapping = MEASUREMENT_FIELD_MAP[key];
  return mapping ? mapping.description : key;
}

/**
 * Lấy summary preview từ resultData (cho toast notification)
 *
 * @param {Object} resultData
 * @returns {string} - "📏 18cm, 🍃 5 lá, ..."
 */
export function previewMeasurements(resultData = {}) {
  const measurements = extractMeasurementsFromReport(resultData);
  if (measurements.length === 0) return '';

  return measurements
    .slice(0, 3) // Chỉ show 3 cái đầu
    .map(m => `${m.value}${m.unit ? m.unit : ''}`)
    .join(' · ') + (measurements.length > 3 ? ` · +${measurements.length - 3}` : '');
}

/**
 * Lọc MeasurementDefinition của 1 nhóm duy nhất (theo groupId).
 *
 * Vì `GET /experiments/{id}/measurements` trả về definitions của TẤT CẢ các nhóm
 * (Control, Phân hữu cơ, Phân NPK, ...) mà mỗi nhóm có cùng tập metricName,
 * nên cần lọc để chỉ lấy definitions của nhóm mà task này thuộc về.
 *
 * Ưu tiên groupId theo thứ tự:
 *   1. explicitGroupId — fetch trực tiếp qua GET /batches/{batchId} (chắc chắn đúng)
 *   2. task.batch.groupId — nếu BE populate batch vào task
 *   3. task.batchGroupId / task.groupId — fallback field flat
 *   4. Nếu không có → dedupe theo metricName (giữ bản ghi đầu)
 *
 * @param {Array} definitions - toàn bộ definitions trả về từ API
 * @param {Object} task - task object
 * @param {string} [explicitGroupId] - groupId fetch trực tiếp từ API (ưu tiên cao nhất)
 * @returns {Array} - Chỉ definitions của 1 nhóm
 */
export function filterDefinitionsByTaskGroup(definitions, task, explicitGroupId) {
  if (!Array.isArray(definitions) || definitions.length === 0) return [];

  const taskGroupId =
    explicitGroupId ||
    task?.batch?.groupId ||
    task?.batchGroupId ||
    task?.groupId;

  if (taskGroupId) {
    const sameGroup = definitions.filter(d => d.groupId === taskGroupId);
    if (sameGroup.length > 0) return sameGroup;
  }

  // Fallback: dedupe theo metricName (giữ bản ghi đầu)
  const seen = new Set();
  const deduped = [];
  for (const d of definitions) {
    const key = (d.metricName || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }
  return deduped;
}

/**
 * Lấy groupId của 1 batch qua API GET /batches/{batchId}.
 * Dùng để chắc chắn filter đúng nhóm cho task đo lường.
 *
 * @param {string} batchId
 * @returns {Promise<{groupId: string|null, groupName: string, batchCode: string, ...}|null>}
 */
export async function fetchBatchGroupInfo(batchId) {
  if (!batchId) return null;
  try {
    const b = await batchesApi.getById(batchId);
    if (!b) return null;
    return {
      groupId: b.groupId || null,
      groupName: b.groupName || '',
      batchCode: b.batchCode || '',
      ...b
    };
  } catch {
    return null;
  }
}