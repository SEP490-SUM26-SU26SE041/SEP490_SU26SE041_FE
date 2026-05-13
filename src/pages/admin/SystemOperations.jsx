import React, { useState } from 'react';

// --- Sub-components (Replicating the original logic) ---

const GreenhouseCard = ({ title, sensors, controllers }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-[#486730] text-white';
      case 'degraded': return 'bg-[#7c5639] text-white';
      case 'offline': return 'bg-[#dc2626] text-white';
      default: return 'bg-[#74796c] text-white';
    }
  };

  const getPillBg = (status) => {
    switch (status) {
      case 'online': return 'bg-[#486730]/10 text-[#486730]';
      case 'degraded': return 'bg-[#7c5639]/10 text-[#7c5639]';
      case 'offline': return 'bg-[#dc2626]/10 text-[#dc2626]';
      default: return 'bg-[#74796c]/10 text-[#74796c]';
    }
  };

  return (
    <div className="p-5 border border-[#c4c8ba] rounded-xl bg-[#f3f4f3] hover:border-[#486730]/40 transition-colors group">
      <h4 className="font-hanken font-bold text-[#1a1c1c] mb-4 group-hover:text-[#486730] transition-colors">{title}</h4>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#74796c] font-medium">Sensors</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getPillBg(sensors.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(sensors.status)}`}></span>
            {sensors.status} ({sensors.count})
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#74796c] font-medium">Controllers</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getPillBg(controllers.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(controllers.status)}`}></span>
            {controllers.status} ({controllers.count})
          </span>
        </div>
      </div>
    </div>
  );
};

const StorageBar = ({ label, used, total, percentage, color, status }) => (
  <div>
    <div className="flex justify-between items-end mb-2">
      <span className="text-sm text-[#74796c] font-semibold">{label}</span>
      <span className="font-mono text-xs font-bold">{used} / {total}</span>
    </div>
    <div className="w-full bg-[#e2e2e2] rounded-full h-2.5 overflow-hidden">
      <div 
        className={`${color} h-full rounded-full transition-all duration-1000`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
    <p className={`text-[10px] font-bold mt-2 text-right uppercase tracking-wider ${percentage > 80 ? 'text-[#7c5639]' : 'text-[#74796c]'}`}>
      {percentage}% - {status}
    </p>
  </div>
);

const DeviceRow = ({ id, type, location, time, status, highlight }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-[#486730]';
      case 'warning': return 'bg-[#7c5639]';
      case 'error': return 'bg-[#dc2626]';
      default: return 'bg-[#74796c]';
    }
  };

  return (
    <tr className="border-b border-[#e2e2e2] hover:bg-surface transition-colors">
      <td className={`py-4 px-6 font-bold ${highlight ? 'text-[#dc2626]' : 'text-[#1a1c1c]'}`}>{id}</td>
      <td className="py-4 px-6 text-[#74796c]">{type}</td>
      <td className="py-4 px-6">{location}</td>
      <td className={`py-4 px-6 ${highlight ? 'text-[#dc2626]' : 'text-[#74796c]'}`}>{time}</td>
      <td className="py-4 px-6">
        <div className="flex justify-center">
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)} shadow-[0_0_8px_rgba(0,0,0,0.1)]`}></div>
        </div>
      </td>
    </tr>
  );
};

const LogItem = ({ icon: iconPath, title, time, type }) => {
  const getColors = () => {
    switch (type) {
      case 'error': return 'bg-[#dc2626]/5 border-[#dc2626]/20 text-[#dc2626]';
      case 'success': return 'bg-[#486730]/5 border-[#486730]/20 text-[#486730]';
      case 'warning': return 'bg-[#7c5639]/5 border-[#7c5639]/20 text-[#7c5639]';
      default: return 'bg-[#f3f4f3] border-[#74796c]/20 text-[#74796c]';
    }
  };

  return (
    <div className={`p-4 rounded-xl border ${getColors()} flex gap-4 items-start hover:shadow-md transition-shadow duration-200 cursor-default`}>
      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconPath}</svg>
      <div>
        <p className="text-sm font-bold text-[#1a1c1c] leading-tight">{title}</p>
        <p className="font-mono text-[10px] text-[#74796c] mt-1.5 opacity-80">{time}</p>
      </div>
    </div>
  );
};

// --- Main Page Component ---

const SystemOperations = () => {
  return (
    <div className="flex flex-col animate-fade-in w-full bg-[#f9f9f8]">
      {/* Header - Hidden on mobile, shown on desktop */}
      <header className="hidden lg:flex min-h-20 py-4 border-b border-outline-variant items-center justify-between px-10 bg-white/50 backdrop-blur-md sticky top-0 z-20 gap-4">
        <h2 className="font-hanken text-xl lg:text-2xl font-bold text-primary w-full lg:w-auto text-center lg:text-left">System Operations</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative group w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search data..." 
              className="pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full"
            />
          </div>
          <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-outline-variant pt-4 sm:pt-0 sm:pl-4 w-full sm:w-auto justify-center">
            <button className="p-2 hover:bg-surface-container transition-colors rounded-full text-on-surface-variant">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <button className="p-2 hover:bg-surface-container transition-colors rounded-full text-on-surface-variant">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        {/* Page Sub-Header - Action Buttons here */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 lg:gap-6">
          <div className="max-w-md">
            <h3 className="font-hanken text-lg lg:text-2xl font-bold text-on-surface">Operations & Monitoring</h3>
            <p className="text-[10px] lg:text-sm text-on-surface-variant mt-0.5 lg:mt-1">Real-time IoT and storage status.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#1a1c1c] border border-[#c4c8ba] rounded-xl hover:bg-[#e8e8e7] transition-all text-[9px] font-bold uppercase tracking-wider shadow-sm active:scale-95">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              Sync
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#1a1c1c] border border-[#c4c8ba] rounded-xl hover:bg-[#e8e8e7] transition-all text-[9px] font-bold uppercase tracking-wider shadow-sm active:scale-95">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Diagnostic
            </button>
            <button className="flex-[2] md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#486730] text-white rounded-xl hover:bg-opacity-90 transition-all text-[9px] font-bold uppercase tracking-wider shadow-md active:scale-95">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c.703 0 1.333-.34 1.732-.866a3.344 3.344 0 0 0 1.268.243c1.933 0 3.5-1.567 3.5-3.5 0-1.562-1.023-2.885-2.438-3.34A4.996 4.996 0 0 0 17 5a5 5 0 0 0-4.746 3.42A4 4 0 0 0 9 7.5a4 4 0 0 0-4 4c0 .354.046.697.132 1.023A3.335 3.335 0 0 0 2 15.5C2 17.433 3.567 19 5.5 19c.148 0 .292-.01.433-.028A3.344 3.344 0 0 0 7.2 19.866c.4.526 1.03.866 1.732.866 1.1 0 2-.853 2.147-1.944A4.966 4.966 0 0 0 13 20a5 5 0 0 0 4.5-1z"/></svg>
              Cloud
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* IoT Connectivity Dashboard */}
        <div className="lg:col-span-8 bg-white border border-[#c4c8ba] rounded-xl p-4 lg:p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-[#c4c8ba] pb-3">
            <h3 className="text-[9px] lg:text-[10px] uppercase tracking-[0.2em] font-bold text-[#74796c] flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="14" width="20" height="8" rx="2"/><rect x="2" y="2" width="20" height="8" rx="2"/><path d="M6 21v-2"/><path d="M18 21v-2"/><path d="M6 9V7"/><path d="M18 9V7"/></svg>
              IoT Connectivity Status
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <GreenhouseCard 
              title="Greenhouse A" 
              sensors={{ status: 'online', count: '12/12' }}
              controllers={{ status: 'online', count: '4/4' }}
            />
            <GreenhouseCard 
              title="Greenhouse B" 
              sensors={{ status: 'degraded', count: '9/10' }}
              controllers={{ status: 'online', count: '3/3' }}
            />
            <GreenhouseCard 
              title="Greenhouse C" 
              sensors={{ status: 'offline', count: '0/8' }}
              controllers={{ status: 'offline', count: '0/2' }}
            />
          </div>
        </div>

        {/* Cloud Storage Health */}
        <div className="lg:col-span-4 bg-white border border-[#c4c8ba] rounded-xl p-4 lg:p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6 border-b border-[#c4c8ba] pb-3">
            <h3 className="text-[9px] lg:text-[10px] uppercase tracking-[0.2em] font-bold text-[#74796c] flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c.703 0 1.333-.34 1.732-.866a3.344 3.344 0 0 0 1.268.243c1.933 0 3.5-1.567 3.5-3.5 0-1.562-1.023-2.885-2.438-3.34A4.996 4.996 0 0 0 17 5a5 5 0 0 0-4.746 3.42A4 4 0 0 0 9 7.5a4 4 0 0 0-4 4c0 .354.046.697.132 1.023A3.335 3.335 0 0 0 2 15.5C2 17.433 3.567 19 5.5 19c.148 0 .292-.01.433-.028A3.344 3.344 0 0 0 7.2 19.866c.4.526 1.03.866 1.732.866 1.1 0 2-.853 2.147-1.944A4.966 4.966 0 0 0 13 20a5 5 0 0 0 4.5-1z"/></svg>
              Cloud Infrastructure
            </h3>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-6 lg:gap-8">
            <StorageBar 
              label="Firebase Storage" 
              used="42 GB" 
              total="50 GB" 
              percentage={84} 
              color="bg-[#7c5639]" 
              status="Almost Full"
            />
            <StorageBar 
              label="Azure Data Lake" 
              used="1.2 TB" 
              total="5 TB" 
              percentage={24} 
              color="bg-[#486730]" 
              status="Healthy"
            />
          </div>
        </div>

        {/* Device Management Table */}
        <div className="lg:col-span-8 bg-white border border-[#c4c8ba] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 lg:p-6 border-b border-[#c4c8ba] bg-[#f3f4f3] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-[9px] lg:text-[10px] uppercase tracking-[0.2em] font-bold text-[#74796c] flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>
              Device Registry
            </h3>
            <div className="relative w-full sm:w-auto">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#74796c] w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Search ID..." 
                className="pl-10 pr-4 py-2 bg-white border border-[#c4c8ba] rounded-lg text-sm w-full sm:w-64 focus:ring-2 focus:ring-[#486730]/20 focus:border-[#486730] outline-none transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-[#c4c8ba] bg-[#f3f4f3]">
                  <th className="py-3 px-6 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-[#74796c]">Device ID</th>
                  <th className="py-3 px-6 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-[#74796c]">Type</th>
                  <th className="py-3 px-6 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-[#74796c]">Location</th>
                  <th className="py-3 px-6 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-[#74796c]">Last Ping</th>
                  <th className="py-3 px-6 text-[9px] lg:text-[10px] uppercase tracking-wider font-bold text-[#74796c] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs lg:text-sm">
                <DeviceRow id="SN-SM-014" type="Soil Moisture" location="Area A - Row 1" time="2 min ago" status="online" />
                <DeviceRow id="SN-TH-022" type="Temp/Humidity" location="Area A - Center" time="5 min ago" status="online" />
                <DeviceRow id="CT-IR-003" type="Irrigation Controller" location="Area B - Pump Station" time="15 min ago" status="warning" />
                <DeviceRow id="SN-SM-088" type="Soil Moisture" location="Area C - Row 5" time="14 hrs ago" status="error" highlight />
                <DeviceRow id="CT-IR-005" type="Irrigation Controller" location="Area C - Fertigation Station" time="14 hrs ago" status="error" highlight />
              </tbody>
            </table>
          </div>
        </div>

        {/* System Activity Log */}
        <div className="md:col-span-4 bg-white border border-[#c4c8ba] rounded-xl p-6 shadow-sm flex flex-col h-[480px]">
          <div className="flex justify-between items-center mb-6 border-b border-[#c4c8ba] pb-3">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#74796c] flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Infrastructure Log
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
            <LogItem 
              icon={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} 
              title="Node 04 (Area C) disconnect" 
              time="14:32 - 12/10/2023" 
              type="error" 
            />
            <LogItem 
              icon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>} 
              title="Azure Data Lake Backup successful" 
              time="02:00 - 12/10/2023" 
              type="success" 
            />
            <LogItem 
              icon={<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>} 
              title="High latency on Node 02 (Area B)" 
              time="18:15 - 11/10/2023" 
              type="warning" 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default SystemOperations;
