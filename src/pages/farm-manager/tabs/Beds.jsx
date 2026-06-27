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
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        <SectionTitle
          title="Luống Trồng"
          description="Quản lý luống trồng theo từng khu vực trong nông trại"
          action={
            <PrimaryButton onClick={openCreateBed} icon={<PlusIcon />}>
              Thêm Luống Mới
            </PrimaryButton>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Nông Trại" value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)}>
            <option value="">-- Chọn nông trại --</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
          </Select>
          <Select label="Khu Vực" value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)} disabled={!areas.length}>
            <option value="">-- Chọn khu vực --</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.areaName} ({a.areaCode})</option>)}
          </Select>
        </div>

        {selectedAreaId ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mã Luống</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mô tả đất</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Dài (m)</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Rộng (m)</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loading ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
                  ) : beds.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Chưa có luống nào trong khu vực này.</td></tr>
                  ) : (
                    beds.map(bed => (
                      <tr key={bed.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-[13px] text-primary font-bold">{bed.bedCode}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant max-w-xs truncate" title={bed.soilDescription}>{bed.soilDescription || '—'}</td>
                        <td className="px-6 py-4 text-sm font-mono">{bed.length ?? '—'}</td>
                        <td className="px-6 py-4 text-sm font-mono">{bed.width ?? '—'}</td>
                        <td className="px-6 py-4"><StatusPill status={bed.allocationStatus} /></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEditBed(bed)} className="text-primary font-bold text-[10px] uppercase hover:underline p-1">Sửa</button>
                            <button onClick={() => deleteBed(bed.id)} className="text-rose-600 font-bold text-[10px] uppercase hover:underline p-1">Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState message="Chọn nông trại và khu vực để xem danh sách lô." />
          </Card>
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

const Select = ({ label, children, ...rest }) => (
  <div>
    {label && <label className="block text-xs font-bold text-on-surface-variant mb-1">{label}</label>}
    <select
      {...rest}
      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white text-on-surface transition-colors disabled:bg-gray-100"
    >
      {children}
    </select>
  </div>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);

export default Beds;
