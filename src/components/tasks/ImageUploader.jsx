import React, { useRef, useState, useCallback } from 'react';
import { getAiProvider, AI_PROVIDERS } from '../../api/sharedTaskApi';

/**
 * ImageUploader (v5 — Mỗi ảnh 1 AI provider riêng, UX tối ưu)
 *
 * Luồng upload mới (mobile):
 *  - KHÔNG tự upload lên Cloudinary khi chọn file → chỉ giữ File binary + previewUrl
 *  - User CHỌN AI provider RIÊNG cho TỪNG ẢNH
 *    → Bấm vào ẢNH hoặc bấm BADGE provider để mở picker overlay
 *    → Hoặc bấm icon 🖼️ (nếu ảnh từ BE) để mở xem ảnh lớn
 *  - Khi bấm "Hoàn Thành & Gửi Báo Cáo" → loop qua từng ảnh có file
 *    → gọi POST /task-images/upload (multipart) RIÊNG CHO MỖI ẢNH
 *    → mỗi request có file + aiProvider tương ứng của ảnh đó
 *  - BE lưu TaskImage, enqueue worker xử lý AI ngầm
 *
 * Value mỗi item: { file, previewUrl, caption, fileName, fileSize, aiProvider, localId?, imageId? }
 *
 * Props:
 *  - value: Array<{ file, previewUrl, caption, fileName, fileSize, imageId?, url?, ai?, aiStatus?, aiProvider? }>
 *  - onChange: (images) => void
 *  - experimentId, batchId, taskId, taskReportId: context
 *  - disabled: boolean
 *  - maxFiles: số ảnh tối đa (default 10)
 *  - maxSizeMb: dung lượng tối đa mỗi ảnh (default 8)
 *  - enableAiScan: bật/tắt tính năng quét AI (default true)
 *  - defaultAiProvider: provider mặc định cho ảnh mới (default 'TomatoLeafDiseaseOnnx')
 */
const ImageUploader = ({
  value = [],
  onChange,
  experimentId,
  batchId,
  taskId,
  taskReportId,
  disabled = false,
  maxFiles = 10,
  maxSizeMb = 8,
  enableAiScan = true,
  defaultAiProvider = 'TomatoLeafDiseaseOnnx'
}) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionDraft, setCaptionDraft] = useState('');
  // 🆕 Overlay đang mở cho ảnh nào (idx) — dùng chung cho cả 2 loại: provider picker + delete confirm
  const [overlayFor, setOverlayFor] = useState(null); // null | { type: 'provider'|'delete', idx }
  // 🆕 Provider picker đang mở cho ảnh nào (idx)
  const [pickerFor, setPickerFor] = useState(null);

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const validateFile = (file) => {
    if (!file.type.startsWith('image/')) {
      return `File "${file.name}" không phải định dạng ảnh`;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      return `File "${file.name}" vượt quá ${maxSizeMb}MB (${formatSize(file.size)})`;
    }
    return null;
  };

  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const remaining = maxFiles - value.length;
    if (remaining <= 0) {
      alert(`Đã đạt giới hạn ${maxFiles} ảnh.`);
      return;
    }

    const filesToAdd = files.slice(0, remaining);
    const validFiles = [];
    const errors = [];
    for (const file of filesToAdd) {
      const err = validateFile(file);
      if (err) errors.push(err);
      else validFiles.push(file);
    }

    if (errors.length > 0) alert(errors.join('\n'));

    // Mỗi ảnh mới mang aiProvider = defaultAiProvider (riêng từng ảnh)
    const newItems = validFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      fileName: file.name,
      fileSize: file.size,
      localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      aiProvider: enableAiScan ? defaultAiProvider : null
    }));

    onChange?.([...value, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [maxFiles, value, onChange, enableAiScan, defaultAiProvider]);

  const handleFileSelect = (e) => {
    handleFiles(e.target.files);
  };

  const handleRemove = (idx) => {
    if (disabled) return;
    const target = value[idx];
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange?.(value.filter((_, i) => i !== idx));
    setOverlayFor(null);
  };

  const startEditCaption = (idx) => {
    setEditingCaption(idx);
    setCaptionDraft(value[idx]?.caption || '');
  };

  const saveCaption = (idx) => {
    const updated = value.map((img, i) =>
      i === idx ? { ...img, caption: captionDraft.trim() } : img
    );
    onChange?.(updated);
    setEditingCaption(null);
    setCaptionDraft('');
  };

  // 🆕 Mở picker đổi AI provider cho 1 ảnh
  const openProviderPicker = (idx) => {
    if (disabled) return;
    setPickerFor(pickerFor === idx ? null : idx);
  };

  // 🆕 Đổi AI provider cho 1 ảnh cụ thể
  const handleChangeProvider = (idx, newProvider) => {
    const updated = value.map((img, i) =>
      i === idx ? { ...img, aiProvider: newProvider || null } : img
    );
    onChange?.(updated);
    setPickerFor(null);
  };

  // 🆕 Mở overlay actions cho 1 ảnh (bấm vào ảnh)
  const openOverlay = (idx) => {
    if (disabled) return;
    setOverlayFor(overlayFor?.idx === idx ? null : { idx });
  };

  const closeOverlay = () => {
    setOverlayFor(null);
    setPickerFor(null);
  };

  const handleUploadClick = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const localImagesCount = value.filter(img => img.file).length;

  return (
    <div className="rounded-xl p-4 border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📷</span>
          <h4 className="text-xs font-bold text-slate-700">Hình ảnh đính kèm</h4>
          <span className="text-[10px] text-on-surface-variant font-mono">
            {value.length}/{maxFiles}
          </span>
          <span className="text-[10px] text-amber-700 font-bold">
            ⏳ Upload kèm báo cáo
          </span>
        </div>
        {!disabled && value.length < maxFiles && (
          <button type="button" onClick={handleUploadClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold transition-colors">
            📤 Chọn ảnh từ máy
          </button>
        )}
      </div>

      {/* Thông tin: mỗi ảnh 1 provider riêng */}
      {enableAiScan && localImagesCount > 0 && (
        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1.5">
            <span>🤖</span>
            <span>Bấm vào ảnh để chọn loại quét AI riêng cho từng ảnh</span>
          </p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect}
        className="hidden" disabled={disabled} />

      {/* Drop zone khi chưa có ảnh */}
      {value.length === 0 && (
        <div
          onClick={handleUploadClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragOver
              ? 'border-indigo-500 bg-indigo-100/50 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
          } ${disabled ? '' : 'cursor-pointer'}`}>
          <div className="text-5xl mb-3">{dragOver ? '📥' : '🖼️'}</div>
          <p className="text-sm text-slate-700 font-bold mb-1">
            {dragOver ? 'Thả ảnh vào đây!' : 'Chọn ảnh từ máy tính'}
          </p>
          <p className="text-[11px] text-slate-500 mb-3">
            Bấm vào đây hoặc kéo thả file ảnh vào khung này
          </p>
          <div className="inline-flex items-center gap-3 text-[10px] text-slate-400 font-mono">
            <span>📁 JPG, PNG, WEBP</span>
            <span>•</span>
            <span>📏 Tối đa {maxSizeMb}MB</span>
            <span>•</span>
            <span>🖼️ Tối đa {maxFiles} ảnh</span>
          </div>
        </div>
      )}

      {/* Grid ảnh đã chọn */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {value.map((img, idx) => {
            const imgKey = img.localId || img.imageId || String(idx);
            const providerMeta = img.aiProvider ? (getAiProvider(img.aiProvider) || AI_PROVIDERS.find(p => p.code === img.aiProvider)) : null;
            const isPickerOpen = pickerFor === idx;
            const isOverlayOpen = overlayFor?.idx === idx;
            const hasAiEnabled = enableAiScan && img.file;

            return (
              <div key={imgKey}
                className={`relative border rounded-lg overflow-hidden bg-slate-50 flex flex-col transition-all ${
                  isPickerOpen
                    ? 'border-amber-400 ring-2 ring-amber-300'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* ===== VÙNG ẢNH — bấm để mở provider picker ===== */}
                <div className="relative">
                  <img
                    src={img.previewUrl || img.url}
                    alt={img.caption || `Ảnh ${idx + 1}`}
                    className="w-full h-28 object-cover cursor-pointer"
                    onClick={() => hasAiEnabled && openProviderPicker(idx)}
                  />

                  {/* Overlay mờ khi hover / picker open — cho thấy bấm được */}
                  <div
                    className={`absolute inset-0 transition-all flex items-center justify-center ${
                      isPickerOpen
                        ? 'bg-black/40'
                        : 'bg-black/0 hover:bg-black/30'
                    }`}
                    onClick={() => hasAiEnabled && openProviderPicker(idx)}
                  >
                    {hasAiEnabled && !isPickerOpen && (
                      <div className="bg-white/90 rounded-lg px-3 py-1.5 shadow-lg text-center">
                        <span className="text-base">🤖</span>
                        <p className="text-[9px] font-bold text-slate-700 mt-0.5">
                          {providerMeta ? `${providerMeta.icon} ${providerMeta.name.split(' ')[0]}` : 'Chọn AI'}
                        </p>
                        <p className="text-[8px] text-slate-500">Bấm để đổi</p>
                      </div>
                    )}
                    {isPickerOpen && (
                      <div className="bg-white/95 rounded-lg px-3 py-2 shadow-xl text-center">
                        <span className="text-lg">{providerMeta?.icon || '🤖'}</span>
                        <p className="text-[9px] font-bold text-slate-700 mt-0.5">
                          {providerMeta ? providerMeta.name : 'Chưa chọn'}
                        </p>
                        <p className="text-[8px] text-amber-600 font-bold mt-0.5">✓ Đang chọn</p>
                      </div>
                    )}
                  </div>

                  {/* Tên file */}
                  {img.fileName && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white rounded text-[9px] font-mono max-w-[calc(100%-0.5rem)] truncate"
                      title={`${img.fileName} (${formatSize(img.fileSize)})`}>
                      📎 {img.fileName}
                    </div>
                  )}

                  {/* 🆕 Provider badge hiện trên ảnh (luôn hiển thị, bấm vào đây cũng mở picker) */}
                  {hasAiEnabled && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openProviderPicker(idx); }}
                      disabled={disabled}
                      className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 transition-all pointer-events-auto ${
                        isPickerOpen
                          ? 'bg-amber-500 text-white'
                          : 'bg-indigo-600/90 text-white hover:bg-amber-500'
                      }`}
                      title={providerMeta ? `${providerMeta.icon} ${providerMeta.name}` : 'Chưa chọn AI'}
                    >
                      🤖 {providerMeta ? `${providerMeta.icon} ${providerMeta.name.split(' ')[0]}` : '—'}
                    </button>
                  )}
                </div>

                {/* ===== Provider Picker Panel ===== */}
                {isPickerOpen && hasAiEnabled && (
                  <div className="bg-white border-t border-indigo-200 p-2 space-y-1">
                    <p className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider text-center mb-1">
                      🤖 Chọn loại quét AI cho ảnh này
                    </p>
                    {AI_PROVIDERS.map(p => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => handleChangeProvider(idx, p.code)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-colors ${
                          img.aiProvider === p.code
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                            : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 border border-transparent'
                        }`}
                      >
                        <span className="text-base">{p.icon}</span>
                        <span className="flex-1">{p.name}</span>
                        {img.aiProvider === p.code && (
                          <span className="text-emerald-500 text-[11px]">✓</span>
                        )}
                        {p.description && (
                          <span className="text-[8px] text-slate-400 hidden group-hover:block truncate max-w-[120px]">
                            {p.description.split('.')[0]}
                          </span>
                        )}
                      </button>
                    ))}
                    {/* Tắt AI cho ảnh này */}
                    <button
                      type="button"
                      onClick={() => handleChangeProvider(idx, null)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-colors ${
                        !img.aiProvider
                          ? 'bg-slate-200 text-slate-500 border border-slate-300'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      <span>🚫</span>
                      <span className="flex-1">Không quét AI</span>
                      {!img.aiProvider && (
                        <span className="text-emerald-500 text-[11px]">✓</span>
                      )}
                    </button>
                  </div>
                )}

                {/* Caption */}
                <div className="p-1.5 bg-white">
                  {editingCaption === idx ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={captionDraft}
                        onChange={e => setCaptionDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveCaption(idx);
                          if (e.key === 'Escape') setEditingCaption(null);
                        }}
                        placeholder="Mô tả ảnh..."
                        className="flex-1 px-1.5 py-1 border border-slate-300 rounded text-[10px] focus:outline-none focus:border-indigo-400"
                        autoFocus
                      />
                      <button type="button" onClick={() => saveCaption(idx)}
                        className="px-1.5 py-1 bg-emerald-500 text-white rounded text-[10px] font-bold">
                        ✓
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => startEditCaption(idx)}
                        className="flex-1 text-left text-[10px] text-slate-600 hover:text-indigo-600 truncate">
                        {img.caption || <span className="italic text-slate-400">+ Mô tả</span>}
                      </button>
                      {/* Nút xóa nhỏ */}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          className="text-slate-300 hover:text-rose-500 transition-colors p-0.5 shrink-0"
                          title="Xóa ảnh"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Nút thêm ảnh */}
          {!disabled && value.length < maxFiles && (
            <button type="button" onClick={handleUploadClick}
              className="h-28 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors">
              <span className="text-2xl">➕</span>
              <span className="text-[10px] font-bold mt-1">Thêm ảnh</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
