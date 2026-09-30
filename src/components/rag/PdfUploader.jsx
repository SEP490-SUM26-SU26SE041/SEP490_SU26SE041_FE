import React, { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import ragApi from '../../api/ragApi';

const MAX_FILE_SIZE_MB = 20; // giới hạn client-side theo tài liệu
const ACCEPT = '.pdf,application/pdf';

/**
 * Upload zone kéo/thả nhiều file PDF.
 * Props:
 *  - onUploaded?: ({ source_path, group_path, files, group }) => void
 */
const PdfUploader = ({ onUploaded }) => {
  const { showToast } = useToast();
  const [files, setFiles] = useState([]);
  const [group, setGroup] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleSelect = (selected) => {
    const valid = [];
    for (const f of selected) {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        showToast(`Bỏ qua "${f.name}" — chỉ chấp nhận PDF`, 'warning');
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        showToast(`Bỏ qua "${f.name}" — vượt quá ${MAX_FILE_SIZE_MB}MB`, 'warning');
        continue;
      }
      valid.push(f);
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleSelect(Array.from(e.dataTransfer.files));
  };

  const handleRemove = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) {
      showToast('Chọn ít nhất 1 file PDF', 'warning');
      return;
    }
    try {
      setUploading(true);
      const res = await ragApi.uploadPdfs(files, group);
      showToast(`Upload thành công ${res?.files?.length || files.length} file`, 'success');
      setFiles([]);
      if (onUploaded) onUploaded(res);
    } catch (e) {
      showToast(`Upload lỗi: ${e?.message || e}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={e => handleSelect(Array.from(e.target.files || []))}
        />
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm font-bold text-slate-700">
          {dragOver ? 'Thả file để upload' : 'Kéo/thả PDF vào đây hoặc click để chọn'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Tối đa {MAX_FILE_SIZE_MB}MB / file. Chỉ chấp nhận .pdf
        </p>
      </div>

      {/* Group selector */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-slate-600">Nhóm tri thức:</label>
        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="general">📚 Tổng hợp (general)</option>
          <option value="crops">🌱 Cây trồng (crops)</option>
          <option value="livestock">🐄 Chăn nuôi (livestock)</option>
          <option value="soil">🌍 Đất & phân bón (soil)</option>
          <option value="pest">🐛 Sâu bệnh (pest)</option>
        </select>
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-600">{files.length} file đã chọn:</p>
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
              <span className="flex-1 truncate">
                <span className="font-mono">📄 {f.name}</span>
                <span className="text-slate-400 ml-2">({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-rose-600 hover:bg-rose-50 rounded px-1.5"
                title="Xóa"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading || files.length === 0}
        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
            Đang upload…
          </>
        ) : (
          <>📤 Upload {files.length > 0 ? `${files.length} file` : ''}</>
        )}
      </button>
    </div>
  );
};

export default PdfUploader;