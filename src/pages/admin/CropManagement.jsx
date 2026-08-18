import React, { useEffect, useMemo, useState } from 'react';
import { cropsApi } from '../../api/cropApi';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/ui/Pagination';
import { required, minLength, maxLength, validateForm, isValid } from '../../utils/validation';

const cropSchema = {
  cropName: (v) => required('Tên cây trồng là bắt buộc')(v) || minLength(2, 'Tối thiểu 2 ký tự')(v) || maxLength(100)(v),
  scientificName: maxLength(150),
  category: maxLength(80),
  description: maxLength(1000)
};

const varietySchema = {
  cropId: required('Vui lòng chọn cây trồng'),
  varietyName: (v) => required('Tên giống là bắt buộc')(v) || minLength(2, 'Tối thiểu 2 ký tự')(v) || maxLength(100)(v),
  origin: maxLength(120),
  description: maxLength(1000)
};

// ============ Crop Modal (Create only - the backend API does not expose update) ============
const CropModal = ({ open, onClose, onSubmit, saving }) => {
  const [cropName, setCropName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setCropName('');
      setScientificName('');
      setCategory('');
      setDescription('');
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const values = { cropName, scientificName, category, description };
    const errs = validateForm(values, cropSchema);
    if (!isValid(errs)) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await onSubmit({
        cropName: cropName.trim(),
        scientificName: scientificName.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null
      });
    } catch (err) {
      setErrors({ _global: err.message || 'Lỗi' });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <h3 className="font-bold text-lg text-on-surface">Tạo Cây Trồng Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-xl leading-none"
          >✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Tên Cây Trồng <span className="text-rose-500">*</span>
            </label>
            <input
              value={cropName}
              onChange={(e) => {
                setCropName(e.target.value);
                if (errors.cropName) setErrors({ ...errors, cropName: null });
              }}
              placeholder="VD: Xà lách, Cà chua, Dưa chuột"
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                errors.cropName
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            />
            {errors.cropName && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.cropName}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Tên Khoa Học
            </label>
            <input
              value={scientificName}
              onChange={(e) => {
                setScientificName(e.target.value);
                if (errors.scientificName) setErrors({ ...errors, scientificName: null });
              }}
              placeholder="VD: Lactuca sativa"
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                errors.scientificName
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            />
            {errors.scientificName && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.scientificName}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Phân Loại
            </label>
            <input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (errors.category) setErrors({ ...errors, category: null });
              }}
              placeholder="VD: Rau ăn lá, Củ quả, Hoa"
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                errors.category
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            />
            {errors.category && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.category}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Mô Tả
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors({ ...errors, description: null });
              }}
              placeholder="Mô tả ngắn về cây trồng"
              rows={3}
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 resize-none ${
                errors.description
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            />
            {errors.description && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.description}</p>
            )}
          </div>

          {errors._global && (
            <p className="text-xs text-rose-600 font-semibold">{errors._global}</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {saving ? 'Đang tạo...' : 'Tạo Cây Trồng'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Variety Modal ============
const VarietyModal = ({ open, crops, onClose, onSubmit, saving, prefillCropId }) => {
  const [cropId, setCropId] = useState('');
  const [varietyName, setVarietyName] = useState('');
  const [origin, setOrigin] = useState('');
  const [growthDurationDays, setGrowthDurationDays] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setCropId(prefillCropId || (crops[0]?.id ?? ''));
      setVarietyName('');
      setOrigin('');
      setGrowthDurationDays('');
      setDescription('');
      setErrors({});
    }
  }, [open, prefillCropId, crops]);

  if (!open) return null;

  const submit = async () => {
    const values = {
      cropId,
      varietyName,
      origin,
      description
    };
    const errs = validateForm(values, varietySchema);
    if (!isValid(errs)) {
      setErrors(errs);
      return;
    }
    const durationNum = growthDurationDays ? parseInt(growthDurationDays, 10) : null;
    if (growthDurationDays && (isNaN(durationNum) || durationNum < 0)) {
      setErrors({ ...errs, growthDurationDays: 'Phải là số nguyên dương' });
      return;
    }
    setErrors({});
    try {
      await onSubmit({
        cropId,
        varietyName: varietyName.trim(),
        origin: origin.trim() || null,
        growthDurationDays: durationNum,
        description: description.trim() || null
      });
    } catch (err) {
      setErrors({ _global: err.message || 'Lỗi' });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">�</span>
            <h3 className="font-bold text-lg text-on-surface">Tạo Giống Cây Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface text-xl leading-none"
          >✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Cây Trồng <span className="text-rose-500">*</span>
            </label>
            <select
              value={cropId}
              onChange={(e) => {
                setCropId(e.target.value);
                if (errors.cropId) setErrors({ ...errors, cropId: null });
              }}
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                errors.cropId
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            >
              <option value="">— Chọn cây trồng —</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cropName}
                </option>
              ))}
            </select>
            {errors.cropId && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.cropId}</p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Tên Giống <span className="text-rose-500">*</span>
            </label>
            <input
              value={varietyName}
              onChange={(e) => {
                setVarietyName(e.target.value);
                if (errors.varietyName) setErrors({ ...errors, varietyName: null });
              }}
              placeholder="VD: Xà lách Romaine, Cà chua Cherry"
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                errors.varietyName
                  ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                  : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
              }`}
            />
            {errors.varietyName && (
              <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.varietyName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Xuất Xứ
              </label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="VD: Việt Nam, Nhật Bản"
                disabled={saving}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Thời Gian Sinh Trưởng (ngày)
              </label>
              <input
                type="number"
                min="0"
                value={growthDurationDays}
                onChange={(e) => {
                  setGrowthDurationDays(e.target.value);
                  if (errors.growthDurationDays) setErrors({ ...errors, growthDurationDays: null });
                }}
                placeholder="VD: 60"
                disabled={saving}
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${
                  errors.growthDurationDays
                    ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500'
                    : 'border-outline-variant focus:ring-primary/10 focus:border-primary'
                }`}
              />
              {errors.growthDurationDays && (
                <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.growthDurationDays}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Mô Tả
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về giống cây"
              rows={3}
              disabled={saving}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none"
            />
          </div>

          {errors._global && (
            <p className="text-xs text-rose-600 font-semibold">{errors._global}</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {saving ? 'Đang tạo...' : 'Tạo Giống'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Confirm Delete Modal ============
const ConfirmModal = ({ open, title, message, onClose, onConfirm, confirming }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-outline-variant">
          <h3 className="font-bold text-lg text-rose-600">{title}</h3>
        </div>
        <div className="p-6 text-sm text-on-surface">{message}</div>
        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={confirming}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
          >
            {confirming && (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {confirming ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Main Component ============
const CropManagement = () => {
  const { showToast } = useToast();

  // Crops
  const [crops, setCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [cropSearch, setCropSearch] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  const [cropPage, setCropPage] = useState(1);
  const [cropPageSize, setCropPageSize] = useState(10);
  const [expandedCrop, setExpandedCrop] = useState(null);
  const [varietiesCache, setVarietiesCache] = useState({});
  const [loadingVarieties, setLoadingVarieties] = useState(null);
  const [confirmCrop, setConfirmCrop] = useState({ open: false, id: null, name: '' });

  // Varieties
  const [showVarietyModal, setShowVarietyModal] = useState(false);
  const [varietyPrefillCropId, setVarietyPrefillCropId] = useState(null);
  const [savingVariety, setSavingVariety] = useState(false);
  const [confirmVariety, setConfirmVariety] = useState({ open: false, id: null, name: '', cropId: null });

  // ── Fetchers
  const fetchCrops = async () => {
    try {
      setLoadingCrops(true);
      const data = await cropsApi.getAll();
      const list = Array.isArray(data) ? data : [];
      setCrops(list);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách cây trồng', 'error');
      setCrops([]);
    } finally {
      setLoadingCrops(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  // ── Filtered crops
  const filteredCrops = useMemo(() => {
    const q = cropSearch.trim().toLowerCase();
    if (!q) return crops;
    return crops.filter((c) => {
      const varieties = varietiesCache[c.id] || [];
      const haystack = [
        c.cropName,
        c.scientificName,
        c.category,
        c.description,
        ...varieties.map((v) => v.varietyName)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [crops, cropSearch, varietiesCache]);

  // ── Crops CRUD
  const handleSubmitCrop = async (payload) => {
    setSavingCrop(true);
    try {
      await cropsApi.create(payload);
      showToast(`Đã tạo cây trồng "${payload.cropName}" thành công`, 'success');
      setShowCropModal(false);
      await fetchCrops();
    } finally {
      setSavingCrop(false);
    }
  };

  const handleDeleteCrop = async () => {
    setConfirmCrop((prev) => ({ ...prev, confirming: true }));
    try {
      await cropsApi.delete(confirmCrop.id);
      showToast('Đã xóa cây trồng', 'success');
      setConfirmCrop({ open: false, id: null, name: '' });
      if (expandedCrop === confirmCrop.id) setExpandedCrop(null);
      await fetchCrops();
    } catch (err) {
      showToast(err.message || 'Lỗi khi xóa cây trồng', 'error');
    } finally {
      setConfirmCrop((prev) => ({ ...prev, confirming: false }));
    }
  };

  // ── Varieties
  const toggleVarieties = async (cropId) => {
    if (expandedCrop === cropId) {
      setExpandedCrop(null);
      return;
    }
    setExpandedCrop(cropId);
    if (!varietiesCache[cropId]) {
      setLoadingVarieties(cropId);
      try {
        const data = await cropsApi.getVarieties(cropId);
        const list = Array.isArray(data) ? data : [];
        setVarietiesCache((prev) => ({ ...prev, [cropId]: list }));
      } catch (err) {
        showToast(err.message || 'Không thể tải danh sách giống', 'error');
        setVarietiesCache((prev) => ({ ...prev, [cropId]: [] }));
      } finally {
        setLoadingVarieties(null);
      }
    }
  };

  const openVarietyModal = (cropId = null) => {
    setVarietyPrefillCropId(cropId);
    setShowVarietyModal(true);
  };

  const handleSubmitVariety = async (payload) => {
    setSavingVariety(true);
    try {
      await cropsApi.createVariety(payload);
      showToast(`Đã tạo giống "${payload.varietyName}" thành công`, 'success');
      setShowVarietyModal(false);
      // Refresh varieties for the parent crop
      const data = await cropsApi.getVarieties(payload.cropId);
      const list = Array.isArray(data) ? data : [];
      setVarietiesCache((prev) => ({ ...prev, [payload.cropId]: list }));
    } finally {
      setSavingVariety(false);
    }
  };

  const handleDeleteVariety = async () => {
    setConfirmVariety((prev) => ({ ...prev, confirming: true }));
    try {
      await cropsApi.deleteVariety(confirmVariety.id);
      showToast('Đã xóa giống cây', 'success');
      setConfirmVariety({ open: false, id: null, name: '', cropId: null });
      const data = await cropsApi.getVarieties(confirmVariety.cropId);
      const list = Array.isArray(data) ? data : [];
      setVarietiesCache((prev) => ({ ...prev, [confirmVariety.cropId]: list }));
    } catch (err) {
      showToast(err.message || 'Lỗi khi xóa giống', 'error');
    } finally {
      setConfirmVariety((prev) => ({ ...prev, confirming: false }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng Cây Trồng', value: crops.length, color: 'text-primary' },
          {
            label: 'Có Giống',
            value: crops.filter((c) => (varietiesCache[c.id] || c.varieties || []).length > 0).length,
            color: 'text-emerald-600'
          },
          {
            label: 'Tổng Giống',
            value: Object.values(varietiesCache).reduce((s, arr) => s + arr.length, 0),
            color: 'text-blue-600'
          },
          {
            label: 'Phân Loại',
            value: new Set(crops.map((c) => c.category).filter(Boolean)).size,
            color: 'text-amber-600'
          }
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col gap-1 shadow-sm"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {s.label}
            </span>
            <span className={`font-hanken text-3xl lg:text-4xl font-bold ${s.color}`}>
              {loadingCrops ? '…' : s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-outline-variant rounded-2xl shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌱</span>
            <h3 className="font-hanken font-bold text-on-surface">Danh Mục Cây Trồng & Giống</h3>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm cây trồng hoặc giống..."
                value={cropSearch}
                onChange={(e) => {
                  setCropSearch(e.target.value);
                  setCropPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary"
              />
            </div>
            <button
              onClick={openVarietyModal.bind(null, null)}
              disabled={crops.length === 0}
              title={crops.length === 0 ? 'Tạo cây trồng trước' : 'Tạo giống'}
              className="px-3 py-2 border border-outline-variant text-on-surface rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-container/40 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Giống
            </button>
            <button
              onClick={() => setShowCropModal(true)}
              className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Cây Trồng
            </button>
          </div>
        </div>

        {loadingCrops ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : filteredCrops.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            {cropSearch
              ? 'Không tìm thấy cây trồng nào khớp với từ khóa.'
              : 'Chưa có cây trồng nào. Bấm "Cây Trồng" để tạo mới.'}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"></th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tên Cây Trồng</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tên Khoa Học</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Phân Loại</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-center">Giống</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredCrops
                .slice((cropPage - 1) * cropPageSize, cropPage * cropPageSize)
                .map((crop) => {
                  const isExpanded = expandedCrop === crop.id;
                  const varieties = varietiesCache[crop.id] || crop.varieties || [];
                  return (
                    <React.Fragment key={crop.id}>
                      <tr
                        className={`group transition-colors hover:bg-surface-container-low/30 ${isExpanded ? 'bg-surface-container-low/30' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleVarieties(crop.id)}
                            className="text-on-surface-variant hover:text-primary transition-colors"
                            title={isExpanded ? 'Thu gọn' : 'Xem giống'}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 text-lg">
                              🌿
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-on-surface">{crop.cropName}</div>
                              {crop.description && (
                                <div className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5">
                                  {crop.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm italic text-on-surface-variant font-mono">
                          {crop.scientificName || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {crop.category ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {crop.category}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant text-sm">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container/30 text-primary">
                            {varieties.length} giống
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openVarietyModal(crop.id)}
                              title="Thêm giống"
                              className="p-1.5 rounded-md text-on-surface-variant hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setConfirmCrop({ open: true, id: crop.id, name: crop.cropName })}
                              title="Xóa cây trồng"
                              className="p-1.5 rounded-md text-on-surface-variant hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded variety list */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-surface-container-low/40 px-12 py-4">
                            {loadingVarieties === crop.id ? (
                              <div className="text-xs text-on-surface-variant">Đang tải giống...</div>
                            ) : varieties.length === 0 ? (
                              <div className="text-xs text-on-surface-variant italic">
                                Chưa có giống nào.{' '}
                                <button
                                  onClick={() => openVarietyModal(crop.id)}
                                  className="text-primary font-bold hover:underline"
                                >
                                  Thêm giống cho "{crop.cropName}"
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                                    Danh sách giống ({varieties.length})
                                  </h4>
                                  <button
                                    onClick={() => openVarietyModal(crop.id)}
                                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Thêm giống
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {varieties.map((v) => (
                                    <div
                                      key={v.id}
                                      className="bg-white border border-outline-variant rounded-lg p-3 flex items-start justify-between gap-2 hover:border-primary/40 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-xs text-on-surface">{v.varietyName}</div>
                                        <div className="text-[10px] text-on-surface-variant mt-1 space-y-0.5">
                                          {v.origin && (
                                            <div>📍 {v.origin}</div>
                                          )}
                                          {v.growthDurationDays != null && (
                                            <div>� {v.growthDurationDays} ngày</div>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          setConfirmVariety({
                                            open: true,
                                            id: v.id,
                                            name: v.varietyName,
                                            cropId: crop.id
                                          })
                                        }
                                        title="Xóa giống"
                                        className="p-1 rounded text-on-surface-variant hover:bg-rose-50 hover:text-rose-700 transition-colors shrink-0"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="3 6 5 6 21 6" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loadingCrops && filteredCrops.length > 0 && (
          <Pagination
            page={cropPage}
            pageSize={cropPageSize}
            total={filteredCrops.length}
            onPageChange={setCropPage}
            onPageSizeChange={(s) => {
              setCropPageSize(s);
              setCropPage(1);
            }}
            className="border-t border-outline-variant bg-surface-container-low/30 px-6 py-3"
          />
        )}
      </div>

      {/* Modals */}
      <CropModal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        onSubmit={handleSubmitCrop}
        saving={savingCrop}
      />

      <VarietyModal
        open={showVarietyModal}
        crops={crops}
        prefillCropId={varietyPrefillCropId}
        onClose={() => setShowVarietyModal(false)}
        onSubmit={handleSubmitVariety}
        saving={savingVariety}
      />

      <ConfirmModal
        open={confirmCrop.open}
        title="Xác nhận xóa cây trồng"
        message={`Bạn có chắc chắn muốn xóa "${confirmCrop.name}"? Hành động này không thể hoàn tác và sẽ xóa tất cả giống thuộc cây trồng này.`}
        onClose={() => setConfirmCrop({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteCrop}
        confirming={confirmCrop.confirming}
      />

      <ConfirmModal
        open={confirmVariety.open}
        title="Xác nhận xóa giống cây"
        message={`Bạn có chắc chắn muốn xóa giống "${confirmVariety.name}"? Hành động này không thể hoàn tác.`}
        onClose={() => setConfirmVariety({ open: false, id: null, name: '', cropId: null })}
        onConfirm={handleDeleteVariety}
        confirming={confirmVariety.confirming}
      />
    </div>
  );
};

export default CropManagement;
