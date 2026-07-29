import React, { useEffect, useState } from 'react';
import { farmsApi, areasApi, bedsApi } from '../../../api/managerResourcesApi';
import { useToast } from '../../../context/ToastContext';
import {
  Card,
  SectionTitle,
  Modal,
  Input,
  Textarea,
  PrimaryButton,
  OutlineButton,
  StatusPill,
  EmptyState
} from '../components/ui';
import { schemas } from '../components/validation';
import { useFormValidation } from '../components/useFormValidation';

const initialBedForm = {
  bedCode: '',
  soilDescription: '',
  length: '',
  width: ''
};

const Beds = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(false);

  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState(null);
  const bedFormik = useFormValidation(initialBedForm, schemas.bed);

  useEffect(() => {
    (async () => {
      try {
        const data = await farmsApi.getMyFarms();
        const list = Array.isArray(data) ? data : [];
        setFarms(list);
        if (list[0]) setSelectedFarmId(list[0].id);
      } catch (err) {
        showToast(err.message || 'Không thể tải nông trại', 'error');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedFarmId) { setAreas([]); setSelectedAreaId(''); return; }
    (async () => {
      try {
        const data = await areasApi.getByFarm(selectedFarmId);
        const list = Array.isArray(data) ? data : [];
        setAreas(list);
        setSelectedAreaId(list[0]?.id || '');
      } catch (err) {
        showToast(err.message || 'Không thể tải khu vực', 'error');
        setAreas([]);
      }
    })();
  }, [selectedFarmId]);

  const fetchBeds = async (areaId) => {
    if (!areaId) { setBeds([]); return; }
    try {
      setLoading(true);
      const data = await bedsApi.getByArea(areaId);
      setBeds(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải luống', 'error');
      setBeds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBeds(selectedAreaId); }, [selectedAreaId]);

  const openCreateBed = () => {
    if (!selectedAreaId) {
      showToast('Vui lòng chọn khu vực trước', 'warning');
      return;
    }
    setEditingBed(null);
    bedFormik.reset(initialBedForm);
    setBedModalOpen(true);
  };

  const openEditBed = (bed) => {
    setEditingBed(bed);
    bedFormik.reset({
      bedCode: bed.bedCode || '',
      soilDescription: bed.soilDescription || '',
      length: bed.length ?? '',
      width: bed.width ?? ''
    });
    setBedModalOpen(true);
  };

  const submitBed = async (e) => {
    e.preventDefault();
    if (!bedFormik.validateAll()) {
      showToast('Vui lòng kiểm tra các trường có lỗi', 'warning');
      return;
    }
    try {
      const payload = {
        ...bedFormik.values,
        areaId: selectedAreaId,
        length: bedFormik.values.length === '' ? null : Number(bedFormik.values.length),
        width: bedFormik.values.width === '' ? null : Number(bedFormik.values.width)
      };
      if (editingBed) {
        await bedsApi.update(editingBed.id, payload);
        showToast('Cập nhật luống thành công', 'success');
      } else {
        await bedsApi.create(payload);
        showToast('Tạo luống thành công', 'success');
      }
      setBedModalOpen(false);
      await fetchBeds(selectedAreaId);
    } catch (err) {
      showToast(err.message || 'Lỗi lưu luống', 'error');
    }
  };

  const deleteBed = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa luống này?')) return;
    try {
      await bedsApi.remove(id);
      showToast('Đã xóa luống', 'success');
      await fetchBeds(selectedAreaId);
    } catch (err) {
      showToast(err.message || 'Không thể xóa luống', 'error');
    }
  };

  return (
    <div className="flex flex-col animate-fade-in w-full relative">
      {/* Ambient page background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#5a7a3e] to-[#3d5728] text-white p-6 lg:p-8 shadow-lg">
          <div className="absolute inset-0 opacity-15" style={{
            backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 40%), radial-gradient(circle at 20% 80%, white 0%, transparent 35%)'
          }} />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
                🛏️
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-1">Quản Lý Vựa & Luống</div>
                <h2 className="font-hanken text-2xl lg:text-3xl font-bold leading-tight">Luống trồng</h2>
                <p className="text-xs lg:text-sm text-white/80 mt-1">Quản lý luống trồng theo từng khu vực trong nông trại</p>
              </div>
            </div>
            <PrimaryButton onClick={openCreateBed} icon={<PlusIcon />} className="!bg-white !text-primary hover:!bg-white/90">
              Thêm Luống Mới
            </PrimaryButton>
          </div>
        </div>

        {/* Breadcrumb-style filters */}
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Đường dẫn</span>
            <BreadcrumbStep icon={<FarmIcon />} label="Nông Trại" active={!!selectedFarmId} />
            <ChevronIcon />
            <BreadcrumbStep icon={<AreaIcon />} label="Khu Vực" active={!!selectedAreaId} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại</label>
              <select
                value={selectedFarmId}
                onChange={e => setSelectedFarmId(e.target.value)}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              >
                <option value="">-- Chọn nông trại --</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Khu Vực</label>
              <select
                value={selectedAreaId}
                onChange={e => setSelectedAreaId(e.target.value)}
                disabled={!areas.length}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- Chọn khu vực --</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.areaName} ({a.areaCode})</option>)}
              </select>
            </div>
          </div>
        </div>

        {!selectedFarmId ? (
          <Card className="p-12 text-center">
            <div className="text-5xl mb-3">🌾</div>
            <p className="text-sm font-bold text-on-surface">Chọn nông trại để bắt đầu</p>
            <p className="text-xs text-on-surface-variant mt-1">Sau đó chọn khu vực để xem danh sách luống.</p>
          </Card>
        ) : !selectedAreaId ? (
          <Card className="p-12 text-center">
            <div className="text-5xl mb-3">🌿</div>
            <p className="text-sm font-bold text-on-surface">Chọn khu vực</p>
            <p className="text-xs text-on-surface-variant mt-1">Vui lòng chọn khu vực trong nông trại đã chọn.</p>
          </Card>
        ) : loading ? (
          <Card className="p-12 text-center text-sm text-on-surface-variant">Đang tải...</Card>
        ) : beds.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/50 to-transparent p-10 lg:p-12 text-center">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <div className="text-5xl mb-3">🛏️</div>
              <h3 className="font-hanken text-lg font-bold text-on-surface mb-1">Chưa có luống nào</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-5">
                Bắt đầu bằng cách thêm luống trồng đầu tiên cho khu vực này.
              </p>
              <PrimaryButton onClick={openCreateBed} icon={<PlusIcon />}>Thêm Luống Đầu Tiên</PrimaryButton>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
              {beds.map(bed => (
                <BedCard key={bed.id} bed={bed} onEdit={openEditBed} onDelete={deleteBed} />
              ))}
            </div>
          </>
        )}
      </div>

      <Modal
        open={bedModalOpen}
        onClose={() => setBedModalOpen(false)}
        title={editingBed ? 'Cập Nhật Luống' : 'Thêm Luống Mới'}
      >
        <form onSubmit={submitBed} noValidate className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {!selectedAreaId && (
            <div className="col-span-1 md:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
              Vui lòng chọn nông trại → khu vực trước khi tạo luống.
            </div>
          )}
          <div className="col-span-1 md:col-span-2">
            <Input
              label="Mã Luống"
              required
              placeholder="VD: BED001"
              value={bedFormik.values.bedCode}
              onChange={e => bedFormik.handleChange('bedCode', e.target.value.toUpperCase())}
              onBlur={() => bedFormik.handleBlur('bedCode')}
              error={bedFormik.showError('bedCode')}
              hint="Chỉ chữ in hoa, số, gạch ngang hoặc gạch dưới"
              maxLength={50}
            />
          </div>
          <div className="col-span-1 md:col-span-2">
            <Textarea
              label="Mô Tả Đất"
              value={bedFormik.values.soilDescription}
              onChange={e => bedFormik.handleChange('soilDescription', e.target.value)}
              onBlur={() => bedFormik.handleBlur('soilDescription')}
              error={bedFormik.showError('soilDescription')}
              rows={2}
              maxLength={500}
              hint={`${(bedFormik.values.soilDescription || '').length}/500 ký tự`}
            />
          </div>
          <Input
            label="Chiều Dài (m)"
            type="number"
            step="0.1"
            min="0"
            placeholder="VD: 10"
            value={bedFormik.values.length}
            onChange={e => bedFormik.handleChange('length', e.target.value)}
            onBlur={() => bedFormik.handleBlur('length')}
            error={bedFormik.showError('length')}
          />
          <Input
            label="Chiều Rộng (m)"
            type="number"
            step="0.1"
            min="0"
            placeholder="VD: 2"
            value={bedFormik.values.width}
            onChange={e => bedFormik.handleChange('width', e.target.value)}
            onBlur={() => bedFormik.handleBlur('width')}
            error={bedFormik.showError('width')}
          />
          <div className="col-span-1 md:col-span-2 mt-2 flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <OutlineButton onClick={() => setBedModalOpen(false)}>Hủy</OutlineButton>
            <PrimaryButton type="submit" disabled={!selectedAreaId}>{editingBed ? 'Lưu Thay Đổi' : 'Tạo Luống'}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const BreadcrumbStep = ({ icon, label, active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
    active
      ? 'bg-primary/15 text-primary border border-primary/30'
      : 'bg-surface-container/60 text-on-surface-variant border border-outline-variant'
  }`}>
    <span className="text-xs">{icon}</span>
    {label}
  </span>
);

const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const FarmIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);

const AreaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
);

const SoilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 22a8 8 0 0 1 8-8 8 8 0 0 1 8 8"/><path d="M2 22h20"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/></svg>
);

// SVG minh họa luống: hình chữ nhật phối cảnh + cây xanh
const BedIllustration = ({ length, width }) => {
  const area = (Number(length) || 0) * (Number(width) || 0);
  return (
    <div className="relative h-20 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-100 overflow-hidden">
      {/* Soil rows pattern */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'repeating-linear-gradient(90deg, #d97706 0 1px, transparent 1px 14px)'
      }} />
      {/* Perspective bed rectangle */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="bedSoil" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a16207" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#854d0e" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Bed body */}
        <path d="M40,55 L160,55 L150,70 L50,70 Z" fill="url(#bedSoil)" />
        {/* Top face */}
        <path d="M40,55 L160,55 L155,30 L45,30 Z" fill="#d97706" opacity="0.55" />
        {/* Crop sprouts on top */}
        {[60, 80, 100, 120, 140].map((cx, i) => (
          <g key={i} opacity="0.85">
            <path d={`M${cx},32 l-3,-6 M${cx},32 l0,-7 M${cx},32 l3,-6`} stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
        ))}
        {/* Sun */}
        <circle cx="170" cy="20" r="6" fill="#fbbf24" opacity="0.6" />
        {/* Sky subtle */}
        <rect x="0" y="0" width="200" height="28" fill="#fef3c7" opacity="0.4" />
      </svg>
      {area > 0 && (
        <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono font-bold">
          {area.toFixed(1)} m²
        </div>
      )}
    </div>
  );
};

const BedCard = ({ bed, onEdit, onDelete }) => {
  const len = Number(bed.length) || 0;
  const wid = Number(bed.width) || 0;
  const area = len * wid;
  const hasDims = len > 0 && wid > 0;

  return (
    <div className="group relative bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      {/* Illustration */}
      <BedIllustration length={bed.length} width={bed.width} />

      <div className="p-4 space-y-3">
        {/* Header: code + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 text-amber-800 flex items-center justify-center text-lg shrink-0 shadow-inner">
              🛏️
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
                {bed.bedCode}
              </div>
              <div className="font-hanken font-bold text-base text-on-surface truncate leading-tight">Luống trồng</div>
            </div>
          </div>
        </div>

        {/* Soil description */}
        {bed.soilDescription ? (
          <div className="p-2.5 rounded-lg bg-surface-container/40 border border-outline-variant">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1 mb-1">
              <SoilIcon /> Mô tả đất
            </div>
            <p className="text-xs text-on-surface line-clamp-2 leading-relaxed">{bed.soilDescription}</p>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-surface-container/30 border border-dashed border-outline-variant">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70 flex items-center gap-1 mb-1">
              <SoilIcon /> Mô tả đất
            </div>
            <p className="text-[11px] text-on-surface-variant/70 italic">Chưa có mô tả.</p>
          </div>
        )}

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-2">
          <div className="px-2.5 py-2 rounded-lg bg-surface-container/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">📏 Dài</div>
            <div className="text-xs font-bold text-on-surface font-mono mt-0.5">{bed.length != null ? `${len} m` : '—'}</div>
          </div>
          <div className="px-2.5 py-2 rounded-lg bg-surface-container/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">📐 Rộng</div>
            <div className="text-xs font-bold text-on-surface font-mono mt-0.5">{bed.width != null ? `${wid} m` : '—'}</div>
          </div>
          <div className={`px-2.5 py-2 rounded-lg ${hasDims ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container/40'}`}>
            <div className={`text-[9px] font-bold uppercase tracking-wider ${hasDims ? 'text-primary' : 'text-on-surface-variant'}`}>🟦 Diện tích</div>
            <div className={`text-xs font-bold font-mono mt-0.5 ${hasDims ? 'text-primary' : 'text-on-surface'}`}>{hasDims ? `${area.toFixed(1)} m²` : '—'}</div>
          </div>
        </div>

        {/* Action bar */}
        <div className="pt-3 border-t border-outline-variant flex justify-between items-center">
          <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider">
            {bed.createdAt ? new Date(bed.createdAt).toLocaleDateString('vi-VN') : ''}
          </span>
          <div className="flex gap-3">
            <button onClick={() => onEdit(bed)}
              className="text-primary font-bold text-[10px] uppercase tracking-wider hover:underline p-1">
              Sửa
            </button>
            <button onClick={() => onDelete(bed.id)}
              className="text-rose-600 font-bold text-[10px] uppercase tracking-wider hover:underline p-1">
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

export default Beds;
