import React, { useState } from 'react';
import UserManagement from './UserManagement';
import SystemOperations from './SystemOperations';
import SystemLogs from './SystemLogs';
import SkillManagement from './SkillManagement';
import CropManagement from './CropManagement';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

      const STATS = [
    { label: 'Tổng Người Dùng', value: '142', color: 'text-primary' },
    { label: 'Đang Hoạt Động', value: '18', color: 'text-primary' },
    { label: 'Công Việc Chờ', value: '5', color: 'text-tertiary' },
    { label: 'Tình Trạng Hệ Thống', value: '99%', color: 'text-primary' },
  ];

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-inter fixed inset-0 z-[1000] bg-surface">
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[1100] lg:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed inset-y-0 left-0 z-[1200] w-64 bg-surface-container-low border-r border-outline-variant flex flex-col px-4 py-8 shadow-sm transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <div className="flex items-center justify-between mb-10 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg text-white shadow-lg transition-transform hover:scale-105">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M10 20c5.5 0 5.5-18 0-18" /><path d="M14 20c-5.5 0-5.5-18 0-18" /><path d="M2 13c3.5 0 3.5 7 7 7" /><path d="M22 13c-3.5 0-3.5 7-7 7" /></svg>
              </div>
              <div>
                <h1 className="font-hanken text-lg font-bold text-primary leading-tight">Vườn Ươm Thực Nghiệm Thông Minh</h1>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">QUẢN TRỊ</p>
              </div>
            </div>
            <button
              className="lg:hidden p-2 hover:bg-surface-container rounded-lg text-on-surface-variant"
              onClick={() => setIsSidebarOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            <button onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === 'users' ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Quản lý Người Dùng</span>
            </button>
            <button onClick={() => { setActiveTab('skills'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === 'skills' ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.4 4.6 2.4 7.4L12 16.8 6 21.4l2.4-7.4L2 9.4h7.6z" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Quản lý Kỹ Năng</span>
            </button>
            <button onClick={() => { setActiveTab('crops'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === 'crops' ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M10 20c5.5 0 5.5-18 0-18" /><path d="M14 20c-5.5 0-5.5-18 0-18" /><path d="M2 13c3.5 0 3.5 7 7 7" /><path d="M22 13c-3.5 0-3.5 7-7 7" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Quản Lý Giống Cây Trồng</span>
            </button>
            <button onClick={() => { setActiveTab('ops'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === 'ops' ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Vận hành</span>
            </button>
            <button onClick={() => { setActiveTab('logs'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === 'logs' ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Nhật Ký Hệ Thống</span>
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-outline-variant">
            <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-all text-left">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Đăng Xuất</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-surface overflow-y-auto flex flex-col relative">
          {/* Unified Mobile Header */}
          <div className="lg:hidden flex items-center justify-between px-6 h-20 bg-white border-b border-outline-variant sticky top-0 z-[1000]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
              </button>
              <h2 className="font-hanken text-lg font-bold text-primary tracking-tight capitalize">
                {activeTab === 'users' ? 'Quản lý Người Dùng' : activeTab === 'skills' ? 'Quản lý Kỹ Năng' : activeTab === 'crops' ? 'Quản Lý Cây Trồng' : activeTab === 'logs' ? 'Nhật Ký Hệ Thống' : 'Vận hành'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'skills' && <SkillManagement />}
          {activeTab === 'crops' && <CropManagement />}
          {activeTab === 'ops' && <SystemOperations />}
          {activeTab === 'logs' && <SystemLogs />}
        </main>
      </div>

      {/* Professional Full-Width Footer */}
      <footer className="w-full px-6 lg:px-12 py-6 border-t border-outline-variant bg-surface-container-low shadow-lg z-[1300]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/20 flex items-center justify-center rounded text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M10 20c5.5 0 5.5-18 0-18" /><path d="M14 20c-5.5 0-5.5-18 0-18" /><path d="M2 13c3.5 0 3.5 7 7 7" /><path d="M22 13c-3.5 0-3.5 7-7 7" /></svg>
              </div>
              <span className="font-hanken font-bold text-primary text-sm tracking-tight">Vườn Ươm Thực Nghiệm Thông Minh SEP490</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium">© 2026 Vườn Ươm Thực Nghiệm Thông Minh. Bản quyền đã được bảo hộ.</p>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center md:items-end gap-1">
              <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Phiên bản</span>
              <span className="text-[11px] font-mono font-bold text-primary">v1.2.4-stable</span>
            </div>
            <div className="h-8 w-px bg-outline-variant hidden md:block"></div>
            <div className="flex gap-4">
              <button className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-wider">Hỗ Trợ</button>
              <button className="text-[10px] font-bold text-on-surface-variant hover:text-primary transition-colors uppercase tracking-wider">Chính sách Bảo mật</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminDashboard;
