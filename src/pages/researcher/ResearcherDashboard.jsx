import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import ResearcherOverview from './tabs/ResearcherOverview';
import ResearcherExperiments from './tabs/ResearcherExperiments';
import ResearcherRequests from './tabs/ResearcherRequests';
import ResearcherTemplates from './tabs/ResearcherTemplates';
import ResearcherTasks from './tabs/ResearcherTasks';
import ResearcherKPIs from './tabs/ResearcherKPIs';
import ResearcherComparison from './tabs/ResearcherComparison';
import ResearcherReports from './tabs/ResearcherReports';
import MonitoringDashboard from '../../components/dashboard/MonitoringDashboard';
import NotificationBell from '../../components/notifications/NotificationBell';

const TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: '📊' },
  { id: 'monitoring', label: 'Giám Sát', icon: '📡' },
  { id: 'experiments', label: 'Thí Nghiệm', icon: '🧪' },
  { id: 'requests', label: 'Yêu Cầu', icon: '📨' },
  { id: 'templates', label: 'Quy Trình', icon: '📋' },
  { id: 'tasks', label: 'Tác Vụ', icon: '📌' },
  { id: 'kpis', label: 'KPIs & Nhân Sự', icon: '📈' },
  { id: 'comparison', label: 'So Sánh PP', icon: '⚖️' },
  { id: 'reports', label: 'Xuất Báo Cáo', icon: '📤' },
];

const ResearcherDashboard = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [experimentPrefill, setExperimentPrefill] = useState(null);
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleConvertToExperiment = (request) => {
    setExperimentPrefill(request);
    setActiveTab('experiments');
  };

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] font-sans text-slate-900 fixed inset-0 z-[1000]">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-950 text-white flex flex-col fixed h-full z-50 shadow-2xl">
        <div className="px-6 py-7 border-b border-indigo-800/50 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Vườn <span className="text-emerald-600">Ươm</span></h1>
            <p className="text-[9px] text-emerald-600/60 mt-1 uppercase tracking-widest font-bold">Nhà Nghiên Cứu</p>
            {user?.fullName && (
              <p className="mt-2 text-xs text-indigo-300/70 font-medium truncate">{user.fullName}</p>
            )}
          </div>
          <NotificationBell variant="dark" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-950/30'
                  : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-indigo-800/50 space-y-1">
          <button
            onClick={() => navigateTo('/login')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-300 hover:bg-rose-500/10 hover:text-rose-300 text-sm font-medium transition-all"
          >
            <span className="text-base">🚪</span> Đăng Xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="px-8 lg:px-12 py-8">
          {/* Page header */}
          <div className="mb-8">
            <h2 className="font-hanken text-2xl lg:text-3xl font-bold text-slate-900">
              {TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'overview' && 'Tổng quan thí nghiệm của bạn'}
              {activeTab === 'monitoring' && 'Giám sát thời gian thực các chỉ số môi trường và sức khỏe nông trại'}
              {activeTab === 'experiments' && 'Danh sách và quản lý thí nghiệm'}
              {activeTab === 'requests' && 'Gửi và theo dõi yêu cầu thí nghiệm'}
              {activeTab === 'templates' && 'Quản lý quy trình canh tác mẫu'}
              {activeTab === 'tasks' && 'Quản lý tác vụ thí nghiệm'}
              {activeTab === 'kpis' && 'Theo dõi KPI tăng trưởng & hiệu suất nhân sự'}
              {activeTab === 'comparison' && 'Phân tích, so sánh hiệu quả giữa các phương pháp nuôi trồng'}
              {activeTab === 'reports' && 'Xuất báo cáo tổng kết thực nghiệm'}
            </p>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && <ResearcherOverview />}
          {activeTab === 'monitoring' && <MonitoringDashboard scope="researcher" />}
          {activeTab === 'experiments' && <ResearcherExperiments prefillData={experimentPrefill} onPrefillConsumed={() => setExperimentPrefill(null)} />}
          {activeTab === 'requests' && <ResearcherRequests onConvertToExperiment={handleConvertToExperiment} />}
          {activeTab === 'templates' && <ResearcherTemplates />}
          {activeTab === 'tasks' && <ResearcherTasks />}
          {activeTab === 'kpis' && <ResearcherKPIs />}
          {activeTab === 'comparison' && <ResearcherComparison />}
          {activeTab === 'reports' && <ResearcherReports />}
        </div>
      </main>
    </div>
  );
};

export default ResearcherDashboard;
