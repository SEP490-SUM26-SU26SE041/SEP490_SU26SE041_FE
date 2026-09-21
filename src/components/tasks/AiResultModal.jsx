// ── Shared AiResultModal Component ──────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { getAiProvider, taskImagesApi } from '../../api/sharedTaskApi';

const fmtPct = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  if (n > 0 && n <= 1) return (n * 100).toFixed(2) + '%';
  return n.toFixed(2) + '%';
};

const confColor = (c) => {
  const n = Number(c) || 0;
  if (n >= 0.9) return 'emerald';
  if (n >= 0.7) return 'lime';
  if (n >= 0.5) return 'amber';
  return 'rose';
};

// Map tên bệnh Tomato Leaf Disease → tiếng Việt + treatment
const TOMATO_DISEASE_MAP = {
  Tomato_Early_blight:               { vi: 'Bệnh đốm sớm',              severity: 'high',     treat: 'Phun thuốc gốc đồng (Copper-based fungicide), loại bỏ lá bệnh, cải thiện thông gió.' },
  Tomato_Late_blight:                { vi: 'Bệnh đốm nâu',               severity: 'critical', treat: 'Phun thuốc fungicide Metalaxyl hoặc Mancozeb, loại bỏ cây nhiễm nặng.' },
  Tomato_Leaf_Mold:                 { vi: 'Bệnh mốc sương lá',         severity: 'medium',   treat: 'Cải thiện thông gió, phun thuốc gốc đồng hoặc Chlorothalonil.' },
  Tomato_Septoria_leaf_spot:         { vi: 'Bệnh đốm Septoria',         severity: 'high',     treat: 'Phun thuốc gốc đồng, loại bỏ lá bệnh, không tưới nước lên lá.' },
  Tomato_Spider_mites_Tetranychus:   { vi: 'Nhện đỏ',                  severity: 'medium',   treat: 'Phun thuốc trừ nhện (Abamectin, Spiromesifen), tăng độ ẩm.' },
  Tomato__yellow_leaf_curl_virus:    { vi: 'Bệnh xoắn lá virus',       severity: 'critical', treat: 'Diệt trừ bọ gầy (vector), nhổ bỏ cây nhiễm, trồng giống kháng.' },
  Tomato_mosaic_virus:               { vi: 'Bệnh khảm virus',           severity: 'critical', treat: 'Diệt trừ côn trùng vector, khử trùng dụng cụ, nhổ cây bệnh.' },
  Bacterial_spot:                    { vi: 'Bệnh đốm vi khuẩn',         severity: 'high',     treat: 'Phun thuốc gốc đồng, tránh tưới nước lên lá.' },
  Target_Spot:                       { vi: 'Bệnh đốm đích',              severity: 'medium',   treat: 'Phun fungicide Daconil, loại bỏ lá bệnh.' },
  Spider_mites:                      { vi: 'Nhện đỏ',                   severity: 'medium',   treat: 'Phun thuốc trừ nhện, tăng độ ẩm môi trường.' },
  Powdery_mildew:                    { vi: 'Bệnh phấn trắng',            severity: 'medium',   treat: 'Phun sulfur, cải thiện thông gió, giảm độ ẩm.' },
  Leaf_Mold:                         { vi: 'Bệnh mốc sương lá',         severity: 'medium',   treat: 'Cải thiện thông gió, phun thuốc gốc đồng.' },
  Blight:                            { vi: 'Bệnh héo',                   severity: 'critical', treat: 'Loại bỏ cây bệnh ngay, phun fungicide, không trồng lại cùng chỗ.' },
};

const SEVERITY_STYLE = {
  critical: { bg: 'bg-rose-50',   border: 'border-rose-400',   icon: '🔴', label: '⚠⚠ Nguy hiểm cao',  text: 'text-rose-700' },
  high:     { bg: 'bg-orange-50', border: 'border-orange-400', icon: '🟠', label: '⚠ Mức cao',          text: 'text-orange-700' },
  medium:   { bg: 'bg-amber-50', border: 'border-amber-400',  icon: '🟡', label: 'Mức trung bình',     text: 'text-amber-700' },
  low:      { bg: 'bg-emerald-50', border: 'border-emerald-400',icon: '🟢', label: 'Nhẹ',               text: 'text-emerald-700' },
};

/**
 * AiResultModal — hiển thị chi tiết kết quả AI scan từ TaskImage.
 * Props:
 *  - image: TaskImage từ BE
 *  - onClose: () => void
 *  - onRetry: (imageId) => Promise<void> — optional
 *  - taskReportId: id của TaskReport — dùng để poll lại detail sau retry
 *  - onImageUpdated: (updatedImage) => void — callback khi poll có data mới (để parent cập nhật list)
 */
const AiResultModal = ({ image: imageProp, onClose, onRetry, taskReportId, onImageUpdated }) => {
  if (!imageProp) return null;

  // ── Local state: polling sau retry ────────────────────────────────────────
  const [image, setImage] = useState(imageProp);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState(null);
  const [pollElapsed, setPollElapsed] = useState(0);
  const pollRef = useRef(null);
  const elapsedRef = useRef(null);
  const onImageUpdatedRef = useRef(onImageUpdated);

  // Sync prop image khi parent truyền image mới (lần đầu hoặc sau khi parent fetch lại)
  useEffect(() => { setImage(imageProp); }, [imageProp]);

  // Giữ ref mới nhất của callback để dùng trong poll interval
  useEffect(() => { onImageUpdatedRef.current = onImageUpdated; }, [onImageUpdated]);

  // Cleanup interval khi unmount
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  }, []);

  // ── startPolling: gọi API mỗi 5s, stop khi Completed/Failed hoặc timeout 2 phút ──
  const startPolling = (imageId) => {
    if (!taskReportId) {
      console.warn('[AiResultModal] startPolling: thiếu taskReportId prop');
      setPolling(false);
      return;
    }
    const POLL_MS = 5000;
    const TIMEOUT_MS = 120000;
    const startedAt = Date.now();

    // Stop polling cũ nếu có
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    const tick = async () => {
      try {
        const list = await taskImagesApi.getByTaskReport(taskReportId);
        const arr = Array.isArray(list) ? list : (Array.isArray(list?.data) ? list.data : []);
        const updated = arr.find(x => (x.id || x.plantImageId) === imageId);
        if (!updated) return;
        const st = String(updated.aiStatus || updated.status || '').toLowerCase();
        const ai2 = updated.aiAnalysis || updated.ai_analysis;
        const fs = ai2?.finalStatus || updated.finalStatus;

        // Cập nhật local image ngay để UI mượt
        setImage(updated);

        // Completed? → stop
        const isDone =
          (st === 'completed' || st === 'success' || st === 'failed' || st === 'error') ||
          (fs && String(fs).toLowerCase() !== 'pending');
        if (isDone) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          pollRef.current = null;
          elapsedRef.current = null;
          setPolling(false);
          // Báo parent cập nhật list state
          onImageUpdatedRef.current?.(updated);
        }
      } catch (err) {
        console.warn('[AiResultModal] poll error:', err?.message);
        setPollError(err?.message || 'Lỗi khi poll');
        // KHÔNG stop polling — tiếp tục thử lần sau
      }

      // Timeout check
      if (Date.now() - startedAt > TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        pollRef.current = null;
        elapsedRef.current = null;
        setPolling(false);
        setPollError('Quá thời gian chờ (2 phút). Vui lòng thử lại.');
      }
    };

    // Gọi ngay lần đầu + interval
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    elapsedRef.current = setInterval(() => setPollElapsed(s => s + 1), 1000);
  };

  // ── Extract fields từ BE response ──────────────────────────────────────────
  const ai = image.aiAnalysis || image.ai_analysis || null;

  // Identity
  const plantImageId = image.plantImageId || image.id || null;
  const apiVersion = ai?.apiVersion || null;

  // ── Parse rawResultJson nếu có (Tomato gate chứa probabilities trong đây) ──
  let rawParsed = null;
  if (ai?.rawResultJson) {
    try { rawParsed = JSON.parse(ai.rawResultJson); } catch {}
  }

  // Detection — ưu tiên từ aiAnalysis (includeAnalysis=true trả đầy đủ ở đây)
  const predictedLabel = ai?.label || image.aiPredictedLabel || null;
  const confidence = ai?.confidence ?? image.aiConfidence ?? null;
  // confidenceRate: dạng % đã nhân 100 (77.08), fallback tính từ confidence
  const confidenceRate = image.aiConfidenceRate ?? (confidence != null ? Number(confidence) * 100 : null);
  const className = ai?.className || image.aiClassName || null;
  const isHealthy = ai?.isHealthy ?? image.aiIsHealthy ?? null;
  const detectionCount = ai?.detectionCount ?? image.detectionCount ?? null;

  // Gate
  const gateLabel = ai?.gateLabel || null;
  const gateConfidence = ai?.gateConfidence ?? null;
  const gateThreshold = ai?.gateThreshold ?? null;
  const gatePrediction = rawParsed?.gate?.prediction || ai?.gate?.prediction || ai?.gatePrediction || null;

  // Status — normalize về lowercase để map
  const rawFinalStatus = ai?.finalStatus || image.finalStatus || null;
  const finalStatus = rawFinalStatus ? String(rawFinalStatus).toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2') : null;
  const aiStatus = image.aiStatus || image.status || null;
  const isOk = aiStatus === 'Completed' || aiStatus === 'Success';
  const isPending = aiStatus === 'Pending' || aiStatus === 'Queued' || aiStatus === 'Running';
  const isFailed = aiStatus === 'Failed' || aiStatus === 'Error' || aiStatus === 'error';

  // Annotated image
  const annotatedUrl = ai?.annotatedImageUrl || image.aiAnnotatedImageUrl || null;
  const bestBox = ai?.bestBox || image.bestBox || null;

  // Disease info (Tomato) — đọc từ nhiều nguồn
  const diseaseInfo = ai?.diseaseInfo || image.diseaseInfo || null;
  const diseaseDesc = diseaseInfo?.description || image.aiDiseaseDescription || null;
  const diseaseTreat = diseaseInfo?.treatment || image.aiDiseaseTreatment || null;

  // Probabilities — ưu tiên từ rawResultJson.gate.probabilities (Tomato gate trả ở đây), fallback top-level
  const probabilities = (rawParsed?.gate?.probabilities && typeof rawParsed.gate.probabilities === 'object')
    ? rawParsed.gate.probabilities
    : (ai?.probabilities && typeof ai.probabilities === 'object')
      ? ai.probabilities
      : (image.probabilities && typeof image.probabilities === 'object')
        ? image.probabilities
        : null;

  // Crop predictions (Tomato sau gate)
  const cropPredictions = rawParsed?.crop_predictions || ai?.cropPredictions || null;

  // Argo: 3 confidence types
  const confKidney = ai?.confidence_kidney ?? image.confidence_kidney ?? null;
  const confPercentile = ai?.confidence_percentile ?? image.confidence_percentile ?? null;
  const confAbsolute = ai?.confidence_absolute ?? image.confidence_absolute ?? null;
  const hasTriple = confKidney != null || confPercentile != null || confAbsolute != null;

  // Detections
  const detections = Array.isArray(ai?.detections)
    ? ai.detections
    : Array.isArray(image.detections)
      ? image.detections
      : [];

  const providerMeta = getAiProvider(image.aiProvider || ai?.aiProvider || '');
  const isArgo = image.aiProvider === 'ArgoPestOnnx' || ai?.aiProvider === 'ArgoPestOnnx';
  const isTomato = image.aiProvider === 'TomatoLeafDiseaseOnnx' || ai?.aiProvider === 'TomatoLeafDiseaseOnnx';

  // Disease translation (Tomato)
  const diseaseMeta = predictedLabel ? TOMATO_DISEASE_MAP[predictedLabel] : null;
  const sevStyle = diseaseMeta?.severity ? SEVERITY_STYLE[diseaseMeta.severity] : null;

  // Final status metadata — key đã normalize lowercase
  const STATUS_META = {
    healthy:            { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: '✓', label: 'Khỏe mạnh' },
    pestclassified:     { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    icon: '🐛', label: 'Phát hiện sâu bệnh' },
    notdetected:       { bg: 'bg-sky-100',     text: 'text-sky-700',     border: 'border-sky-200',     icon: '🔍', label: 'Không phát hiện' },
    nottomatoleaf:     { bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',   icon: '🚫', label: 'Không phải lá cà chua' },
    gaterrejected:     { bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',   icon: '🚫', label: 'Gate bị từ chối' },
    out_of_domain:     { bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',   icon: '🚫', label: 'Ảnh không thuộc miền nhận dạng' },
    completed:          { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: '✓', label: 'Hoàn tất' },
    failed:             { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    icon: '✕', label: 'Thất bại' },
  };
  const meta = finalStatus ? (STATUS_META[finalStatus] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'ℹ', label: rawFinalStatus }) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10 rounded-t-2xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">🤖</span>
              <h3 className="text-sm font-bold text-slate-900">Kết Quả AI Scan</h3>
              {providerMeta && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                  {providerMeta.icon} {providerMeta.name}
                </span>
              )}
              {isArgo && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">🐛 Sâu Bệnh</span>}
              {isTomato && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">🍅 Cà Chua</span>}
            </div>
            {image.caption && <p className="text-[11px] text-slate-500 mt-1">{image.caption}</p>}
            {plantImageId && <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {plantImageId}</p>}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold shrink-0">
            ✕ Đóng
          </button>
        </div>

        {/* Ảnh */}
        {(annotatedUrl || image.imageUrl) && (
          <div className="px-5 pt-4">
            {annotatedUrl ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold">✓ Ảnh đã khoanh vùng</span>
                  <span className="text-[9px] text-slate-500 italic">Model đã vẽ bounding box</span>
                </div>
                <a href={annotatedUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={annotatedUrl} alt="Ảnh khoanh vùng"
                    className="w-full max-h-72 object-contain rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 transition" />
                </a>
                {bestBox && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-slate-50 rounded px-2 py-1">
                    <span>📦 Vùng phát hiện: x1={bestBox.x1}, y1={bestBox.y1} → x2={bestBox.x2}, y2={bestBox.y2}</span>
                    <span className="ml-auto text-[9px] text-slate-400 italic">{detectionCount ?? detections.length} đối tượng</span>
                  </div>
                )}
              </div>
            ) : (
              <a href={image.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img src={image.imageUrl} alt={image.caption || 'Ảnh'}
                  className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-400 transition" />
              </a>
            )}
          </div>
        )}

        <div className="px-5 py-4 space-y-3">

          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white ${isOk ? 'bg-emerald-600' : isPending ? 'bg-amber-600' : 'bg-rose-600'}`}>
              {isOk ? '✓ Hoàn tất' : isPending ? '⏳ Đang xử lý' : '✕ Thất bại / Chưa quét'}
            </span>
            {meta && (
              <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${meta.bg} ${meta.text} ${meta.border}`}>
                {meta.icon} {meta.label}
              </span>
            )}
            {isHealthy !== null && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {isHealthy ? '✓ Healthy' : '⚠ Bất thường'}
              </span>
            )}
            {apiVersion && <span className="ml-auto text-[9px] text-slate-400 font-mono">v{apiVersion}</span>}
          </div>

          {/* 🆕 Card CHẨN ĐOÁN BỆNH — hiển thị nổi bật cho Tomato */}
          {isTomato && predictedLabel && isOk && (
            <div className={`rounded-xl p-4 border-2 ${sevStyle ? sevStyle.bg + ' ' + sevStyle.border : 'bg-red-50 border-red-400'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{diseaseMeta?.icon || '🍅'}</span>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">🍅 Chẩn Đoán Bệnh Lá Cà Chua</p>
                      <p className="text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
                        {diseaseMeta ? diseaseMeta.vi : predictedLabel.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  {sevStyle && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sevStyle.bg} ${sevStyle.text}`}>
                      {sevStyle.icon} {sevStyle.label}
                    </span>
                  )}
                </div>
                {confidence != null && (
                  <div className="text-right shrink-0">
                    <p className={`text-xl font-extrabold ${confColor(confidence) === 'emerald' ? 'text-emerald-600' : confColor(confidence) === 'lime' ? 'text-lime-600' : confColor(confidence) === 'amber' ? 'text-amber-600' : 'text-rose-600'}`}>
                      {fmtPct(confidence)}
                    </p>
                    {confidenceRate != null && Math.abs(confidenceRate - Number(confidence) * 100) > 1 && (
                      <p className="text-[9px] text-slate-400 font-mono">({confidenceRate.toFixed(1)}%)</p>
                    )}
                  </div>
                )}
              </div>
              {confidence != null && (
                <div className="mt-3 w-full bg-white/60 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div className={`h-full rounded-full transition-all ${
                    confColor(confidence) === 'emerald' ? 'bg-emerald-500' :
                    confColor(confidence) === 'lime' ? 'bg-lime-500' :
                    confColor(confidence) === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                    style={{ width: `${Math.min(100, (Number(confidence) || 0) * 100)}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Label + Confidence (hiện khi không phải Tomato hoặc không có kết quả) */}
          {(!isTomato || !predictedLabel) && (
            <div className="grid grid-cols-2 gap-2">
              {predictedLabel && (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">🔍 Phát Hiện</p>
                  <p className="text-base font-extrabold text-emerald-700 leading-tight">{predictedLabel}</p>
                  {className && className !== predictedLabel && (
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">{className}</p>
                  )}
                </div>
              )}
              {confidence != null && (
                <div className={`bg-${confColor(confidence)}-50 border-2 border-${confColor(confidence)}-200 rounded-xl p-3`}>
                  <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">
                    📊 Độ Tin Cậy
                    {confidenceRate != null && Math.abs(confidenceRate - Number(confidence) * 100) > 1 && (
                      <span className="normal-case font-mono ml-1">({confidenceRate.toFixed(1)}%)</span>
                    )}
                  </p>
                  <p className={`text-xl font-extrabold text-${confColor(confidence)}-700`}>{fmtPct(confidence)}</p>
                  <div className="w-full bg-white rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
                    <div className={`h-full rounded-full bg-${confColor(confidence)}-500`}
                      style={{ width: `${Math.min(100, (Number(confidence) || 0) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ảnh gốc (khi có annotated) */}
          {annotatedUrl && image.imageUrl && image.imageUrl !== annotatedUrl && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">📷 Ảnh gốc</p>
              <a href={image.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img src={image.imageUrl} alt="Ảnh gốc"
                  className="w-full max-h-40 object-contain rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-400 transition" />
              </a>
            </div>
          )}

          {/* Argo: 3 confidence types */}
          {hasTriple && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-2">📊 Chi Tiết Confidence</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { lbl: 'Kidney 💎', v: confKidney, color: 'indigo' },
                  { lbl: 'Percentile 📈', v: confPercentile, color: 'sky' },
                  { lbl: 'Absolute 🎯', v: confAbsolute, color: 'emerald' },
                ].filter(x => x.v != null).map(row => {
                  const c = Number(row.v) || 0;
                  return (
                    <div key={row.lbl} className="bg-slate-50 rounded-lg p-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="font-bold text-slate-700">{row.lbl}</span>
                        <span className="font-mono font-bold text-slate-800">{fmtPct(row.v)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full bg-${row.color}-500`}
                          style={{ width: `${Math.min(100, c * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gate info */}
          {(gateLabel || gateConfidence != null || gateThreshold != null || gatePrediction || rawParsed?.message) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-amber-700 flex items-center gap-1">
                🚪 Cổng Xác Thực (Gate)
                <span className="ml-auto text-[9px] normal-case font-normal text-amber-600">
                  {isArgo ? 'Xác nhận ảnh có sâu bệnh' : 'Xác nhận ảnh là lá cà chua'}
                </span>
              </p>
              {rawParsed?.message && (
                <p className="text-[11px] text-amber-800 italic bg-amber-100 rounded-lg px-2.5 py-1.5 border border-amber-200">
                  💬 {rawParsed.message}
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {gateLabel && (
                  <div>
                    <span className="text-[9px] text-amber-600 font-semibold">Loại gate</span>
                    <p className="font-bold font-mono text-amber-900 text-[11px]">{gateLabel}</p>
                  </div>
                )}
                {gatePrediction && gatePrediction !== gateLabel && (
                  <div>
                    <span className="text-[9px] text-amber-600 font-semibold">Prediction</span>
                    <p className="font-bold font-mono text-amber-900 text-[11px]">{gatePrediction}</p>
                  </div>
                )}
                {gateConfidence != null && (
                  <div>
                    <span className="text-[9px] text-amber-600 font-semibold">Confidence</span>
                    <p className="font-bold font-mono text-amber-900 text-[11px]">{fmtPct(gateConfidence)}</p>
                  </div>
                )}
                {gateThreshold != null && (
                  <div>
                    <span className="text-[9px] text-amber-600 font-semibold">Ngưỡng</span>
                    <p className="font-bold font-mono text-amber-900 text-[11px]">{fmtPct(gateThreshold)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thông tin bệnh chi tiết */}
          {(diseaseDesc || diseaseTreat || (diseaseMeta && isTomato && diseaseMeta.treat)) && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-bold uppercase text-orange-700">📋 Thông Tin Bệnh</p>
              {diseaseDesc && (
                <div>
                  <p className="font-bold text-orange-900 text-[11px] mb-0.5">Mô tả</p>
                  <p className="text-orange-800 text-[11px] leading-relaxed">{diseaseDesc}</p>
                </div>
              )}
              {(diseaseTreat || diseaseMeta?.treat) && (
                <div>
                  <p className="font-bold text-orange-900 text-[11px] mb-0.5">💊 Phương pháp điều trị</p>
                  <p className="text-orange-800 text-[11px] leading-relaxed whitespace-pre-line">
                    {diseaseTreat || diseaseMeta?.treat}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Probabilities (Tomato) */}
          {probabilities && Object.keys(probabilities).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-2">
                🌿 Xác Suất Tất Cả Lớp ({Object.keys(probabilities).length})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {Object.entries(probabilities)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([k, v]) => {
                    const c = Number(v) || 0;
                    const isTop = k === predictedLabel || k === className;
                    return (
                      <div key={k} className={`rounded-lg px-2 py-1 ${isTop ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between text-[10px] gap-2">
                          <span className={`font-mono truncate ${isTop ? 'font-bold text-emerald-700' : 'text-slate-700'}`}
                            title={k}>{k.replace(/_/g, ' ')}</span>
                          <span className={`font-mono font-bold shrink-0 ${isTop ? 'text-emerald-700' : 'text-slate-800'}`}>{fmtPct(v)}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1 mt-0.5 overflow-hidden">
                          <div className={`h-full rounded-full ${isTop ? 'bg-emerald-500' : `bg-${confColor(c)}-400`}`}
                            style={{ width: `${Math.min(100, c * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Detections */}
          {detections.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold uppercase text-slate-500">🎯 Danh Sách Phát Hiện ({detections.length})</p>
                {detectionCount != null && (
                  <span className="text-[9px] text-slate-400 font-mono">Tổng: {detectionCount}</span>
                )}
              </div>
              <div className="space-y-1">
                {detections.slice(0, 10).map((d, i) => {
                  const cls = d.class_name || d.class || d.label || `#${i + 1}`;
                  const conf = d.confidence ?? d.score ?? null;
                  const bbox = d.bbox || d.boundingBox;
                  const bboxStr = bbox
                    ? (Array.isArray(bbox) ? `[${bbox.map(n => Math.round(Number(n) || 0)).join(',')}]`
                      : (typeof bbox === 'object' ? `[${bbox.x1},${bbox.y1},${bbox.x2},${bbox.y2}]` : null))
                    : null;
                  return (
                    <div key={i} className="flex items-center gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="font-bold text-slate-800 truncate flex-1" title={cls}>{cls.replace(/_/g, ' ')}</span>
                      {conf != null && (
                        <span className={`font-mono font-bold shrink-0 px-1.5 py-0.5 rounded ${
                          Number(conf) >= 0.9 ? 'bg-emerald-100 text-emerald-700' :
                          Number(conf) >= 0.7 ? 'bg-lime-100 text-lime-700' :
                          Number(conf) >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {fmtPct(conf)}
                        </span>
                      )}
                      {bboxStr && (
                        <span className="font-mono text-[9px] text-slate-400 shrink-0" title="Bounding box">{bboxStr}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Retry button */}
          {(isFailed || isPending) && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1">
                <span>⚠️</span>
                {isPending ? 'AI scan đang chờ xử lý. Bấm để retry.' : 'AI scan thất bại. Bấm để chạy lại.'}
              </p>
              <button
                type="button"
                disabled={polling}
                onClick={() => {
                  if (!onRetry) return;
                  const imageId = image.id || plantImageId;
                  setPollError(null);
                  setPolling(true);
                  setPollElapsed(0);
                  Promise.resolve(onRetry(imageId))
                    .then(() => startPolling(imageId))
                    .catch((err) => {
                      console.error('[AiResultModal] retry error:', err);
                      setPollError(err?.message || 'Retry thất bại');
                      setPolling(false);
                    });
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition"
              >
                <span className={polling ? 'animate-spin' : ''}>⟳</span> {polling ? 'Đang retry...' : 'Retry AI Scan'}
              </button>
            </div>
          )}

          {/* Polling indicator */}
          {polling && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
                <p className="text-[11px] text-sky-700 font-bold">
                  Đang chờ AI xử lý... ({pollElapsed}s / 120s)
                </p>
              </div>
              <div className="w-full bg-sky-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-1000"
                  style={{ width: `${Math.min(100, (pollElapsed / 120) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-sky-600">
                Tự động reload kết quả mỗi 5 giây. Bạn có thể đóng modal và quay lại sau.
              </p>
              {pollError && (
                <p className="text-[10px] text-rose-600 font-semibold">⚠ {pollError}</p>
              )}
            </div>
          )}

          {/* Metadata footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>
              {image.aiScannedAt && `Scan: ${new Date(image.aiScannedAt).toLocaleString('vi-VN')}`}
              {image.aiCompletedAt && ` · Hoàn tất: ${new Date(image.aiCompletedAt).toLocaleString('vi-VN')}`}
              {!image.aiScannedAt && !image.aiCompletedAt && image.createdAt && `Tạo: ${new Date(image.createdAt).toLocaleString('vi-VN')}`}
            </span>
            <span>{plantImageId && `ID: ${plantImageId}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiResultModal;
