import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { notificationsApi } from '../../api/notificationsApi';
import Overview from './tabs/Overview';
import Farms from './tabs/Farms';
import Beds from './tabs/Beds';
import Requests from './tabs/Requests';
import Experiments from './tabs/Experiments';
import Notifications from './tabs/Notifications';
import MonitoringDashboard from '../../components/dashboard/MonitoringDashboard';
import ManagerKPIs from './tabs/ManagerKPIs';

const TAB_TITLES = {
  overview: 'Tổng Quan',
  farms: 'Quản Lý Nông Trại',
  beds: 'Khu Vực & Luống Trồng',
  requests: 'Duyệt Yêu Cầu Thí Nghiệm',
  experiments: 'Danh Sách Thí Nghiệm',
  notifications: 'Thông Báo',
  monitoring: 'Giám Sát Thời Gian Thực',
  kpis: 'KPIs & Hiệu Suất'
};

const MOBILE_LABELS = {
  overview: 'Tổng Quan',
  farms: 'Nông Trại',
  beds: 'Khu Vực & Luống',
  requests: 'Yêu Cầu TN',
  experiments: 'Thí Nghiệm',
  notifications: 'Thông Báo',
  monitoring: 'Giám Sát',
  kpis: 'KPIs'
};

const Header = ({ title, unreadCount, onNotificationsClick }) => (
  <header className="hidden lg:flex min-h-20 py-4 border-b border-outline-variant items-center justify-between px-10 bg-white/50 backdrop-blur-md sticky top-0 z-20 gap-4">
    <h2 className="font-hanken text-xl lg:text-2xl font-bold text-primary">{title}</h2>
    <div className="flex items-center gap-3">
      <button
        onClick={onNotificationsClick}
        className="relative p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
        title="Thông báo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant">
        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="Avatar" className="w-full h-full object-cover" />
      </div>
    </div>
  </header>
);

const MobileHeader = ({ activeTab }) => (
  <div className="lg:hidden flex items-center px-6 h-20 bg-white border-b border-outline-variant sticky top-0 z-[1000]">
    <h2 className="font-hanken text-lg font-bold text-primary tracking-tight">
      {MOBILE_LABELS[activeTab] || 'Quản Lý'}
    </h2>
  </div>
);

const useUnreadCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const c = await notificationsApi.getUnreadCount();
        if (!cancelled) setCount(c);
      } catch {
        if (!cancelled) setCount(0);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  return [count, setCount];
};

const FarmManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useUnreadCount();
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const tabs = [
    { id: 'overview', label: 'Tổng Quan' },
    { id: 'monitoring', label: 'Giám Sát' },
    { id: 'farms', label: 'Nông Trại' },
    { id: 'beds', label: 'Khu Vực & Luống' },
    { id: 'requests', label: 'Yêu Cầu TN' },
    { id: 'experiments', label: 'Thí Nghiệm' },
    { id: 'kpis', label: 'KPIs' },
    { id: 'notifications', label: 'Thông Báo', badge: unreadCount }
  ];

  const handleTabChange = (id) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };

  const tabProps = { activeTab, setActiveTab: handleTabChange, setUnreadCount };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <Overview setActiveTab={handleTabChange} setUnreadCount={setUnreadCount} />;
      case 'farms': return <Farms />;
      case 'beds': return <Beds />;
      case 'requests': return <Requests />;
      case 'experiments': return <Experiments />;
      case 'notifications': return <Notifications setUnreadCount={setUnreadCount} />;
      case 'monitoring': return <MonitoringDashboard scope="manager" />;
      case 'kpis': return <ManagerKPIs />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-inter fixed inset-0 z-[1000] bg-surface">
      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[1100] lg:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside className={`fixed inset-y-0 left-0 z-[1200] w-64 bg-surface-container-low border-r border-outline-variant flex flex-col px-4 py-8 shadow-sm transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-10 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-lg text-white shadow-lg transition-transform hover:scale-105">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M10 20c5.5 0 5.5-18 0-18" /><path d="M14 20c-5.5 0-5.5-18 0-18" /><path d="M2 13c3.5 0 3.5 7 7 7" /><path d="M22 13c-3.5 0-3.5 7-7 7" /></svg>
              </div>
              <div>
                <h1 className="font-hanken text-lg font-bold text-primary leading-tight">Smart Farm</h1>
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">QUẢN LÝ</p>
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
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${activeTab === tab.id ? 'bg-secondary-container text-primary font-bold' : 'text-on-surface-variant hover:bg-secondary-container/50 hover:text-on-secondary-container'}`}
              >
                <NavIcon id={tab.id} />
                <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-left">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-outline-variant">
            <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold transition-all text-left">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              <span className="text-[11px] font-bold uppercase tracking-wider">Đăng Xuất</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-surface overflow-y-auto flex flex-col relative">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden absolute top-5 left-4 z-[1001] p-2 bg-white rounded-lg shadow-sm border border-outline-variant text-on-surface-variant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
          </button>
          <Header
            title={TAB_TITLES[activeTab] || 'Quản Lý'}
            unreadCount={unreadCount}
            onNotificationsClick={() => handleTabChange('notifications')}
          />
          <MobileHeader activeTab={activeTab} />
          {renderTab()}
        </main>
      </div>

      <footer className="w-full px-6 lg:px-12 py-6 border-t border-outline-variant bg-surface-container-low shadow-lg z-[1300]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/20 flex items-center justify-center rounded text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M10 20c5.5 0 5.5-18 0-18" /><path d="M14 20c-5.5 0-5.5-18 0-18" /><path d="M2 13c3.5 0 3.5 7 7 7" /><path d="M22 13c-3.5 0-3.5 7-7 7" /></svg>
              </div>
              <span className="font-hanken font-bold text-primary text-sm tracking-tight">Smart Farm SEP490</span>
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium">© 2026 Intelligent Nursery Systems. Bản quyền đã được bảo hộ.</p>
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

const NavIcon = ({ id }) => {
  const props = { xmlns: 'http://www.w3.org/2000/svg', width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'shrink-0' };
  switch (id) {
    case 'overview':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'monitoring':
      return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'farms':
      return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'beds':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
    case 'requests':
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>;
    case 'experiments':
      return <svg {...props}><path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>;
    case 'kpis':
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case 'notifications':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    default:
      return null;
  }
};

export default FarmManagerDashboard;
