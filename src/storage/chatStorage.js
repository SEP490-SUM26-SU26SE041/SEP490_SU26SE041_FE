// ── Chat Conversations Storage ────────────────────────────────────────────────
// Theo tài liệu RAG mục 11.7: BE không lưu session → FE tự quản lý multi-conv.
//
// Cấu trúc lưu trữ (scope theo role để tách bạch Student/Technician):
//   rag_chat_<scope>_conversations   → [{ id, title, createdAt, updatedAt, day }, ...]
//   rag_conv_<scope>_<convId>        → { id, title, messages, createdAt, updatedAt, day }
//   rag_chat_<scope>_YYYY-MM-DD      → legacy: messages theo ngày
//
// scope mặc định: 'default' (chia sẻ). Có thể truyền 'student' | 'technician' | 'researcher'.

const CONVS_INDEX_KEY = (scope) => `rag_chat_${scope}_conversations`;
const MAX_CONVS = 50;            // tối đa cuộc hội thoại (cũ nhất bị xóa nếu vượt)
const MAX_MESSAGES_PER_CONV = 200;
const MAX_TITLE_LEN = 60;

const dayKey = (scope, date = new Date()) =>
  `rag_chat_${scope}_${date.toISOString().slice(0, 10)}`;

const convKey = (scope, id) => `rag_conv_${scope}_${id}`;

const safeParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};

const newId = () =>
  `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[ragChatStorage] localStorage full', e);
    return false;
  }
};;

/**
 * @typedef {Object} StoredMessage
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {Array} [sources]
 * @property {number} ts
 * @property {string|null} [knowledgeGroup]
 * @property {boolean} [retrievalOnly]
 */

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string} day - 'YYYY-MM-DD'
 * @property {StoredMessage[]} messages
 */

export const chatStorage = {
  // ── Conversations API ──────────────────────────────────────────────────────

  /** Liệt kê tất cả conversation của scope, mới nhất trước. */
  listConversations(scope = 'default') {
    return safeParse(localStorage.getItem(CONVS_INDEX_KEY(scope)), []);
  },

  /** Lấy 1 conversation theo id (kèm messages). */
  getConversation(id, scope = 'default') {
    if (!id) return null;
    return safeParse(localStorage.getItem(convKey(scope, id)), null);
  },

  /** Tạo conversation mới. */
  createConversation(initialTitle = 'Cuộc hội thoại mới', scope = 'default') {
    const id = newId();
    const now = Date.now();
    const conv = {
      id,
      title: initialTitle,
      createdAt: now,
      updatedAt: now,
      day: new Date(now).toISOString().slice(0, 10),
      messages: []
    };
    safeWrite(convKey(scope, id), conv);
    this._addToIndex(conv, scope);
    return conv;
  },

  /**
   * Cập nhật conversation (messages hoặc title).
   * Tự động update `updatedAt` và di chuyển lên đầu index.
   */
  saveConversation(conv, scope = 'default') {
    if (!conv || !conv.id) return;
    const next = {
      ...conv,
      updatedAt: Date.now(),
      day: new Date().toISOString().slice(0, 10)
    };
    if (next.messages.length > MAX_MESSAGES_PER_CONV) {
      next.messages = next.messages.slice(-MAX_MESSAGES_PER_CONV);
    }
    safeWrite(convKey(scope, next.id), next);
    this._addToIndex(next, scope);
  },

  /**
   * Push 1 message vào conversation; tự động cập nhật title từ câu hỏi đầu.
   */
  pushMessage(convId, message, scope = 'default') {
    const conv = this.getConversation(convId, scope);
    if (!conv) return null;

    const msg = { ...message, ts: message.ts || Date.now() };
    conv.messages.push(msg);

    if (conv.messages.filter(m => m.role === 'user').length === 1 && msg.role === 'user') {
      const t = (msg.content || '').slice(0, MAX_TITLE_LEN).trim();
      if (t) conv.title = t;
    }

    this.saveConversation(conv, scope);
    return msg;
  },

  /**
   * Xóa 1 conversation.
   */
  deleteConversation(id, scope = 'default') {
    if (!id) return;
    try { localStorage.removeItem(convKey(scope, id)); } catch { /* noop */ }

    const idx = this.listConversations(scope);
    const next = idx.filter(c => c.id !== id);
    safeWrite(CONVS_INDEX_KEY(scope), next);
  },

  /**
   * Đổi tên conversation.
   */
  renameConversation(id, newTitle, scope = 'default') {
    const conv = this.getConversation(id, scope);
    if (!conv) return;
    conv.title = (newTitle || '').slice(0, MAX_TITLE_LEN).trim() || conv.title;
    this.saveConversation(conv, scope);
  },

  /**
   * Xóa toàn bộ conversations của scope.
   */
  clearAllConversations(scope = 'default') {
    const list = this.listConversations(scope);
    for (const c of list) {
      try { localStorage.removeItem(convKey(scope, c.id)); } catch { /* noop */ }
    }
    safeWrite(CONVS_INDEX_KEY(scope), []);
  },

  /**
   * Lấy conversation gần nhất (updatedAt lớn nhất), hoặc tạo mới nếu chưa có.
   */
  getOrCreateLatest(scope = 'default') {
    const list = this.listConversations(scope);
    if (list.length === 0) {
      return this.createConversation(undefined, scope);
    }
    return this.getConversation(list[0].id, scope) || this.createConversation(undefined, scope);
  },

  // ── Legacy API (giữ tương thích ngược với code cũ theo NGÀY) ──────────────

  getDay(date = new Date(), scope = 'default') {
    const d = typeof date === 'string' ? new Date(date) : date;
    return safeParse(localStorage.getItem(dayKey(scope, d)), []);
  },

  pushMessageLegacy(message, date = new Date(), scope = 'default') {
    const key = dayKey(scope, date);
    const list = safeParse(localStorage.getItem(key), []);
    list.push({ ...message, ts: message.ts || Date.now() });
    const trimmed = list.length > MAX_MESSAGES_PER_CONV ? list.slice(-MAX_MESSAGES_PER_CONV) : list;
    safeWrite(key, trimmed);

    const idxKey = `rag_chat_${scope}_days_index`;
    const idx = safeParse(localStorage.getItem(idxKey), []);
    const day = key.replace(`rag_chat_${scope}_`, '');
    if (!idx.includes(day)) {
      idx.push(day);
      safeWrite(idxKey, idx);
    }
  },

  clearDay(date, scope = 'default') {
    const d = typeof date === 'string' ? new Date(date) : date;
    const key = dayKey(scope, d);
    const day = key.replace(`rag_chat_${scope}_`, '');
    try { localStorage.removeItem(key); } catch { /* noop */ }

    const idxKey = `rag_chat_${scope}_days_index`;
    const idx = safeParse(localStorage.getItem(idxKey), []);
    safeWrite(idxKey, idx.filter(x => x !== day));
  },

    clearAll(scope = 'default') {
    this.clearAllConversations(scope);
    const oldDays = safeParse(localStorage.getItem(`rag_chat_${scope}_days_index`), []);
    for (const d of oldDays) {
      try { localStorage.removeItem(`rag_chat_${scope}_${d}`); } catch { /* noop */ }
    }
    try { localStorage.removeItem(`rag_chat_${scope}_days_index`); } catch { /* noop */ }
  },


  // ── Internal ───────────────────────────────────────────────────────────────

  _addToIndex(conv, scope = 'default') {
    const idx = this.listConversations(scope).filter(c => c.id !== conv.id);
    idx.unshift({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      day: conv.day
    });
    const trimmed = idx.slice(0, MAX_CONVS);
    if (idx.length > MAX_CONVS) {
      for (const c of idx.slice(MAX_CONVS)) {
        try { localStorage.removeItem(convKey(scope, c.id)); } catch { /* noop */ }
      }
    }
    safeWrite(CONVS_INDEX_KEY(scope), trimmed);
  }
};

export default chatStorage;