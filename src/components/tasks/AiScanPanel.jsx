import React, { useEffect, useMemo, useRef, useState } from 'react';
import { taskImagesAiApi, getAiProvider, AI_PROVIDERS } from '../../api/sharedTaskApi';

/**
 * AiScanPanel — Panel quét AI cho 1 ảnh trong task report
 *
 * Flow:
 *   1. User chọn provider (TomatoLeafDiseaseOnnx / ArgoPestOnnx) — hoặc dùng auto
 *   2. Bấm "Quét AI" → POST /task-images/ai/scan (multipart) → BE trả scanId
 *   3. FE poll GET /task-images/ai/scan/{id}
 *        - status = Pending  → tiếp tục poll (có progress bar)
 *        - status = Completed → render kết quả từ các cột có sẵn (aiPredictedLabel, aiConfidence, aiAnalysis.*, aiAnnotatedImageUrl)
 *        - status = Failed    → hiện nút Retry / Quét lại
 *   4. Nếu Failed → nút ⟳ Retry (POST /scan/{id}/retry) hoặc 🚀 Quét lại từ đầu
 *
 * Response từ BE có cột sẵn (dùng thẳng):
 *   - aiStatus: 'Pending' | 'Completed' | 'Failed'
 *   - aiProvider: 'TomatoLeafDiseaseOnnx' | 'ArgoPestOnnx'
 *   - aiPredictedLabel: e.g. 'Snails'
 *   - aiConfidence: 0..1
 *   - aiConfidenceRate: 0..100
 *   - aiAnnotatedImageUrl: URL ảnh đã annotate box
 *   - aiAnalysis: { label, confidence, isHealthy, gateLabel, gateConfidence, detectionCount, bestBox, ... }
 *
 * Props:
 *   - image: { file?, previewUrl, url?, imageId?, localId, fileName, ai? }
 *   - taskId, taskReportId
 *   - disabled
 *   - onUpdate(aiPayload) — bubble lên parent để lưu vào state + submit
 *   - initialProvider: provider mặc định (optional)
 */

const STATUS = {
  IDLE: 'idle',           // chưa quét
  QUEUED: 'queued',       // vừa POST thành công, đang đợi poll lần đầu
  PENDING: 'pending',     // BE đang xử lý (status=Pending/Running)
  COMPLETED: 'completed', // status=Completed → thành công
  FAILED: 'failed'        // status=Failed → lỗi
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Map status BE → UI state
const mapBeStatus = (beStatus) => {
  const s = String(beStatus || '').toLowerCase();
  if (s === 'completed' || s === 'success' || s === 'done') return STATUS.COMPLETED;
  if (s === 'failed' || s === 'error') return STATUS.FAILED;
  if (s === 'pending' || s === 'queued' || s === 'running' || s === 'processing' || s === 'inprogress') return STATUS.PENDING;
  return STATUS.IDLE;
};

// Format box tọa độ: "x1, y1 → x2, y2"
const formatBox = (box) => {
  if (!box || typeof box !== 'object') return null;
  const { x1, y1, x2, y2 } = box;
  if ([x1, y1, x2, y2].some((v) => v === undefined || v === null)) return null;
  return `(${x1}, ${y1}) → (${x2}, ${y2})`;
};

const AiScanPanel = ({ image, taskId, taskReportId, disabled = false, onUpdate, initialProvider }) => {
  // === State ===
  const [provider, setProvider] = useState(initialProvider || AI_PROVIDERS[0]?.code || '');
  const [providers, setProviders] = useState(AI_PROVIDERS);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [scanId, setScanId] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // raw response từ BE (đã có cột sẵn)
  const [attempts, setAttempts] = useState(0);
  const [pollElapsed, setPollElapsed] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const cancelRef = useRef({ cancelled: false });

  // === Fetch providers từ BE (merge với constants) ===
  useEffect(() => {
    let alive = true;
    taskImagesAiApi.getProviders()
      .then((data) => {
        if (!alive || !data) return;
        const arr = Array.isArray(data)
          ? data
          : (Array.isArray(data?.providers) ? data.providers
            : (Array.isArray(data?.items) ? data.items : null));
        if (arr && arr.length > 0) {
          const merged = arr.map((p) => {
            if (typeof p === 'string') return getAiProvider(p) || { code: p, name: p, icon: '🤖' };
            return getAiProvider(p.code) || p;
          });
          setProviders(merged);
          if (!merged.find((p) => p.code === provider)) setProvider(merged[0]?.code || '');
        }
      })
      .catch(() => { /* fallback dùng constants */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Reset state khi đổi ảnh + Auto-resume poll nếu BE đang chạy nền ===
  useEffect(() => {
    cancelRef.current.cancelled = true;
    setStatus(STATUS.IDLE);
    setScanId(null);
    setError(null);
    setResult(null);
    setAttempts(0);
    setPollElapsed(0);
    setShowRaw(false);

    // 🆕 Auto-resume: nếu ảnh BE đang scan (Pending) → resume poll ngay khi mở panel
    const beStatus = image?.aiStatus;
    const existingScanId = image?.aiScanId || image?.ai?.scanId;
    if (beStatus === 'Pending' && existingScanId) {
      // eslint-disable-next-line no-console
      console.log('[AiScan] auto-resume poll for scanId:', existingScanId);
      setScanId(existingScanId);
      setStatus(STATUS.PENDING);
      // đợi 1 tick để các state ổn định rồi poll
      setTimeout(() => {
        if (!cancelRef.current.cancelled) startPolling(existingScanId);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image?.localId, image?.imageId]);

  // 🆕 Auto-start scan khi mở panel cho ảnh local mới (có file, chưa có kết quả)
  const autoStartedRef = useRef(false);
  useEffect(() => {
    // Chỉ auto-start 1 lần cho mỗi image (khi mount)
    if (autoStartedRef.current) return;
    // Chỉ áp dụng cho ảnh local (có file) — ảnh từ BE (imageId) sẽ có sẵn aiStatus
    if (!image?.file) return;
    // Đã có kết quả AI hoặc đang chạy → skip
    const hasResult = image?.ai?.status === 'Success'
      || image?.aiStatus === 'Completed'
      || image?.aiStatus === 'Pending'
      || image?.aiStatus === 'Failed';
    if (hasResult) return;
    // Panel đã từng chạy rồi → skip (tránh re-scan khi user đã đóng panel)
    if (image?.aiAttempted || image?._aiAttempted) return;

    autoStartedRef.current = true;
    // Đánh dấu đã attempt để parent không bật lại
    onUpdate?.({ _aiAttempted: true });
    // Delay 1 nhịp để user nhìn thấy panel mở rồi mới bắt đầu (UX mượt)
    setTimeout(() => {
      if (!cancelRef.current.cancelled) handleScan();
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image?.localId, image?.imageId]);

  // === Polling ===
  const startPolling = async (id) => {
    if (!id) return;
    cancelRef.current = { cancelled: false };
    const start = Date.now();
    let tries = 0;
    while (!cancelRef.current.cancelled) {
      tries += 1;
      setAttempts(tries);
      setPollElapsed(Math.floor((Date.now() - start) / 1000));
      try {
        const detail = await taskImagesAiApi.getDetail(id);
        if (cancelRef.current.cancelled) return;
        const mapped = mapBeStatus(detail?.aiStatus);
        setStatus(mapped);
        if (mapped === STATUS.COMPLETED) {
          setResult(detail);
          onUpdate?.({
            provider: detail.aiProvider,
            scanId: id,
            status: 'Success',
            response: detail.aiAnalysis || detail,
            // Lưu các cột chính để dùng nhanh:
            predictedLabel: detail.aiPredictedLabel,
            confidence: detail.aiConfidence,
            confidenceRate: detail.aiConfidenceRate,
            annotatedImageUrl: detail.aiAnnotatedImageUrl,
            capturedAt: new Date().toISOString()
          });
          return;
        }
        if (mapped === STATUS.FAILED) {
          setError(detail?.errorMessage || detail?.aiAnalysis?.errorMessage || detail?.message || 'AI scan failed');
          return;
        }
        // Pending → tiếp tục
      } catch (e) {
        if (cancelRef.current.cancelled) return;
        // Lỗi mạng tạm thời → tiếp tục poll
        console.warn('[AiScan] poll error:', e?.message);
      }
      if (tries > 60) {
        setError('Quá thời gian chờ (timeout). Hãy bấm "Thử lại".');
        setStatus(STATUS.FAILED);
        return;
      }
      await sleep(1500);
    }
  };

  // === Hành động ===
  const handleScan = async () => {
    if (!provider) {
      setError('Vui lòng chọn AI provider');
      return;
    }
    if (!image?.file && !image?.url && !image?.imageId) {
      setError('Không có file ảnh để quét');
      return;
    }
    setError(null);
    setResult(null);
    setAttempts(0);
    setPollElapsed(0);
    setStatus(STATUS.QUEUED);
    try {
      const payload = { provider };
      if (image.file) payload.file = image.file;
      else if (image.imageId) payload.imageId = image.imageId;
      else if (image.url) payload.imageUrl = image.url;
      if (taskId) payload.taskId = taskId;
      if (taskReportId) payload.taskReportId = taskReportId;

      const res = await taskImagesAiApi.scan(payload);
      console.log('[AiScan] scan response:', res);
      // Sync response — có thể BE trả thẳng kết quả
      const mapped = mapBeStatus(res?.aiStatus);
      if (mapped === STATUS.COMPLETED) {
        setResult(res);
        setStatus(STATUS.COMPLETED);
        onUpdate?.({
          provider: res.aiProvider,
          scanId: res.id || null,
          status: 'Success',
          response: res.aiAnalysis || res,
          predictedLabel: res.aiPredictedLabel,
          confidence: res.aiConfidence,
          confidenceRate: res.aiConfidenceRate,
          annotatedImageUrl: res.aiAnnotatedImageUrl,
          capturedAt: new Date().toISOString()
        });
        return;
      }
      // Nếu là Pending/Failed → cần id để poll/retry
      const id = res?.id || res?.scanId || res?.jobId || res?.data?.id || res?.data?.scanId;
      if (!id) {
        // Không có id, không biết poll cái gì
        setError(res?.message || 'BE không trả scanId và cũng không có kết quả.');
        setStatus(STATUS.FAILED);
        return;
      }
      // 🆕 Thông báo cho parent biết đã có scanId (đang chạy ngầm trên BE) → cập nhật badge Pending ngay
      onUpdate?.({
        aiStatus: 'Pending',
        aiScanId: id,
        scanId: id,
        provider
      });
      setScanId(id);
      setStatus(STATUS.PENDING);
      startPolling(id);
    } catch (e) {
      console.error('[AiScan] scan error:', e);
      setError(e?.message || 'Không gọi được AI scan');
      setStatus(STATUS.FAILED);
      // 🆕 Báo parent biết đã attempt (để không auto-scan lại khi mở lại panel)
      onUpdate?.({ aiStatus: 'Failed', _aiAttempted: true });
    }
  };

  const handleRetry = async () => {
    if (!scanId) return handleScan();
    setError(null);
    setStatus(STATUS.QUEUED);
    try {
      const res = await taskImagesAiApi.retry(scanId);
      console.log('[AiScan] retry response:', res);
      const newId = res?.id || res?.scanId || scanId;
      if (newId) setScanId(newId);
      setStatus(STATUS.PENDING);
      startPolling(newId);
    } catch (e) {
      console.error('[AiScan] retry error:', e);
      setError(e?.message || 'Retry thất bại. Bấm "Quét lại" để chạy lại từ đầu.');
      setStatus(STATUS.FAILED);
    }
  };

  // === Helpers ===
  const fmtPercent = (v) => {
    if (v == null) return '—';
    const num = Number(v);
    if (isNaN(num)) return '—';
    if (num > 0 && num <= 1) return (num * 100).toFixed(2) + '%';
    return num.toFixed(2) + '%';
  };

  const confidenceColor = (conf) => {
    const c = Number(conf);
    if (c >= 0.9) return 'emerald';
    if (c >= 0.7) return 'lime';
    if (c >= 0.5) return 'amber';
    return 'rose';
  };

  const isBusy = status === STATUS.QUEUED || status === STATUS.PENDING;
  const providerMeta = providers.find((p) => p.code === provider) || getAiProvider(provider);
  const analysis = result?.aiAnalysis || null;
  const predictedLabel = result?.aiPredictedLabel || analysis?.label || null;
  const confidence = result?.aiConfidence ?? analysis?.confidence ?? null;
  const annotatedUrl = result?.aiAnnotatedImageUrl || analysis?.annotatedImageUrl || null;
  const isHealthy = analysis?.isHealthy;
  const detectionCount = analysis?.detectionCount;
  const bestBox = formatBox(analysis?.bestBox);
  const finalStatus = analysis?.finalStatus || result?.finalStatus || null;
  const gateLabel = analysis?.gateLabel || null;
  const gateConfidence = analysis?.gateConfidence ?? null;

  // === Distinguish response variants ===
  // Bean có thể trả về `result` hoặc top-level `final_status` (response mới, không có aiAnalysis wrapper)
  const topLevelFinalStatus = result?.finalStatus || result?.final_status || null;
  const topLevelMessage = result?.message || result?.errorMessage || null;
  const topLevelGate = result?.gate || null;
  const topLevelCropPredictions = Array.isArray(result?.crop_predictions) ? result.crop_predictions
    : (Array.isArray(analysis?.cropPredictions) ? analysis.cropPredictions : []);
  const topLevelDetections = Array.isArray(result?.detections) ? result.detections : [];

  // detectionCount cũng tính từ top-level nếu aiAnalysis không có
  const effectiveDetectionCount = detectionCount != null ? detectionCount : topLevelDetections.length;

  // === 🆕 Fields theo docs API mới ===
  // Tomato: class_name (slug), label (display), disease_info.{description, treatment}, probabilities{}
  // ArgoPest: class (slug), confidence_kidney/percentile/absolute, detections[]
  const diseaseInfo = analysis?.diseaseInfo
    || (result?.disease_info ? result.disease_info : null)
    || (result?.diseaseInfo ? result.diseaseInfo : null);
  const diseaseDescription = diseaseInfo?.description || result?.description || null;
  const diseaseTreatment = diseaseInfo?.treatment || result?.treatment || null;
  const className = analysis?.className
    || result?.class_name
    || result?.className
    || result?.class
    || result?.predictedClass
    || null;
  const displayLabel = analysis?.label
    || result?.label
    || result?.displayLabel
    || null;

  // Argo Pest: 3 loại confidence
  const confKidney = result?.confidence_kidney ?? analysis?.confidenceKidney ?? null;
  const confPercentile = result?.confidence_percentile ?? analysis?.confidencePercentile ?? null;
  const confAbsolute = result?.confidence_absolute ?? analysis?.confidenceAbsolute ?? null;
  const hasTripleConfidence = confKidney != null || confPercentile != null || confAbsolute != null;

  // Tomato: probabilities (all classes)
  const allProbabilities = (result?.probabilities && typeof result.probabilities === 'object')
    ? result.probabilities
    : (analysis?.probabilities && typeof analysis.probabilities === 'object')
      ? analysis.probabilities
      : null;
  const hasProbabilities = allProbabilities && Object.keys(allProbabilities).length > 0;

  // Phát hiện model nào
  const isTomatoModel = provider === 'TomatoLeafDiseaseOnnx';
  const isArgoPestModel = provider === 'ArgoPestOnnx';

  // Phát hiện case "không có detections" (ví dụ chụp ảnh không có sâu → trả [] với finalStatus PestClassified nhưng count=0)
  // hoặc "gate reject" (ảnh không phải lá cà chua → final_status = not_tomato_leaf / GateRejected)
  const isGateRejected = (
    finalStatus === 'not_tomato_leaf' ||
    finalStatus === 'GateRejected' ||
    finalStatus === 'gate_rejected' ||
    topLevelFinalStatus === 'not_tomato_leaf' ||
    topLevelFinalStatus === 'GateRejected' ||
    (topLevelGate && typeof topLevelGate.confidence === 'number' && topLevelGate.confidence < (topLevelGate.threshold || 0.6)) ||
    (gateLabel && gateLabel !== 'pest' && typeof gateConfidence === 'number' && gateConfidence < (analysis?.gateThreshold || 0.6))
  );
  const isNoDetection = (
    !isGateRejected &&
    finalStatus !== 'NotDetected' &&
    effectiveDetectionCount === 0 &&
    finalStatus !== 'Healthy' &&
    isHealthy !== true
  );

  // === Render ===
  return (
    <div className="mt-2 border-t border-slate-200 pt-2 space-y-2">
      {/* Hàng chọn provider + nút hành động */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">🤖 AI:</span>
        <select
          value={provider}
          disabled={disabled || isBusy}
          onChange={(e) => setProvider(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1 border border-slate-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:bg-slate-50"
        >
          {providers.length === 0 && <option value="">— Chưa có AI provider —</option>}
          {providers.map((p) => (
            <option key={p.code} value={p.code}>{p.icon || '🤖'} {p.name || p.code}</option>
          ))}
        </select>
        {status !== STATUS.COMPLETED && (
          <button
            type="button"
            disabled={disabled || isBusy || !provider}
            onClick={handleScan}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-md text-xs font-bold flex items-center gap-1 shrink-0"
            title={isBusy ? `Đang xử lý (${pollElapsed}s)` : 'Quét AI'}
          >
            {isBusy && <span className="animate-spin inline-block">⟳</span>}
            {!isBusy && <span>🚀</span>}
            <span>
              {isBusy
                ? (status === STATUS.QUEUED ? 'Đang gửi…' : `Đang phân tích… (${pollElapsed}s)`)
                : (scanId ? 'Quét lại' : 'Quét AI')}
            </span>
          </button>
        )}
        {status === STATUS.COMPLETED && (
          <>
            <button
              type="button"
              disabled={disabled || isBusy}
              onClick={handleRetry}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold flex items-center gap-1 shrink-0"
              title="Chạy lại AI scan"
            >
              ⟳ Retry
            </button>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-bold shrink-0"
            >
              {showRaw ? 'Ẩn JSON' : 'Xem JSON'}
            </button>
          </>
        )}
      </div>

      {/* Mô tả provider */}
      {providerMeta?.description && status === STATUS.IDLE && (
        <p className="text-[10px] text-slate-500 italic">{providerMeta.description}</p>
      )}

      {/* === Trạng thái Queued/Pending === */}
      {isBusy && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-[11px] text-indigo-700 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="animate-spin inline-block text-base">⟳</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold">
                {status === STATUS.QUEUED
                  ? '⏳ Đang upload ảnh & khởi tạo job AI…'
                  : '🧠 AI đang phân tích ảnh (chạy ngầm trên BE)…'}
              </p>
              <p className="text-indigo-600 text-[10px]">
                Đã đợi {pollElapsed}s · Đã thử {attempts} lần
                {scanId && <span className="ml-1 font-mono text-indigo-400">· scanId: {String(scanId).slice(0, 12)}…</span>}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200 text-indigo-800 animate-pulse whitespace-nowrap">
              Pending
            </span>
          </div>
          {/* Progress bar giả lập dựa trên thời gian */}
          <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(95, (pollElapsed / 30) * 100)}%` }}
            />
          </div>
          <p className="text-[9px] text-indigo-600 italic">
            ⏱️ AI scan thường hoàn tất trong 10–60 giây. Có thể đóng panel — kết quả sẽ được lưu vào BE.
          </p>
        </div>
      )}

      {/* === Trạng thái Failed === */}
      {status === STATUS.FAILED && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-700 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            ❌ AI scan thất bại
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">Failed</span>
          </p>
          {error && <p className="text-rose-600 text-[10px] break-words">{error}</p>}
          <div className="flex gap-1.5">
            <button type="button" onClick={handleRetry} disabled={!scanId}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-md text-[10px] font-bold">
              ⟳ Thử lại (retry)
            </button>
            <button type="button" onClick={handleScan}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md text-[10px] font-bold">
              🚀 Quét lại từ đầu
            </button>
          </div>
        </div>
      )}

      {/* === Trạng thái Completed === */}
      {status === STATUS.COMPLETED && result && (
        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-200 rounded-lg p-2.5 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              ✅ Kết quả AI {providerMeta?.icon || '🤖'} {providerMeta?.name || result.aiProvider}
            </p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">Completed</span>
          </div>

        {/* Card chính: Label + Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {predictedLabel && (
            <div className="bg-white border-2 border-emerald-200 rounded-lg p-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phát hiện</p>
              <p className="text-base font-extrabold text-emerald-700 leading-tight">
                {displayLabel || predictedLabel}
                {isHealthy === true && <span className="ml-1 text-[10px] text-emerald-500">✓ Healthy</span>}
                {isHealthy === false && <span className="ml-1 text-[10px] text-rose-500">⚠ Bất thường</span>}
              </p>
              {className && className !== (displayLabel || predictedLabel) && (
                <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate" title={className}>
                  {className}
                </p>
              )}
            </div>
          )}
          {confidence != null && (
            <div className={`bg-${confidenceColor(confidence)}-50 border-2 border-${confidenceColor(confidence)}-200 rounded-lg p-2`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Độ tin cậy</p>
              <div className="flex items-baseline gap-1.5">
                <p className={`text-lg font-extrabold text-${confidenceColor(confidence)}-700 leading-tight`}>
                  {fmtPercent(confidence)}
                </p>
                {result.aiConfidenceRate != null && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    ({result.aiConfidenceRate.toFixed(2)}%)
                  </p>
                )}
              </div>
              {/* Mini progress bar */}
              <div className="w-full bg-white rounded-full h-1 mt-1 overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full bg-${confidenceColor(confidence)}-500 transition-all`}
                  style={{ width: `${Math.min(100, (confidence * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 🆕 Card 3 loại confidence (Argo Pest) */}
        {hasTripleConfidence && (
          <div className="bg-white border border-slate-200 rounded-lg p-2 text-[11px]">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">📊 Chi tiết Confidence (Argo)</p>
            <div className="space-y-1">
              {[
                { lbl: 'Kidney', v: confKidney, color: 'indigo' },
                { lbl: 'Percentile', v: confPercentile, color: 'sky' },
                { lbl: 'Absolute', v: confAbsolute, color: 'emerald' },
              ].filter(x => x.v != null).map((row) => {
                const c = Number(row.v) || 0;
                return (
                  <div key={row.lbl}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-700">{row.lbl}</span>
                      <span className="font-mono font-bold text-slate-800">{fmtPercent(row.v)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                      <div className={`h-full rounded-full bg-${row.color}-500`} style={{ width: `${Math.min(100, c * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🆕 Card thông tin bệnh (Tomato: description + treatment) */}
        {(diseaseDescription || diseaseTreatment) && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-2.5 text-[11px] space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">📋 Thông tin bệnh</p>
            {diseaseDescription && (
              <div>
                <p className="font-bold text-amber-900 text-[11px] mb-0.5">Mô tả</p>
                <p className="text-amber-800 leading-snug">{diseaseDescription}</p>
              </div>
            )}
            {diseaseTreatment && (
              <div>
                <p className="font-bold text-amber-900 text-[11px] mb-0.5">💊 Phương pháp điều trị</p>
                <p className="text-amber-800 leading-snug whitespace-pre-line">{diseaseTreatment}</p>
              </div>
            )}
          </div>
        )}

        {/* 🆕 Card probabilities đầy đủ (Tomato) */}
        {hasProbabilities && (
          <div className="bg-white border border-slate-200 rounded-lg p-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              🌿 Probabilities tất cả lớp ({Object.keys(allProbabilities).length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(allProbabilities)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .map(([k, v]) => {
                  const num = Number(v) || 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-[10px] gap-2">
                        <span className="font-mono text-slate-700 truncate" title={k}>{k}</span>
                        <span className="font-mono font-bold text-slate-800 flex-shrink-0">{fmtPercent(v)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full bg-${confidenceColor(num)}-500`} style={{ width: `${Math.min(100, num * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 🆕 Card đặc biệt: Gate bị reject (ảnh không phải đối tượng model) */}
        {isGateRejected && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-2.5 text-[11px] space-y-1.5">
            <p className="font-extrabold text-amber-800 flex items-center gap-1.5">
              <span>🚫</span>
              <span>{predictedLabel === 'out_of_domain' || topLevelGate?.prediction === 'out_of_domain'
                ? 'Ảnh không thuộc miền nhận dạng'
                : predictedLabel === 'not_tomato_leaf' || topLevelFinalStatus === 'not_tomato_leaf'
                  ? 'Ảnh không phải lá cà chua'
                  : 'Cổng (gate) không vượt ngưỡng'}
              </span>
            </p>
            {/* Gate breakdown */}
            {(topLevelGate || gateLabel) && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div>
                  <span className="text-[9px] font-bold uppercase text-amber-700 tracking-wider block">Gate</span>
                  <span className="font-bold text-amber-900 font-mono">
                    {topLevelGate?.prediction || gateLabel || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-amber-700 tracking-wider block">Confidence</span>
                  <span className="font-bold text-amber-900 font-mono">
                    {fmtPercent(topLevelGate?.confidence ?? gateConfidence)}
                  </span>
                  {topLevelGate?.threshold != null && (
                    <span className="ml-1 text-[9px] text-amber-600">
                      (ngưỡng {fmtPercent(topLevelGate.threshold)})
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Probability bar */}
            {topLevelGate?.probabilities && typeof topLevelGate.probabilities === 'object' && (
              <div className="space-y-1 mt-1">
                {Object.entries(topLevelGate.probabilities).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-amber-800">{k}</span>
                      <span className="font-mono font-bold text-amber-900">{fmtPercent(v)}</span>
                    </div>
                    <div className="w-full bg-amber-100 rounded-full h-1 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, v * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topLevelMessage && <p className="text-amber-700 italic">{topLevelMessage}</p>}
            <p className="text-[9px] text-amber-600 italic">📌 Gợi ý: chụp cận cảnh lá cà chua / ảnh có sâu rõ ràng hơn để model nhận dạng.</p>
          </div>
        )}

        {/* 🆕 Card đặc biệt: Có chạy model nhưng không phát hiện đối tượng nào */}
        {isNoDetection && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-lg p-2.5 text-[11px] space-y-1">
            <p className="font-extrabold text-sky-800 flex items-center gap-1.5">
              <span>🔍</span>
              <span>Không phát hiện đối tượng</span>
            </p>
            <p className="text-sky-700">Model đã phân tích ảnh nhưng không tìm thấy bệnh/sâu trong khung hình.</p>
            {topLevelMessage && <p className="text-sky-600 italic text-[10px]">{topLevelMessage}</p>}
            {predictedLabel && (
              <p className="text-[10px] text-sky-700">
                Kết luận model: <span className="font-bold">{predictedLabel}</span>
              </p>
            )}
            <p className="text-[9px] text-sky-600 italic">📌 Có thể cây khỏe mạnh. Cân nhắc chụp gần vùng nghi ngờ hơn.</p>
          </div>
        )}

          {/* Annotated image */}
          {annotatedUrl && (
            <div className="bg-white border border-slate-200 rounded-lg p-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">🖼️ Annotated</p>
              <img src={annotatedUrl} alt="annotated" className="w-full max-h-40 object-contain rounded bg-slate-50" />
              <a href={annotatedUrl} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-600 hover:underline truncate block mt-1">
                Mở ảnh gốc ↗
              </a>
            </div>
          )}

          {/* Chi tiết từ aiAnalysis (dùng thẳng các cột) */}
          {analysis && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              {analysis.gateLabel && (
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Gate</span>
                  <span className="font-bold text-slate-700">{analysis.gateLabel}</span>
                  {analysis.gateConfidence != null && (
                    <span className="ml-1 font-mono text-slate-500 text-[10px]">({fmtPercent(analysis.gateConfidence)})</span>
                  )}
                </div>
              )}
              {effectiveDetectionCount != null && effectiveDetectionCount > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Số lượng phát hiện</span>
                  <span className="font-bold text-slate-700">{effectiveDetectionCount}</span>
                </div>
              )}
              {bestBox && (
                <div className="col-span-2">
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Bounding box</span>
                  <span className="font-mono text-slate-700">{bestBox}</span>
                </div>
              )}
              {analysis.apiVersion && (
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">API version</span>
                  <span className="font-mono text-slate-700">{analysis.apiVersion}</span>
                </div>
              )}
              {(analysis.finalStatus || topLevelFinalStatus) && (() => {
                const fs = analysis.finalStatus || topLevelFinalStatus;
                // Mapping final_status → badge thân thiện
                const M = {
                  Healthy: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓', label: 'Khỏe mạnh' },
                  PestClassified: { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: '🐛', label: 'Phát hiện sâu bệnh' },
                  NotDetected: { color: 'bg-sky-100 text-sky-700 border-sky-200', icon: '🔍', label: 'Không phát hiện' },
                  GateRejected: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🚫', label: 'Gate bị từ chối' },
                  not_tomato_leaf: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🚫', label: 'Không phải lá cà chua' },
                  Completed: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✓', label: 'Hoàn tất' },
                  Failed: { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: '✕', label: 'Thất bại' },
                };
                const m = M[fs] || { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'ℹ', label: fs };
                return (
                  <div className="col-span-2">
                    <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Trạng thái cuối</span>
                    <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${m.color}`}>
                      <span>{m.icon}</span><span>{m.label}</span>
                    </span>
                  </div>
                );
              })()}
              {(analysis.completedAt || result.completedAt) && (
                <div className="col-span-2">
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider block">Hoàn tất lúc</span>
                  <span className="font-mono text-slate-700 text-[10px]">
                    {new Date(analysis.completedAt || result.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 🆕 Crop predictions (multiple top-N class probabilities, response mới) */}
          {topLevelCropPredictions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">🌾 Top predictions (crop)</p>
              <div className="space-y-1">
                {topLevelCropPredictions.slice(0, 5).map((cp, i) => {
                  const lbl = cp.label || cp.class || cp.prediction || `Lớp ${i + 1}`;
                  const conf = cp.confidence ?? cp.score ?? cp.probability ?? null;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-700 truncate">{lbl}</span>
                        <span className="font-mono text-slate-500">{fmtPercent(conf)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-${confidenceColor(conf)}-500`}
                          style={{ width: `${Math.min(100, (conf || 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top detections từ rawResultJson hoặc top-level (Tomato + Argo) */}
          {(() => {
            let dets = [];
            let source = null;
            // Ưu tiên top-level detections (response docs mới)
            if (topLevelDetections.length > 0) {
              dets = topLevelDetections;
              source = 'top';
            } else if (analysis?.rawResultJson) {
              try {
                const raw = typeof analysis.rawResultJson === 'string'
                  ? JSON.parse(analysis.rawResultJson)
                  : analysis.rawResultJson;
                if (Array.isArray(raw?.detections)) {
                  dets = raw.detections;
                  source = 'raw';
                }
              } catch (e) { /* ignore */ }
            }
            if (dets.length === 0) return null;
            return (
              <div className="bg-white border border-slate-200 rounded-lg p-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  🎯 Detections ({dets.length})
                  {source === 'top' && <span className="ml-1 text-[9px] text-emerald-600 font-mono">live</span>}
                </p>
                <div className="space-y-1">
                  {dets.slice(0, 5).map((d, i) => {
                    // Hỗ trợ cả 2 format: Tomato dùng class_name, Argo dùng class
                    const cls = d.class_name || d.class || d.label || `#${i + 1}`;
                    const conf = d.confidence ?? d.score ?? null;
                    const bbox = Array.isArray(d.bbox) ? d.bbox : null;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1">
                        <span className="font-bold text-slate-800 truncate flex-1" title={cls}>{cls}</span>
                        {conf != null && (
                          <span className="font-mono font-bold text-indigo-600 flex-shrink-0">
                            {fmtPercent(conf)}
                          </span>
                        )}
                        {bbox && (
                          <span className="font-mono text-[9px] text-slate-500 flex-shrink-0" title="bbox [x1,y1,x2,y2]">
                            [{bbox.map(n => Math.round(Number(n) || 0)).join(',')}]
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Toggle raw JSON */}
          {showRaw && (
            <details open>
              <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-indigo-600">📦 Raw JSON</summary>
              <pre className="mt-1 p-2 bg-slate-900 text-emerald-300 rounded text-[9px] overflow-auto max-h-48 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default AiScanPanel;
