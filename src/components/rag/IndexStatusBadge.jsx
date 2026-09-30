import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import ragApi, { RAG_BASE_URL } from '../../api/ragApi';
import ConfirmModal from './ConfirmModal';

/**
 * Bảng trạng thái indexing + 2 nút Dashboard "Run Indexing" / "Reload Index".
 * Polling status mỗi 5 giây.
 */
const IndexStatusBadge = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError] = useState(null);
  const [pendingRun, setPendingRun] = useState(false); // mở modal nhập source_path
  const [sourcePath, setSourcePath] = useState('/data/pdfs');

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await ragApi.indexingStatus();
      setStatus(s);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleRun = async () => {
    setPendingRun(true);
  };

  const confirmRun = async () => {
    setPendingRun(false);
    const path = (sourcePath || '').trim();
    if (!path) {
      showToast('Vui lòng nhập source_path', 'warning');
      return;
    }
    try {
      setRunning(true);
      const res = await ragApi.runIndexing(path);
      if (res.success) {
        showToast(`Indexing thành công: ${res.n_docs} docs, ${res.n_chunks} chunks, ${res.n_vectors} vectors`, 'success');
      } else {
        showToast(`Indexing lỗi: ${res.error || 'unknown'}`, 'error');
      }
      fetchStatus();
    } catch (e) {
      showToast(`Run indexing lỗi: ${e?.message || e}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleLoad = async () => {
    try {
      setLoading2(true);
      const res = await ragApi.loadIndex();
      if (res.success) {
        showToast(`Load index thành công: ${res.n_vectors} vectors từ disk`, 'success');
      } else {
        showToast(`Load lỗi: ${res.error || 'unknown'}`, 'error');
      }
      fetchStatus();
    } catch (e) {
      showToast(`Load index lỗi: ${e?.message || e}`, 'error');
    } finally {
      setLoading2(false);
    }
  };

  const nDocs = status?.n_docs ?? status?.num_docs ?? status?.docs ?? null;
  const nChunks = status?.n_chunks ?? status?.num_chunks ?? status?.chunks ?? null;
  const nVectors = status?.n_vectors ?? status?.num_vectors ?? status?.vectors ?? null;
  const groups = status?.groups ?? status?.knowledge_groups ?? [];
  const isReady = status?.ready ?? status?.loaded ?? (nVectors > 0);
  const isIndexing = status?.indexing ?? status?.is_running ?? false;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-green-50 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            📊 Trạng thái Indexing
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            API: <code className="font-mono text-[10px]">{RAG_BASE_URL}</code>
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
          error ? 'bg-rose-100 text-rose-700' :
          loading ? 'bg-slate-100 text-slate-600' :
          isIndexing ? 'bg-amber-100 text-amber-700 animate-pulse' :
          isReady ? 'bg-emerald-100 text-emerald-700' :
          'bg-slate-100 text-slate-600'
        }`}>
          {error ? '🔴 Lỗi' :
           loading ? '⚪ Đang tải…' :
           isIndexing ? '🟡 Đang indexing…' :
           isReady ? '🟢 Sẵn sàng' : '⚪ Chưa sẵn sàng'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Docs" value={nDocs} />
          <StatBox label="Chunks" value={nChunks} />
          <StatBox label="Vectors" value={nVectors} />
        </div>

        {/* Groups */}
        {groups && groups.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Nhóm tri thức</p>
            <div className="flex flex-wrap gap-1">
              {groups.map(g => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
            ⚠️ {error}
            <div className="mt-1 text-[10px] text-rose-500">
              Có thể RAG server đang sleep (Render free plan). Đợi 30s rồi thử lại.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1"
          >
            {running ? '⏳ Đang chạy…' : '▶ Run Indexing'}
          </button>
          <button
            type="button"
            onClick={handleLoad}
            disabled={loading2}
            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1"
          >
            {loading2 ? '⏳ Đang load…' : '🔄 Reload Index'}
          </button>
        </div>

        {lastFetch && (
          <p className="text-[9px] text-slate-400 text-center">
            Auto-refresh mỗi 5s · Cập nhật lúc {lastFetch.toLocaleTimeString('vi-VN')}
          </p>
        )}
      </div>

      {/* Modal nhập source_path */}
      {pendingRun && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setPendingRun(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                ▶ Chạy Indexing Pipeline
              </h3>
              <button
                type="button"
                onClick={() => setPendingRun(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800">
                💡 Nhập đường dẫn tới <strong>file PDF hoặc thư mục PDF</strong> trên server
                (ví dụ: <code className="font-mono">/data/pdfs</code>).
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Source Path
                </label>
                <input
                  type="text"
                  value={sourcePath}
                  onChange={e => setSourcePath(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmRun();
                    else if (e.key === 'Escape') setPendingRun(false);
                  }}
                  placeholder="/data/pdfs"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRun(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmRun}
                disabled={running || !sourcePath.trim()}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white shadow-sm transition-colors"
              >
                {running ? '⏳ Đang chạy…' : '▶ Bắt đầu indexing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg p-2 text-center">
    <p className="text-[9px] font-bold uppercase text-slate-500">{label}</p>
    <p className="text-lg font-bold text-slate-900">{value != null ? value : '—'}</p>
  </div>
);

export default IndexStatusBadge;