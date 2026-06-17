import React, { useState, useEffect } from 'react';
import { userApi } from '../../api/userApi';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', fullName: '', email: '', password: '', phone: '', profileDescription: '', role: 'Student', isActive: true
  });

  const fetchUsers = async () => {
    try {
      const data = await userApi.getUsers();
      setUsers(data);
    } catch (err) { console.error('Failed to fetch users:', err); }
  };

  const fetchRoles = async () => {
    try {
      const data = await userApi.getRoles();
      setRoles(data);
    } catch (err) { console.error('Failed to fetch roles:', err); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchRoles()]);
      setLoading(false);
    };
    init();
  }, []);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return 'bg-slate-800 text-white';
      case 'Manager': return 'bg-[#f8e8d8] text-[#7c5639]';
      case 'Researcher': return 'bg-primary-container text-on-primary-container';
      case 'Technician': return 'bg-secondary-container text-on-secondary-container';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getAvatarBg = (role) => {
    switch (role) {
      case 'Admin': return 'bg-primary text-white';
      case 'Manager': return 'bg-tertiary-container text-on-tertiary-container';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setIsEditing(true);
      setFormData({
        id: user.id, fullName: user.fullName, email: user.email, password: '', 
        phone: user.phone || '', profileDescription: user.profileDescription || '', 
        role: user.role, isActive: user.isActive
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '', fullName: '', email: '', password: '', phone: '', profileDescription: '', role: 'Student', isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await userApi.updateUser(formData.id, formData);
        alert('Cập nhật người dùng thành công');
        fetchUsers();
        setIsModalOpen(false);
      } else {
        await userApi.createUser(formData);
        alert('Thêm người dùng thành công');
        fetchUsers();
        setIsModalOpen(false);
      }
    } catch (err) {
      alert(err.message || 'Lỗi kết nối đến máy chủ');
    }
  };

  const handleToggleStatus = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn thay đổi trạng thái người dùng này?')) return;
    try {
      await userApi.toggleStatus(id);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    try {
      await userApi.deleteUser(id);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const STATS = [
    { label: 'Tổng số', value: users.length.toString(), color: 'text-primary' },
    { label: 'Đang hoạt động', value: users.filter(u => u.isActive).length.toString(), color: 'text-primary' },
    { label: 'Quản trị viên', value: users.filter(u => u.role === 'Admin').length.toString(), color: 'text-tertiary' },
    { label: 'Tình trạng', value: '100%', color: 'text-primary' },
  ];

  return (
    <div className="flex flex-col animate-fade-in w-full">
      {/* Header */}
      <header className="hidden lg:flex min-h-20 py-4 border-b border-outline-variant items-center justify-between px-10 bg-white/50 backdrop-blur-md sticky top-0 z-20 gap-4">
        <h2 className="font-hanken text-xl lg:text-2xl font-bold text-primary">Quản lý Người Dùng</h2>
        <div className="flex items-center gap-4">
          <div className="relative group w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input type="text" placeholder="Tìm kiếm người dùng..." className="pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full"/>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-white border border-outline-variant p-4 lg:p-6 rounded-xl flex flex-col gap-1 lg:gap-2 transition-transform hover:-translate-y-1 shadow-sm">
              <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{stat.label}</span>
              <span className={`font-hanken text-2xl lg:text-4xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end gap-4">
          <div>
            <h3 className="font-hanken text-lg lg:text-2xl font-bold text-on-surface">Tài khoản Hệ thống</h3>
            <p className="text-[10px] lg:text-sm text-on-surface-variant mt-1">Quản lý truy cập và phân quyền hệ thống.</p>
          </div>
          <button onClick={() => handleOpenModal()} className="bg-primary hover:bg-[#3d5728] text-white px-6 py-3.5 rounded-xl flex items-center gap-2 font-bold text-[10px] tracking-wider uppercase shadow-md transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Thêm Người Dùng
          </button>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant text-left">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Họ và Tên</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chức Vụ</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Ngày Tạo</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant">Đang tải dữ liệu...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant">Không tìm thấy người dùng nào.</td></tr>
                ) : (
                  users.map((user, idx) => (
                    <tr key={user.id} className="group hover:bg-surface-container/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarBg(user.role)}`}>
                            {getInitials(user.fullName)}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[#1a1c1c]">{user.fullName}</div>
                            <div className="text-xs text-on-surface-variant">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-primary' : 'bg-slate-300'}`} />
                          <span className="text-sm text-on-surface-variant">{user.isActive ? 'Hoạt động' : 'Bị Khóa'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px] text-on-surface-variant">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleOpenModal(user)} className="text-primary font-bold text-[10px] uppercase hover:underline p-1">Sửa</button>
                          <button onClick={() => handleToggleStatus(user.id)} className={`${user.isActive ? 'text-rose-500' : 'text-emerald-600'} font-bold text-[10px] uppercase hover:underline p-1`}>
                            {user.isActive ? 'Khóa' : 'Mở Khóa'}
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="text-red-600 font-bold text-[10px] uppercase hover:underline p-1">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-hanken font-bold text-lg text-primary">{isEditing ? 'Cập Nhật Người Dùng' : 'Thêm Người Dùng Mới'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Họ và Tên</label>
                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Email</label>
                <input required type="email" value={formData.email} disabled={isEditing} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-100" />
              </div>
              {!isEditing && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">Mật Khẩu</label>
                  <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Chức Vụ</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                  {roles.map(r => <option key={r.id} value={r.roleName}>{r.roleName}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded text-primary focus:ring-primary/20" />
                <label htmlFor="isActive" className="text-sm text-on-surface font-medium">Tài khoản Đang Hoạt Động</label>
              </div>
              
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 font-bold text-sm text-white bg-primary hover:bg-[#3d5728] rounded-lg shadow-sm">Lưu Thông Tin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
