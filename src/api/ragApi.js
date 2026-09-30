// ── RAG Nông Nghiệp API Client ─────────────────────────────────────────────────
// Theo tài liệu RAG_NongNghiep_Integration_Guide.md (Phiên bản 1.2).
// API base: https://rag-nong-nghiep-api-15ms.onrender.com
//
// Lưu ý:
//   - Render free plan có thể sleep sau 15 phút → timeout 60s cho /chat.
//   - KHÔNG có auth header ở public API (BE không yêu cầu JWT).
//   - Lịch sử chat do FE tự lưu (BE không có session/conversation_id).

const BASE = 'https://rag-nong-nghiep-api-15ms.onrender.com';

// ── Types ──────────────────────────────────────────────────────────────────────
// (Chỉ mô tả trong JSDoc; FE không dùng TypeScript)

/**
 * @typedef {Object} Source
 * @property {string|null} file_name
 * @property {string|null} source
 * @property {number|null} page_number
 * @property {string|null} title
 * @property {string|null} section
 * @property {string|null} knowledge_group
 * @property {string} text
 */

/**
 * @typedef {Object} ChatHistoryMsg
 * @property {'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} ChatResult
 * @property {boolean} ok
 * @property {string} answer
 * @property {string} queryUsed
 * @property {Source[]} sources
 * @property {string|null} error
 */

// ── Helper fetch có timeout ────────────────────────────────────────────────────

async function request(path, init = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    if (!res.ok) {
      const text = await res.text();
      // FastAPI 422 → trả về { detail: [...] }
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j.detail) msg = `Validation: ${JSON.stringify(j.detail)}`;
        else if (j.message) msg = j.message;
      } catch { /* keep msg */ }
      throw new Error(msg);
    }
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

// ── 1. Health check ────────────────────────────────────────────────────────────

export const ragApi = {
  /**
   * GET /health — kiểm tra server RAG còn sống không.
   */
  health: async () => request('/health', {}, 15000),

  // ── 2. Indexing (Researcher) ────────────────────────────────────────────────

  /**
   * POST /indexing/upload — upload nhiều file PDF.
   * @param {File[]} files
   * @param {string} group - knowledge group (crops, livestock, soil, general...)
   * @returns {Promise<{source_path: string, group_path: string, files: string[], group: string}>}
   */
  uploadPdfs: async (files, group = 'general') => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    fd.append('group', group);
    const res = await fetch(`${BASE}/indexing/upload`, {
      method: 'POST',
      body: fd
      // KHÔNG set Content-Type — browser tự thêm boundary cho FormData
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return await res.json();
  },

  /**
   * POST /indexing/run — chạy pipeline indexing.
   * @param {string} sourcePath
   */
  runIndexing: async (sourcePath) =>
    request('/indexing/run', {
      method: 'POST',
      body: JSON.stringify({ source_path: sourcePath })
    }),

  /**
   * GET /indexing/status — trạng thái index hiện tại.
   */
  indexingStatus: async () => request('/indexing/status', {}, 15000),

  /**
   * POST /indexing/load — load lại index từ disk.
   */
  loadIndex: async () => request('/indexing/load', { method: 'POST' }),

  // ── 3. Chat (Student & Technician) ─────────────────────────────────────────

  /**
   * POST /chat — hỏi đáp RAG.
   * @param {string} question
   * @param {ChatHistoryMsg[]} history
   * @param {string|null} knowledgeGroup
   * @param {boolean} retrievalOnly
   * @returns {Promise<ChatResult>}
   */
  chat: async (question, history = [], knowledgeGroup = null, retrievalOnly = false) => {
    const data = await request('/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        history,
        retrieval_only: retrievalOnly,
        knowledge_group: knowledgeGroup
      })
    });
    return {
      ok: !!data.success,
      answer: data.answer ?? '',
      queryUsed: data.query_used ?? '',
      sources: Array.isArray(data.sources) ? data.sources : [],
      error: data.error ?? null
    };
  }
};

// ── Constants cho UI ───────────────────────────────────────────────────────────

export const KNOWLEDGE_GROUPS = [
  { value: null,        label: '🌐 Tất cả',                hint: 'Tìm trong mọi nhóm' },
  { value: 'crops',     label: '🌱 Cây trồng',            hint: 'Kỹ thuật canh tác cây trồng' },
  { value: 'livestock', label: '🐄 Chăn nuôi',            hint: 'Kỹ thuật chăn nuôi' },
  { value: 'soil',      label: '🌍 Đất & phân bón',       hint: 'Đặc tính đất, dinh dưỡng' },
  { value: 'pest',      label: '🐛 Sâu bệnh & thuốc BVTV',hint: 'Phòng trị sâu bệnh' },
  { value: 'general',   label: '📚 Tổng hợp',             hint: 'Kiến thức nông nghiệp tổng quát' }
];

export const RAG_BASE_URL = BASE;

export default ragApi;