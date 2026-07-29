import React, { useEffect, useState } from 'react';
import { farmsApi, areasApi } from '../../../api/managerResourcesApi';
import { useToast } from '../../../context/ToastContext';
import {
  Card,
  SectionTitle,
  Modal,
  Input,
  Textarea,
  Select,
  PrimaryButton,
  OutlineButton,
  DangerButton,
  StatusPill,
  EmptyState
} from '../components/ui';
import { schemas } from '../components/validation';
import { useFormValidation } from '../components/useFormValidation';

const AREA_STATUSES = [
  { value: 1, label: 'Available' },
  { value: 2, label: 'InUse' },
  { value: 3, label: 'Maintenance' },
  { value: 4, label: 'Unavailable' }
];

const ENV_TYPES = ['Greenhouse', 'Outdoor', 'Indoor', 'Hydroponic'];

const initialFarmForm = {
  farmCode: '',
  farmName: '',
  location: '',
  description: ''
};

const initialAreaForm = {
  areaCode: '',
  areaName: '',
  environmentType: 'Greenhouse',
  totalArea: '',
  status: 1
};

const Farms = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [farmModalOpen, setFarmModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const farmFormik = useFormValidation(initialFarmForm, schemas.farm);

  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);

  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const areaFormik = useFormValidation(initialAreaForm, schemas.area);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const data = await farmsApi.getMyFarms();
      const list = Array.isArray(data) ? data : [];
      setFarms(list);
      setSelectedFarmId(prev => prev && list.some(f => f.id === prev) ? prev : (list[0]?.id || null));
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách nông trại', 'error');
      setFarms([]);
      setSelectedFarmId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFarms(); }, []);

  const fetchAreas = async (farmId) => {
    if (!farmId) { setAreas([]); return; }
    try {
      setAreasLoading(true);
      const data = await areasApi.getByFarm(farmId);
      setAreas(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách khu vực', 'error');
      setAreas([]);
    } finally {
      setAreasLoading(false);
    }
  };

  useEffect(() => { fetchAreas(selectedFarmId); }, [selectedFarmId]);

  const openCreateFarm = () => {
    setEditingFarm(null);
    farmFormik.reset(initialFarmForm);
    setFarmModalOpen(true);
  };

  const openEditFarm = (farm) => {
    setEditingFarm(farm);
    farmFormik.reset({
      farmCode: farm.farmCode || '',
      farmName: farm.farmName || '',
      location: farm.location || '',
      description: farm.description || ''
    });
    setFarmModalOpen(true);
  };

  const submitFarm = async (e) => {
    e.preventDefault();
    if (!farmFormik.validateAll()) {
      showToast('Vui lòng kiểm tra các trường có lỗi', 'warning');
      return;
    }
    try {
      if (editingFarm) {
        await farmsApi.update(editingFarm.id, farmFormik.values);
        showToast('Cập nhật nông trại thành công', 'success');
      } else {
        await farmsApi.create(farmFormik.values);
        showToast('Tạo nông trại thành công', 'success');
      }
      setFarmModalOpen(false);
      await fetchFarms();
    } catch (err) {
      showToast(err.message || 'Lỗi lưu nông trại', 'error');
    }
  };

  const deleteFarm = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nông trại này?')) return;
    try {
      await farmsApi.remove(id);
      showToast('Đã xóa nông trại', 'success');
      if (selectedFarmId === id) setSelectedFarmId(null);
      await fetchFarms();
    } catch (err) {
      showToast(err.message || 'Không thể xóa nông trại', 'error');
    }
  };

  const openCreateArea = () => {
    if (!selectedFarmId) {
      showToast('Vui lòng chọn nông trại trước', 'warning');
      return;
    }
    setEditingArea(null);
    areaFormik.reset(initialAreaForm);
    setAreaModalOpen(true);
  };

  const openEditArea = (area) => {
    setEditingArea(area);
    areaFormik.reset({
      areaCode: area.areaCode || '',
      areaName: area.areaName || '',
      environmentType: area.environmentType || 'Greenhouse',
      totalArea: area.totalArea ?? '',
      status: typeof area.status === 'number' ? area.status : 1
    });
    setAreaModalOpen(true);
  };

  const submitArea = async (e) => {
    e.preventDefault();
    if (!areaFormik.validateAll()) {
      showToast('Vui lòng kiểm tra các trường có lỗi', 'warning');
      return;
    }
    try {
      const payload = {
        ...areaFormik.values,
        farmId: selectedFarmId,
        totalArea: areaFormik.values.totalArea === '' ? null : Number(areaFormik.values.totalArea),
        status: Number(areaFormik.values.status)
      };
      if (editingArea) {
        await areasApi.update(editingArea.id, payload);
        showToast('Cập nhật khu vực thành công', 'success');
      } else {
        await areasApi.create(payload);
        showToast('Tạo khu vực thành công', 'success');
      }
      setAreaModalOpen(false);
      await fetchAreas(selectedFarmId);
    } catch (err) {
      showToast(err.message || 'Lỗi lưu khu vực', 'error');
    }
  };

  const deleteArea = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khu vực này?')) return;
    try {
      await areasApi.remove(id);
      showToast('Đã xóa khu vực', 'success');
      await fetchAreas(selectedFarmId);
    } catch (err) {
      showToast(err.message || 'Không thể xóa khu vực', 'error');
    }
  };

  const selectedFarm = farms.find(f => f.id === selectedFarmId);

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
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
              🌱
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-1">Quản Lý Nông Trại</div>
              <h2 className="font-hanken text-2xl lg:text-3xl font-bold leading-tight">Nông trại của bạn</h2>
              <p className="text-xs lg:text-sm text-white/80 mt-1">Chọn một nông trại để xem khu vực, luống trồng và thông tin chi tiết.</p>
            </div>
          </div>
        </div>

        <SectionTitle
          title="Danh Sách Nông Trại"
          description="Các nông trại bạn đang quản lý. Chọn một nông trại để xem và quản lý khu vực."
          action={
            <div className="flex flex-wrap items-center gap-3">
              {farms.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="farm-selector" className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Nông trại:
                  </label>
                  <select
                    id="farm-selector"
                    value={selectedFarmId || ''}
                    onChange={e => setSelectedFarmId(e.target.value || null)}
                    className="min-w-[200px] px-3 py-2 border border-outline-variant rounded-xl bg-white text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                  >
                    <option value="">— Chọn nông trại —</option>
                    {farms.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.farmName} ({f.farmCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <PrimaryButton onClick={openCreateFarm} icon={<PlusIcon />}>
                Thêm Nông Trại
              </PrimaryButton>
            </div>
          }
        />

        {loading ? (
          <Card className="p-10 text-center text-sm text-on-surface-variant">Đang tải...</Card>
        ) : farms.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-emerald-50 to-transparent p-10 lg:p-16 text-center">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/15 flex items-center justify-center text-5xl mb-6 shadow-inner">
                🌾
              </div>
              <h3 className="font-hanken text-xl lg:text-2xl font-bold text-on-surface mb-2">Bắt đầu hành trình nông trại của bạn</h3>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
                Tạo nông trại đầu tiên để quản lý khu vực, luống trồng và thí nghiệm một cách hiệu quả.
              </p>
              <PrimaryButton onClick={openCreateFarm} icon={<PlusIcon />}>
                Thêm Nông Trại Đầu Tiên
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
            {farms.map(farm => {
              const palette = getFarmPalette(farm);
              const isSelected = selectedFarmId === farm.id;
              return (
                <div
                  key={farm.id}
                  className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                    isSelected
                      ? 'ring-4 ring-primary/40 shadow-2xl -translate-y-1'
                      : 'border border-outline-variant shadow-sm'
                  }`}
                  onClick={() => setSelectedFarmId(farm.id)}
                >
                  {/* Cover with gradient + scene illustration */}
                  <div className={`relative h-40 bg-gradient-to-br ${palette.cover} overflow-hidden`}>
                    {/* Pattern background */}
                    <div className="absolute inset-0 opacity-25" style={{ backgroundImage: palette.pattern }} />
                    {/* Scene SVG (sun + hills + crops) */}
                    <FarmScene className="absolute inset-0 w-full h-full opacity-95" />
                    {/* Decorative blobs */}
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/15 blur-sm" />
                    <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/10 blur-md" />
                    {/* Farm emoji badge */}
                    <div className="absolute top-3 left-3 w-12 h-12 rounded-xl bg-white/25 backdrop-blur-md flex items-center justify-center text-2xl shadow-lg border border-white/30">
                      🌾
                    </div>
                    {/* Selected badge */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white text-primary text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 animate-fade-in">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Đang chọn
                      </div>
                    )}
                    {/* Farm code pill at bottom */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-md text-white text-[10px] font-mono font-bold uppercase tracking-wider border border-white/20">
                        {farm.farmCode}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        {farm.location ? `📍 ${farm.location}` : 'Đang hoạt động'}
                      </span>
                    </div>
                  </div>

                  {/* Wave divider */}
                  <div className={`relative h-2 -mt-2 bg-gradient-to-r ${palette.cover}`}>
                    <svg className="absolute -top-px left-0 w-full h-3 text-white" viewBox="0 0 1200 30" preserveAspectRatio="none">
                      <path d="M0,30 C300,0 900,0 1200,30 L1200,30 L0,30 Z" fill="currentColor" />
                    </svg>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h4 className="font-hanken font-bold text-lg text-on-surface leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {farm.farmName}
                      </h4>
                      <p className="text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed min-h-[2.5rem]">
                        {farm.description || <span className="italic text-on-surface-variant/70">Chưa có mô tả.</span>}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <InfoChip icon={<MapIcon />} label="Địa điểm" value={farm.location || '—'} />
                      <InfoChip icon={<UserIcon />} label="Quản lý" value={farm.managerName || '—'} />
                    </div>

                    {/* Actions */}
                    <div
                      className="pt-3 border-t border-outline-variant flex justify-between items-center"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setSelectedFarmId(farm.id)}
                        className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          isSelected ? 'text-emerald-600' : 'text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        {isSelected ? '✓ Đang xem' : 'Xem khu vực →'}
                      </button>
                      <div className="flex gap-3">
                        <button
                          onClick={() => openEditFarm(farm)}
                          className="text-primary font-bold text-[10px] uppercase tracking-wider hover:underline p-1"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteFarm(farm.id)}
                          className="text-rose-600 font-bold text-[10px] uppercase tracking-wider hover:underline p-1"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom accent stripe (matches cover color) */}
                  <div className={`h-1 bg-gradient-to-r ${palette.cover}`} />
                </div>
              );
            })}
          </div>
        )}

        {selectedFarm && (() => {
          const palette = getFarmPalette(selectedFarm);
          return (
          <div className="space-y-6 pt-6">
            {/* Selected farm banner */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${palette.cover} text-white p-5 lg:p-6 shadow-lg`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: palette.pattern }} />
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-xl" />
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <FarmScene className="w-full h-full" />
              </div>
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-white/25 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30">
                    🌾
                  </span>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Đang xem khu vực của</div>
                    <h3 className="font-hanken text-xl lg:text-2xl font-bold leading-tight">{selectedFarm.farmName}</h3>
                    <span className="text-[10px] font-mono text-white/80">{selectedFarm.farmCode}</span>
                  </div>
                </div>
                <PrimaryButton
                  onClick={openCreateArea}
                  icon={<PlusIcon />}
                  className="!bg-white !text-primary hover:!bg-white/90"
                >
                  Thêm Khu Vực
                </PrimaryButton>
              </div>
            </div>

            {areasLoading ? (
              <Card className="p-10 text-center text-sm text-on-surface-variant">Đang tải...</Card>
            ) : areas.length === 0 ? (
              <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/50 to-transparent p-8 lg:p-12 text-center">
                <div className="text-4xl mb-2">🌿</div>
                <p className="text-sm font-bold text-on-surface">Chưa có khu vực nào</p>
                <p className="text-xs text-on-surface-variant mt-1">Bắt đầu bằng cách thêm khu vực đầu tiên cho nông trại này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                {areas.map(area => <AreaCard key={area.id} area={area} onEdit={openEditArea} onDelete={deleteArea} />)}
              </div>
            )}
          </div>
          );
        })()}
      </div>

      <Modal
        open={farmModalOpen}
        onClose={() => setFarmModalOpen(false)}
        title={editingFarm ? 'Cập Nhật Nông Trại' : 'Thêm Nông Trại Mới'}
      >
        <form onSubmit={submitFarm} noValidate className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Input
            label="Mã Nông Trại"
            required
            placeholder="VD: FARM001"
            value={farmFormik.values.farmCode}
            onChange={e => farmFormik.handleChange('farmCode', e.target.value.toUpperCase())}
            onBlur={() => farmFormik.handleBlur('farmCode')}
            error={farmFormik.showError('farmCode')}
            hint="Chỉ chữ in hoa, số, gạch ngang hoặc gạch dưới"
            maxLength={50}
          />
          <Input
            label="Tên Nông Trại"
            required
            placeholder="VD: Trang trại Bắc Giang"
            value={farmFormik.values.farmName}
            onChange={e => farmFormik.handleChange('farmName', e.target.value)}
            onBlur={() => farmFormik.handleBlur('farmName')}
            error={farmFormik.showError('farmName')}
            maxLength={100}
          />
          <Input
            label="Địa Điểm"
            placeholder="VD: Bắc Giang"
            value={farmFormik.values.location}
            onChange={e => farmFormik.handleChange('location', e.target.value)}
            onBlur={() => farmFormik.handleBlur('location')}
            error={farmFormik.showError('location')}
            maxLength={200}
          />
          <div className="col-span-1 md:col-span-2">
            <Textarea
              label="Mô Tả"
              value={farmFormik.values.description}
              onChange={e => farmFormik.handleChange('description', e.target.value)}
              onBlur={() => farmFormik.handleBlur('description')}
              error={farmFormik.showError('description')}
              rows={3}
              maxLength={500}
              hint={`${(farmFormik.values.description || '').length}/500 ký tự`}
              className="!col-span-2"
            />
          </div>
          <div className="col-span-1 md:col-span-2 mt-2 flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <OutlineButton onClick={() => setFarmModalOpen(false)}>Hủy</OutlineButton>
            <PrimaryButton type="submit">{editingFarm ? 'Lưu Thay Đổi' : 'Tạo Nông Trại'}</PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        title={editingArea ? 'Cập Nhật Khu Vực' : 'Thêm Khu Vực Mới'}
      >
        <form onSubmit={submitArea} noValidate className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {!selectedFarmId && (
            <div className="col-span-1 md:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
              Vui lòng chọn nông trại trước khi tạo khu vực.
            </div>
          )}
          <Input
            label="Mã Khu Vực"
            required
            placeholder="VD: AREA001"
            value={areaFormik.values.areaCode}
            onChange={e => areaFormik.handleChange('areaCode', e.target.value.toUpperCase())}
            onBlur={() => areaFormik.handleBlur('areaCode')}
            error={areaFormik.showError('areaCode')}
            hint="Chỉ chữ in hoa, số, gạch ngang hoặc gạch dưới"
            maxLength={50}
          />
          <Input
            label="Tên Khu Vực"
            required
            placeholder="VD: Khu A1"
            value={areaFormik.values.areaName}
            onChange={e => areaFormik.handleChange('areaName', e.target.value)}
            onBlur={() => areaFormik.handleBlur('areaName')}
            error={areaFormik.showError('areaName')}
            maxLength={100}
          />
          <Select
            label="Loại Môi Trường"
            value={areaFormik.values.environmentType}
            onChange={e => areaFormik.handleChange('environmentType', e.target.value)}
          >
            {ENV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input
            label="Diện Tích (m²)"
            type="number"
            step="0.1"
            min="0"
            placeholder="VD: 500"
            value={areaFormik.values.totalArea}
            onChange={e => areaFormik.handleChange('totalArea', e.target.value)}
            onBlur={() => areaFormik.handleBlur('totalArea')}
            error={areaFormik.showError('totalArea')}
          />
          <div className="col-span-1 md:col-span-2">
            <Select
              label="Trạng Thái"
              value={areaFormik.values.status}
              onChange={e => areaFormik.handleChange('status', Number(e.target.value))}
            >
              {AREA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div className="col-span-1 md:col-span-2 mt-2 flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <OutlineButton onClick={() => setAreaModalOpen(false)}>Hủy</OutlineButton>
            <PrimaryButton type="submit" disabled={!selectedFarmId}>
              {editingArea ? 'Lưu Thay Đổi' : 'Tạo Khu Vực'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

// SVG scene: sun + hills + crops (pure SVG, no asset dependency)
const FarmScene = ({ className }) => (
  <svg className={className} viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    {/* Sun */}
    <circle cx="320" cy="42" r="22" fill="white" opacity="0.35" />
    <circle cx="320" cy="42" r="14" fill="white" opacity="0.55" />
    {/* Sun rays */}
    {[0, 45, 90, 135].map(angle => (
      <line key={angle} x1="320" y1="42" x2="320" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"
        transform={`rotate(${angle} 320 42)`} />
    ))}
    {/* Cloud */}
    <g opacity="0.5">
      <ellipse cx="80" cy="36" rx="22" ry="10" fill="white" />
      <ellipse cx="100" cy="30" rx="16" ry="9" fill="white" />
      <ellipse cx="60" cy="32" rx="12" ry="7" fill="white" />
    </g>
    {/* Back hill */}
    <path d="M0,160 L0,110 Q80,70 180,95 Q260,115 400,80 L400,160 Z" fill="white" opacity="0.18" />
    {/* Front hill */}
    <path d="M0,160 L0,130 Q120,100 220,120 Q320,140 400,115 L400,160 Z" fill="white" opacity="0.28" />
    {/* Field rows */}
    {[140, 150].map((y, i) => (
      <line key={i} x1="0" y1={y} x2="400" y2={y - 8} stroke="white" strokeWidth="1.2" opacity="0.35" />
    ))}
    {/* Crops / sprouts scattered */}
    {[
      [40, 132], [80, 134], [120, 136], [160, 138], [200, 140],
      [240, 138], [280, 136], [320, 134], [360, 132],
      [60, 146], [140, 148], [220, 146], [300, 144], [380, 142]
    ].map(([cx, cy], i) => (
      <g key={i} opacity="0.7">
        <path d={`M${cx},${cy} l-3,-6 M${cx},${cy} l0,-7 M${cx},${cy} l3,-6`} stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      </g>
    ))}
  </svg>
);

// =====================
// Area Card (thay thế table)
// =====================

const AREA_ENV_META = {
  Greenhouse: { icon: '🏡', label: 'Greenhouse', color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Outdoor: { icon: '☀️', label: 'Outdoor', color: 'amber', bg: 'bg-amber-100', text: 'text-amber-700' },
  Indoor: { icon: '🏠', label: 'Indoor', color: 'sky', bg: 'bg-sky-100', text: 'text-sky-700' },
  Hydroponic: { icon: '💧', label: 'Hydroponic', color: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700' }
};

const AREA_STATUS_META = {
  Available: { label: 'Sẵn sàng', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: '✓' },
  InUse: { label: 'Đang sử dụng', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', icon: '◉' },
  Maintenance: { label: 'Bảo trì', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', icon: '⚙' },
  Unavailable: { label: 'Không khả dụng', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', icon: '✕' }
};

const AreaCard = ({ area, onEdit, onDelete }) => {
  const envMeta = AREA_ENV_META[area.environmentType] || { icon: '🌿', label: area.environmentType || 'Khác', bg: 'bg-slate-100', text: 'text-slate-700' };
  const statusKey = typeof area.status === 'number'
    ? ({ 1: 'Available', 2: 'InUse', 3: 'Maintenance', 4: 'Unavailable' }[area.status] || 'Available')
    : (area.status || 'Available');
  const statusMeta = AREA_STATUS_META[statusKey] || AREA_STATUS_META.Available;

  return (
    <div className="group relative bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      {/* Top color stripe theo loại môi trường */}
      <div className={`h-1.5 ${envMeta.bg}`} />
      <div className="p-4 space-y-3">
        {/* Header: icon + code + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-11 h-11 rounded-xl ${envMeta.bg} ${envMeta.text} flex items-center justify-center text-xl shrink-0 shadow-inner`}>
              {envMeta.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
                {area.areaCode}
              </div>
              <div className="font-bold text-sm text-on-surface truncate">{area.areaName}</div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusMeta.bg} ${statusMeta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} animate-pulse`} />
            {statusMeta.label}
          </span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="px-2.5 py-2 rounded-lg bg-surface-container/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span>{envMeta.icon}</span> Loại
            </div>
            <div className="text-xs font-bold text-on-surface mt-0.5">{envMeta.label}</div>
          </div>
          <div className="px-2.5 py-2 rounded-lg bg-surface-container/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">📐 Diện tích</div>
            <div className="text-xs font-bold text-on-surface font-mono mt-0.5">
              {area.totalArea != null && area.totalArea !== '' ? `${area.totalArea} m²` : '—'}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="pt-3 border-t border-outline-variant flex justify-between items-center">
          <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider">
            {area.createdAt ? new Date(area.createdAt).toLocaleDateString('vi-VN') : ''}
          </span>
          <div className="flex gap-3">
            <button onClick={() => onEdit(area)}
              className="text-primary font-bold text-[10px] uppercase tracking-wider hover:underline p-1">
              Sửa
            </button>
            <button onClick={() => onDelete(area.id)}
              className="text-rose-600 font-bold text-[10px] uppercase tracking-wider hover:underline p-1">
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const InfoChip = ({ icon, label, value }) => (
  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-surface-container/40 min-w-0">
    <span className="text-on-surface-variant mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant leading-none">{label}</div>
      <div className="text-[11px] font-bold text-on-surface truncate">{value}</div>
    </div>
  </div>
);

// Deterministic farm cover palette + pattern based on id hash
const FARM_PALETTES = [
  {
    cover: 'from-emerald-500 via-emerald-600 to-teal-700',
    pattern: 'radial-gradient(circle at 25% 30%, white 0%, transparent 35%), radial-gradient(circle at 80% 70%, white 0%, transparent 30%)'
  },
  {
    cover: 'from-amber-500 via-orange-500 to-rose-600',
    pattern: 'radial-gradient(circle at 75% 25%, white 0%, transparent 40%), radial-gradient(circle at 20% 80%, white 0%, transparent 30%)'
  },
  {
    cover: 'from-sky-500 via-blue-600 to-indigo-700',
    pattern: 'radial-gradient(circle at 30% 70%, white 0%, transparent 35%), radial-gradient(circle at 85% 30%, white 0%, transparent 30%)'
  },
  {
    cover: 'from-lime-500 via-green-600 to-emerald-700',
    pattern: 'repeating-linear-gradient(45deg, white 0 1px, transparent 1px 14px), radial-gradient(circle at 50% 50%, white 0%, transparent 50%)'
  },
  {
    cover: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    pattern: 'radial-gradient(circle at 20% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, white 0%, transparent 35%)'
  },
  {
    cover: 'from-rose-500 via-pink-600 to-fuchsia-700',
    pattern: 'radial-gradient(circle at 70% 30%, white 0%, transparent 35%), radial-gradient(circle at 25% 75%, white 0%, transparent 40%)'
  }
];

const getFarmPalette = (farm) => {
  if (!farm?.id) return FARM_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < farm.id.length; i++) {
    hash = (hash * 31 + farm.id.charCodeAt(i)) | 0;
  }
  return FARM_PALETTES[Math.abs(hash) % FARM_PALETTES.length];
};

const getStatusLabel = (status) => {
  const map = { 1: 'Available', 2: 'InUse', 3: 'Maintenance', 4: 'Unavailable' };
  if (typeof status === 'number') return map[status] || 'Unknown';
  return status || 'Unknown';
};

export default Farms;
