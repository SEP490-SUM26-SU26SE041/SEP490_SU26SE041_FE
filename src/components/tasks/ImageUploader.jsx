import React, { useRef, useState, useCallback } from 'react';
import { getAiProvider, AI_PROVIDERS } from '../../api/sharedTaskApi';

/**
 * ImageUploader (v3 — Không tự upload, giữ file binary để submit cùng task report)
 *
 * Thay đổi UX:
 *  - KHÔNG tự upload lên Cloudinary khi chọn file
 *  - Chỉ giữ File binary + previewUrl, để task report submit multipart kèm File
 *  - Hiển thị preview ảnh NGAY khi user chọn file (dùng URL.createObjectURL)
 *  - Drag & drop từ desktop
 *  - Hiển thị tên file + dung lượng
 *  - Validate file ảnh + size
 *  - Hiển thị AI badge trên tile theo image.aiStatus (Pending / Completed / Failed / idle)
 *  - AI Scan Panel hiển thị inline dưới tile ảnh (không bị cắt)
 *
 * Value mỗi item: { file, previewUrl, caption, fileName, fileSize, ai? }
 *
 * Props:
 *  - value: Array<{ file, previewUrl, caption, fileName, fileSize, imageId?, url?, ai?, aiStatus? }>
 *  - onChange: (images) => void
 *  - experimentId, batchId, taskId, taskReportId: context
 *  - disabled: boolean
 *  - maxFiles: số ảnh tối đa (default 10)
 *  - maxSizeMb: dung lượng tối đa mỗi ảnh (default 8)
 *  - enableAiScan: bật/tắt tính năng quét AI (default true)
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
  enableAiScan = true
}) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingCaption, setEditingCaption] = useState(null);
  const [captionDraft, setCaptionDraft] = useState('');
  // 🆕 AI provider được chọn cho TẤT CẢ ảnh trong batch này
  const [selectedAiProvider, setSelectedAiProvider] = useState('TomatoLeafDiseaseOnnx');

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

    const newItems = validFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      fileName: file.name,
      fileSize: file.size,
      localId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      aiProvider: enableAiScan ? selectedAiProvider : null
    }));

    onChange?.([...value, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [maxFiles, value, onChange]);

  const handleFileSelect = (e) => {
    handleFiles(e.target.files);
  };

  const handleRemove = (idx) => {
    if (disabled) return;
    const target = value[idx];
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange?.(value.filter((_, i) => i !== idx));
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


  const selectedProviderMeta = getAiProvider(selectedAiProvider) || AI_PROVIDERS.find(p => p.code === selectedAiProvider) || { icon: '🤖', name: selectedAiProvider };

  return (
    <div className="rounded-xl p-4 border border-slate-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📷</span>
          <h4 className="text-xs font-bold text-slate-700">Hình ảnh đính kèm</h4>
          <span className="text-[10px] text-on-surface-variant font-mono">
            {value.length}/{maxFiles}
          </span>
          <span className="text-[10px] text-amber-700 font-bold">
            ⏳ Sẽ upload kèm báo cáo
          </span>
        </div>
        {!disabled && value.length < maxFiles && (
          <button type="button" onClick={handleUploadClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold transition-colors">
            📤 Chọn ảnh từ máy
          </button>
        )}
      </div>

      {/* 🆕 AI Provider Selector — chọn loại quét AI cho tất cả ảnh trong batch này */}
      {enableAiScan && (
        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider whitespace-nowrap shrink-0">
            🤖 Quét AI:
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {AI_PROVIDERS.map(p => (
              <button
                key={p.code}
                type="button"
                onClick={() => {
                  setSelectedAiProvider(p.code);
                  // Cập nhật aiProvider cho tất cả ảnh local đã chọn
                  onChange?.(value.map(img => img.file ? { ...img, aiProvider: p.code } : img));
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                  selectedAiProvider === p.code
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-indigo-700 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100'
                }`}
                title={p.description}>
                {p.icon} {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <span className="text-[9px] text-indigo-500 italic ml-auto hidden sm:block shrink-0">
            {selectedProviderMeta.description?.split('.')[0] || ''}
          </span>
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

            return (
              <div key={imgKey}
                className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex flex-col">
                <div className="relative">
                  <img src={img.previewUrl || img.url} alt={img.caption || `Ảnh ${idx + 1}`}
                    className="w-full h-28 object-cover" />

                  {img.fileName && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white rounded text-[9px] font-mono max-w-[calc(100%-1rem)] truncate"
                      title={`${img.fileName} (${formatSize(img.fileSize)})`}>
                      📎 {img.fileName}
                    </div>
                  )}

                  {/* 🆕 AI provider badge trên tile */}
                  {img.aiProvider && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-indigo-600/80 text-white rounded text-[9px] font-bold flex items-center gap-1"
                      title={`AI: ${img.aiProvider}`}>
                      🤖 {(() => {
                        const m = getAiProvider(img.aiProvider);
                        return m ? `${m.icon} ${m.name.split(' ')[0]}` : img.aiProvider.slice(0, 8);
                      })()}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    {!disabled && (
                      <button type="button" onClick={() => handleRemove(idx)}
                        className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold shadow-lg"
                        title="Xóa ảnh">
                        🗑️ Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>

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
                    <button type="button" onClick={() => startEditCaption(idx)}
                      className="w-full text-left text-[10px] text-slate-600 hover:text-indigo-600 truncate">
                      {img.caption || <span className="italic text-slate-400">+ Thêm mô tả</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

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

/**
 * Map payload status từ AiScanPanel.onUpdate() → BE status convention
 */

export default ImageUploader;
