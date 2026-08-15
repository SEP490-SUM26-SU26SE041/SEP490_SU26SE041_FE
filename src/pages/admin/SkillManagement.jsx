import React, { useEffect, useMemo, useState } from 'react';
import { skillsApi, userSkillsApi } from '../../api/skillsApi';
import { userApi } from '../../api/userApi';
import { useToast } from '../../context/ToastContext';
import Pagination from '../../components/ui/Pagination';
import { required, minLength, maxLength, validateForm, isValid } from '../../utils/validation';

const skillSchema = {
  skillName: (v) => required('Tên skill là bắt buộc')(v) || minLength(2, 'Tối thiểu 2 ký tự')(v) || maxLength(100)(v),
  description: maxLength(500)
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PROFICIENCY_LEVELS = [1, 2, 3, 4, 5];

const PROFICIENCY_LABEL = (n) => {
  if (n >= 5) return { label: 'Chuyên gia', cls: 'bg-emerald-100 text-emerald-700' };
  if (n >= 4) return { label: 'Thành thạo', cls: 'bg-blue-100 text-blue-700' };
  if (n >= 3) return { label: 'Khá',       cls: 'bg-indigo-100 text-indigo-700' };
  if (n >= 2) return { label: 'Cơ bản',    cls: 'bg-amber-100 text-amber-700' };
  return                  { label: 'Mới',      cls: 'bg-slate-100 text-slate-700' };
};

// ── Skill Modal (Create / Edit) ────────────────────────────────────────────────

const SkillModal = ({ open, initial, onClose, onSubmit, saving }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setName(initial?.skillName || '');
      setDescription(initial?.description || '');
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = async () => {
    const values = { skillName: name, description };
    const errs = validateForm(values, skillSchema);
    if (!isValid(errs)) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await onSubmit({ skillName: name.trim(), description: description.trim() || null });
    } catch (err) {
      setErrors({ _global: err.message || 'Lỗi' });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h3 className="font-bold text-lg text-on-surface">
            {initial ? 'Sửa Skill' : 'Tạo Skill Mới'}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Tên Skill <span className="text-rose-500">*</span>
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (errors.skillName) setErrors({ ...errors, skillName: null }); }}
              placeholder="VD: Tưới nước, Bón phân, Quan sát sâu bệnh"
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 ${errors.skillName ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500' : 'border-outline-variant focus:ring-primary/10 focus:border-primary'}`}
            />
            {errors.skillName && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.skillName}</p>}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Mô Tả
            </label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); if (errors.description) setErrors({ ...errors, description: null }); }}
              placeholder="Mô tả ngắn về kỹ năng"
              rows={3}
              disabled={saving}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-4 resize-none ${errors.description ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500' : 'border-outline-variant focus:ring-primary/10 focus:border-primary'}`}
            />
            {errors.description && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.description}</p>}
          </div>
          {errors._global && <p className="text-xs text-rose-600 font-semibold">{errors._global}</p>}
        </div>
        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40">
            Hủy
          </button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Đang lưu...' : initial ? 'Cập Nhật' : 'Tạo Mới'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Assign UserSkill Modal ─────────────────────────────────────────────────────

const AssignUserSkillModal = ({ open, skill, onClose, onSubmit, saving, existingUserIds }) => {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState(5);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingUsers(true);
    userApi.getUsers()
      .then(data => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        // Lọc user chưa có skill này (tránh gán trùng)
        const filtered = list.filter(u => !existingUserIds?.includes(u.id));
        setUsers(filtered);
        if (filtered.length > 0) setUserId(filtered[0].id);
      })
      .catch(() => { if (!cancelled) setUsers([]); })
      .finally(() => { if (!cancelled) setLoadingUsers(false); });
    return () => { cancelled = true; };
  }, [open, existingUserIds]);

  if (!open) return null;

  const submit = async () => {
    if (!userId) { setError('Vui lòng chọn user'); return; }
    if (!skill?.id) return;
    setError('');
    try {
      await onSubmit({
        userId,
        skillId: skill.id,
        proficiencyLevel,
        description: description.trim() || null
      });
    } catch (err) {
      setError(err.message || 'Lỗi');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-on-surface">Gán Skill cho User</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Skill: <span className="font-bold text-primary">{skill?.skillName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              User <span className="text-rose-500">*</span>
            </label>
            {loadingUsers ? (
              <p className="text-xs text-on-surface-variant">Đang tải...</p>
            ) : users.length === 0 ? (
              <p className="text-xs text-rose-600">Tất cả user đã được gán skill này.</p>
            ) : (
              <select value={userId} onChange={e => setUserId(e.target.value)} disabled={saving}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.email} ({u.role})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Proficiency Level: <span className="text-primary text-base">{proficiencyLevel}</span>/5
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${PROFICIENCY_LABEL(proficiencyLevel).cls}`}>
                {PROFICIENCY_LABEL(proficiencyLevel).label}
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={proficiencyLevel}
              onChange={e => setProficiencyLevel(Number(e.target.value))}
              disabled={saving}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-on-surface-variant mt-1 px-0.5">
              <span>1 - Mới</span><span>3 - Khá</span><span>5 - Chuyên gia</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Ghi Chú
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="VD: Đã hoàn thành khóa đào tạo nội bộ"
              rows={2}
              disabled={saving}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
        </div>
        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40">
            Hủy
          </button>
          <button onClick={submit} disabled={saving || !userId}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Đang gán...' : 'Gán Skill'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Edit UserSkill Modal ──────────────────────────────────────────────────────

const EditUserSkillModal = ({ open, userSkill, onClose, onSubmit, saving }) => {
  const [proficiencyLevel, setProficiencyLevel] = useState(5);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && userSkill) {
      setProficiencyLevel(userSkill.proficiencyLevel || 5);
      setDescription(userSkill.description || '');
      setError('');
    }
  }, [open, userSkill]);

  if (!open) return null;

  const submit = async () => {
    setError('');
    try {
      await onSubmit({
        proficiencyLevel,
        description: description.trim() || null
      });
    } catch (err) {
      setError(err.message || 'Lỗi');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-on-surface">Sửa UserSkill</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              <span className="font-semibold">{userSkill?.userName}</span>
              {' · '}
              <span className="font-bold text-primary">{userSkill?.skillName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
              Proficiency Level: <span className="text-primary text-base">{proficiencyLevel}</span>/5
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${PROFICIENCY_LABEL(proficiencyLevel).cls}`}>
                {PROFICIENCY_LABEL(proficiencyLevel).label}
              </span>
            </label>
            <input type="range" min="1" max="5" value={proficiencyLevel}
              onChange={e => setProficiencyLevel(Number(e.target.value))} disabled={saving}
              className="w-full" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Ghi Chú</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} disabled={saving}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary resize-none" />
          </div>
          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
        </div>
        <div className="px-6 py-3 border-t border-outline-variant flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40">
            Hủy
          </button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Cập Nhật'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Confirm dialog ────────────────────────────────────────────────────────────

const ConfirmDialog = ({ open, title, message, onCancel, onConfirm, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-lg text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-2">{message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container/40">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const SkillManagement = () => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('skills');

  // ── Skills state
  const [skills, setSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [skillSearch, setSkillSearch] = useState('');
  const [editingSkill, setEditingSkill] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [deletingSkill, setDeletingSkill] = useState(null);
  const [confirmDel, setConfirmDel] = useState({ open: false, type: null, id: null, extra: null });
  const [skillPage, setSkillPage] = useState(1);
  const [skillPageSize, setSkillPageSize] = useState(10);

  // ── UserSkills state
  const [userSkills, setUserSkills] = useState([]);
  const [loadingUserSkills, setLoadingUserSkills] = useState(true);
  const [usSearch, setUsSearch] = useState('');
  const [usSkillFilter, setUsSkillFilter] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningSkill, setAssigningSkill] = useState(null);
  const [savingAssign, setSavingAssign] = useState(false);
  const [editingUserSkill, setEditingUserSkill] = useState(null);
  const [showEditUsModal, setShowEditUsModal] = useState(false);
  const [savingEditUs, setSavingEditUs] = useState(false);
  const [usPage, setUsPage] = useState(1);
  const [usPageSize, setUsPageSize] = useState(15);

  // ── Fetchers
  const fetchSkills = async () => {
    try {
      setLoadingSkills(true);
      const data = await skillsApi.getAll();
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Lỗi tải danh sách skill', 'error');
      setSkills([]);
    } finally { setLoadingSkills(false); }
  };

  const fetchUserSkills = async () => {
    try {
      setLoadingUserSkills(true);
      const data = await userSkillsApi.getAll();
      setUserSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Lỗi tải user-skills', 'error');
      setUserSkills([]);
    } finally { setLoadingUserSkills(false); }
  };

  useEffect(() => { fetchSkills(); fetchUserSkills(); }, []);

  // ── Skills CRUD
  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(s =>
      (s.skillName || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }, [skills, skillSearch]);

  const handleCreateSkill = () => {
    setEditingSkill(null);
    setShowSkillModal(true);
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill);
    setShowSkillModal(true);
  };

  const handleSubmitSkill = async (payload) => {
    setSavingSkill(true);
    try {
      if (editingSkill) {
        await skillsApi.update(editingSkill.id, payload);
        showToast('Đã cập nhật skill', 'success');
      } else {
        await skillsApi.create(payload);
        showToast('Đã tạo skill mới', 'success');
      }
      setShowSkillModal(false);
      setEditingSkill(null);
      await fetchSkills();
    } finally { setSavingSkill(false); }
  };

  const handleDeleteSkill = (skill) => {
    setConfirmDel({
      open: true,
      type: 'skill',
      id: skill.id,
      extra: { name: skill.skillName, totalUsers: skill.totalUsers, totalTasks: skill.totalTasks }
    });
  };

  const confirmDelete = async () => {
    const { type, id } = confirmDel;
    try {
      if (type === 'skill') {
        await skillsApi.remove(id);
        showToast('Đã xóa skill', 'success');
        await fetchSkills();
      } else if (type === 'userskill') {
        const us = confirmDel.extra;
        await userSkillsApi.remove(us.userId, us.skillId);
        showToast('Đã xóa user-skill', 'success');
        await fetchUserSkills();
        await fetchSkills();
      }
      setConfirmDel({ open: false, type: null, id: null, extra: null });
    } catch (err) {
      showToast(err.message || 'Lỗi xóa', 'error');
    }
  };

  // ── UserSkills
  const filteredUserSkills = useMemo(() => {
    const q = usSearch.trim().toLowerCase();
    return userSkills.filter(us => {
      if (usSkillFilter && us.skillId !== usSkillFilter) return false;
      if (!q) return true;
      return (us.userName || '').toLowerCase().includes(q) ||
             (us.skillName || '').toLowerCase().includes(q) ||
             (us.userEmail || '').toLowerCase().includes(q);
    });
  }, [userSkills, usSearch, usSkillFilter]);

  // Lấy danh sách userId đã có 1 skill (để tránh gán trùng)
  const usersWithSkill = (skillId) => userSkills.filter(us => us.skillId === skillId).map(us => us.userId);

  const handleOpenAssign = (skill) => {
    setAssigningSkill(skill);
    setShowAssignModal(true);
  };

  const handleAssignUserSkill = async (payload) => {
    setSavingAssign(true);
    try {
      await userSkillsApi.assign(payload);
      showToast('Đã gán skill cho user', 'success');
      setShowAssignModal(false);
      setAssigningSkill(null);
      await fetchUserSkills();
      await fetchSkills();
    } finally { setSavingAssign(false); }
  };

  const handleEditUserSkill = (us) => {
    setEditingUserSkill(us);
    setShowEditUsModal(true);
  };

  const handleUpdateUserSkill = async (payload) => {
    if (!editingUserSkill) return;
    setSavingEditUs(true);
    try {
      await userSkillsApi.update(editingUserSkill.userId, editingUserSkill.skillId, payload);
      showToast('Đã cập nhật user-skill', 'success');
      setShowEditUsModal(false);
      setEditingUserSkill(null);
      await fetchUserSkills();
    } finally { setSavingEditUs(false); }
  };

  const handleRemoveUserSkill = (us) => {
    setConfirmDel({
      open: true,
      type: 'userskill',
      id: null,
      extra: { userId: us.userId, skillId: us.skillId, label: `${us.userName} · ${us.skillName}` }
    });
  };

  return (
    <div className="animate-fade-in w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h3 className="font-hanken text-2xl font-bold text-on-surface">Quản Lý Kỹ Năng</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            CRUD Skill (loại kỹ năng) + gán Skill cho User (Technician/Student) kèm mức độ thành thạo (1-10).
          </p>
        </div>
        <div className="flex gap-2">
          {activeSubTab === 'skills' && (
            <button onClick={handleCreateSkill}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tạo Skill Mới
            </button>
          )}
          {activeSubTab === 'userskills' && (
            <button onClick={() => {
              if (skills.length === 0) { showToast('Hãy tạo skill trước', 'warning'); setActiveSubTab('skills'); return; }
              handleOpenAssign(skills[0]);
            }} disabled={skills.length === 0}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Gán Skill cho User
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-outline-variant bg-white/50 backdrop-blur-sm sticky top-20 z-10 overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
        <div className="flex gap-8">
          {[
            { id: 'skills', label: 'DANH SÁCH SKILL' },
            { id: 'userskills', label: 'GÁN SKILL CHO USER' }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveSubTab(t.id)}
              className={`pb-4 px-1 text-[10px] lg:text-xs font-bold tracking-[0.05em] transition-all whitespace-nowrap relative ${
                activeSubTab === t.id ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
              }`}>
              {t.label}
              {activeSubTab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-tab 1: SKILLS ───────────────────────────────────────────── */}
      {activeSubTab === 'skills' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input value={skillSearch} onChange={e => setSkillSearch(e.target.value)}
                placeholder="Tìm skill theo tên hoặc mô tả..."
                className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary" />
            </div>
            <span className="text-[10px] text-on-surface-variant font-bold">
              Tổng: <span className="text-primary">{filteredSkills.length}</span> skill
            </span>
          </div>

          <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tên Skill</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Mô Tả</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Users</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Tasks</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loadingSkills ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
                ) : filteredSkills.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                    {skillSearch ? 'Không tìm thấy skill nào.' : 'Chưa có skill nào. Bấm "Tạo Skill Mới" để bắt đầu.'}
                  </td></tr>
                ) : filteredSkills.slice((skillPage - 1) * skillPageSize, skillPage * skillPageSize).map(s => (
                  <tr key={s.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-3 font-bold text-sm text-on-surface">{s.skillName}</td>
                    <td className="px-6 py-3 text-xs text-on-surface-variant italic">
                      {s.description || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {s.totalUsers ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                        {s.totalTasks ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenAssign(s)} title="Gán cho user"
                          className="px-2 py-1 text-[10px] font-bold text-primary border border-primary/40 rounded-md hover:bg-primary/10 uppercase">
                          + User
                        </button>
                        <button onClick={() => handleEditSkill(s)} title="Sửa"
                          className="px-2 py-1 text-[10px] font-bold text-on-surface-variant border border-outline-variant rounded-md hover:bg-surface-container uppercase">
                          Sửa
                        </button>
                        <button onClick={() => handleDeleteSkill(s)} title="Xóa"
                          className="px-2 py-1 text-[10px] font-bold text-rose-600 border border-rose-200 rounded-md hover:bg-rose-50 uppercase">
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={skillPage}
            pageSize={skillPageSize}
            total={filteredSkills.length}
            onPageChange={setSkillPage}
            onPageSizeChange={setSkillPageSize}
            className="px-4 border-t border-outline-variant"
          />
        </div>
      )}

      {/* ── Sub-tab 2: USER-SKILLS ──────────────────────────────────────── */}
      {activeSubTab === 'userskills' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input value={usSearch} onChange={e => setUsSearch(e.target.value)}
                placeholder="Tìm theo tên user, email, hoặc skill..."
                className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary" />
            </div>
            <select value={usSkillFilter} onChange={e => setUsSkillFilter(e.target.value)}
              className="px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm">
              <option value="">-- Tất cả skill --</option>
              {skills.map(s => <option key={s.id} value={s.id}>{s.skillName}</option>)}
            </select>
            <span className="text-[10px] text-on-surface-variant font-bold">
              Tổng: <span className="text-primary">{filteredUserSkills.length}</span> lượt gán
            </span>
          </div>

          <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">User</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Skill</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Level</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Ghi Chú</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loadingUserSkills ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
                ) : filteredUserSkills.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-on-surface-variant">
                    {usSearch || usSkillFilter ? 'Không tìm thấy lượt gán nào.' : 'Chưa có lượt gán skill nào.'}
                  </td></tr>
                ) : filteredUserSkills.slice((usPage - 1) * usPageSize, usPage * usPageSize).map((us, i) => {
                  const pl = PROFICIENCY_LABEL(us.proficiencyLevel);
                  return (
                    <tr key={`${us.userId}-${us.skillId}-${i}`} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="font-bold text-sm text-on-surface">{us.userName || '—'}</div>
                        <div className="text-[10px] text-on-surface-variant">{us.userEmail}</div>
                        <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {us.roleName}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-sm text-on-surface">{us.skillName}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${pl.cls}`}>
                          {us.proficiencyLevel}/5 · {pl.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant italic max-w-xs truncate">
                        {us.description || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditUserSkill(us)} title="Sửa"
                            className="px-2 py-1 text-[10px] font-bold text-on-surface-variant border border-outline-variant rounded-md hover:bg-surface-container uppercase">
                            Sửa
                          </button>
                          <button onClick={() => handleRemoveUserSkill(us)} title="Xóa"
                            className="px-2 py-1 text-[10px] font-bold text-rose-600 border border-rose-200 rounded-md hover:bg-rose-50 uppercase">
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={usPage}
            pageSize={usPageSize}
            total={filteredUserSkills.length}
            onPageChange={setUsPage}
            onPageSizeChange={setUsPageSize}
            className="px-4 border-t border-outline-variant"
          />
        </div>
      )}

      {/* Modals */}
      <SkillModal
        open={showSkillModal}
        initial={editingSkill}
        onClose={() => { setShowSkillModal(false); setEditingSkill(null); }}
        onSubmit={handleSubmitSkill}
        saving={savingSkill}
      />

      <AssignUserSkillModal
        open={showAssignModal}
        skill={assigningSkill}
        existingUserIds={assigningSkill ? usersWithSkill(assigningSkill.id) : []}
        onClose={() => { setShowAssignModal(false); setAssigningSkill(null); }}
        onSubmit={handleAssignUserSkill}
        saving={savingAssign}
      />

      <EditUserSkillModal
        open={showEditUsModal}
        userSkill={editingUserSkill}
        onClose={() => { setShowEditUsModal(false); setEditingUserSkill(null); }}
        onSubmit={handleUpdateUserSkill}
        saving={savingEditUs}
      />

      <ConfirmDialog
        open={confirmDel.open}
        title="Xác nhận xóa"
        message={
          confirmDel.type === 'skill'
            ? `Xóa skill "${confirmDel.extra?.name}"? Hành động này sẽ thất bại nếu đang được tham chiếu bởi UserSkills hoặc TaskSkillRequirements (${confirmDel.extra?.totalUsers} users, ${confirmDel.extra?.totalTasks} tasks).`
            : `Xóa gán skill "${confirmDel.extra?.label}"?`
        }
        onCancel={() => setConfirmDel({ open: false, type: null, id: null, extra: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default SkillManagement;