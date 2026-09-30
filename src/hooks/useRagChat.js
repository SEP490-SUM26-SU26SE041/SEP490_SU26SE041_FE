import { useState, useCallback, useEffect } from 'react';
import ragApi from '../api/ragApi';
import chatStorage from '../storage/chatStorage';

const MAX_HISTORY_IN_REQUEST = 12;


/**
 * Hook quản lý chat RAG — Multi-Conversation (giống ChatGPT):
 *  - Mỗi conversation có id riêng, có thể tạo / switch / xóa / đổi tên.
 *  - Auto-set title từ câu hỏi user đầu tiên.
 *  - Lưu vào localStorage theo scope (xem chatStorage.js) → tách bạch Student/Technician.
 *
 * Props:
 *  - initialKnowledgeGroup: group mặc định (null = tất cả)
 *  - enableRetrievalOnly: bật toggle "Chỉ truy xuất" (chỉ Technician)
 *  - autoLoadLatest: tự load conversation mới nhất khi mount
 *  - scope: 'student' | 'technician' | 'researcher' | 'default' (key localStorage)
 */
export function useRagChat(options = {}) {
  const {
    initialKnowledgeGroup = null,
    enableRetrievalOnly = false,
    autoLoadLatest = true,
    scope = 'default'
  } = options;

  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState(() => chatStorage.listConversations(scope));
  const [loading, setLoading] = useState(false);
  const [knowledgeGroup, setKnowledgeGroup] = useState(initialKnowledgeGroup);
  const [retrievalOnly, setRetrievalOnly] = useState(false);
  const [error, setError] = useState(null);
  const [healthOk, setHealthOk] = useState(null);

  // Refresh index khi mount hoặc đổi scope
  useEffect(() => {
    if (!autoLoadLatest) return;
    let latest = chatStorage.listConversations(scope)[0];
    if (!latest) {
      const fresh = chatStorage.createConversation(undefined, scope);
      latest = { id: fresh.id, title: fresh.title, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, day: fresh.day };
    }
    setConversation(chatStorage.getConversation(latest.id, scope) || chatStorage.createConversation(undefined, scope));
    setConversations(chatStorage.listConversations(scope));
  }, [autoLoadLatest, scope]);

  // Health check
  useEffect(() => {
    let cancelled = false;
    ragApi.health()
      .then(() => { if (!cancelled) setHealthOk(true); })
      .catch(() => { if (!cancelled) setHealthOk(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshIndex = useCallback(() => {
    setConversations(chatStorage.listConversations(scope));
  }, [scope]);

  /**
   * Tạo conversation mới (auto switch sang nó).
   */
  const newConversation = useCallback(() => {
    const fresh = chatStorage.createConversation(undefined, scope);
    setConversation(fresh);
    refreshIndex();
    setError(null);
    return fresh;
  }, [refreshIndex, scope]);

  /**
   * Switch sang conversation có id.
   */
  const switchConversation = useCallback((id) => {
    const c = chatStorage.getConversation(id, scope);
    if (!c) return;
    setConversation(c);
    setError(null);
  }, [scope]);

  /**
   * Xóa 1 conversation.
   * Nếu đang mở cuộc đó và còn cuộc khác → switch sang cuộc đầu tiên.
   * Nếu xóa cuộc cuối → tạo mới.
   */
  const deleteConversation = useCallback((id) => {
    if (!id) return;
    chatStorage.deleteConversation(id, scope);
    let list = chatStorage.listConversations(scope);

    if (conversation?.id === id) {
      if (list.length === 0) {
        const fresh = chatStorage.createConversation(undefined, scope);
        list = [{ id: fresh.id, title: fresh.title, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt, day: fresh.day }];
        setConversation(fresh);
      } else {
        setConversation(chatStorage.getConversation(list[0].id, scope));
      }
    }
    setConversations(list);
  }, [conversation, scope, refreshIndex]);

  /**
   * Đổi tên conversation.
   */
  const renameConversation = useCallback((id, newTitle) => {
    chatStorage.renameConversation(id, newTitle, scope);
    setConversations(chatStorage.listConversations(scope));
    if (conversation?.id === id) {
      setConversation(prev => prev ? { ...prev, title: newTitle.slice(0, 60).trim() || prev.title } : prev);
    }
  }, [conversation, scope]);

  /**
   * Gửi 1 câu hỏi.
   */
  const send = useCallback(async (question) => {
    if (!question || !question.trim() || loading) return;
    if (!conversation) return;

    setError(null);

    const userMsg = {
      role: 'user',
      content: question,
      ts: Date.now(),
      knowledgeGroup,
      retrievalOnly: enableRetrievalOnly ? retrievalOnly : undefined
    };

    // Optimistic update UI
    const updatedConv = {
      ...conversation,
      messages: [...conversation.messages, userMsg]
    };
    setConversation(updatedConv);
    chatStorage.saveConversation(updatedConv, scope);
    refreshIndex();

    setLoading(true);
    try {
      const histSrc = conversation.messages.slice(-MAX_HISTORY_IN_REQUEST);
      const history = histSrc.map(m => ({ role: m.role, content: m.content }));

      const result = await ragApi.chat(
        question,
        history,
        knowledgeGroup,
        enableRetrievalOnly ? retrievalOnly : false
      );

      const aiMsg = {
        role: 'assistant',
        content: result.ok ? result.answer : `⚠️ ${result.error || 'Chat failed'}`,
        sources: result.sources,
        ts: Date.now()
      };

      const finalConv = {
        ...updatedConv,
        messages: [...updatedConv.messages, aiMsg]
      };
      chatStorage.saveConversation(finalConv, scope);
      const stored = chatStorage.getConversation(conversation.id, scope);
      setConversation(stored || finalConv);
      refreshIndex();

      if (!result.ok) setError(result.error || 'Chat failed');
    } catch (e) {
      const errMsg = {
        role: 'assistant',
        content: `⚠️ ${e?.message || 'Lỗi kết nối RAG API'}`,
        ts: Date.now()
      };
      const finalConv = {
        ...updatedConv,
        messages: [...updatedConv.messages, errMsg]
      };
      chatStorage.saveConversation(finalConv, scope);
      setConversation(chatStorage.getConversation(conversation.id, scope) || finalConv);
      refreshIndex();
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [conversation, loading, knowledgeGroup, retrievalOnly, enableRetrievalOnly, refreshIndex, scope]);

  const messages = conversation?.messages ?? [];

  return {
    // State
    conversation,
    conversations,
    messages,
    loading,
    error,
    healthOk,
    knowledgeGroup,
    retrievalOnly: enableRetrievalOnly ? retrievalOnly : null,

    // Conversation management
    newConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    refreshIndex,

    // Chat
    send,
    setKnowledgeGroup,
    setRetrievalOnly: enableRetrievalOnly ? setRetrievalOnly : () => {}
  };
}

export default useRagChat;