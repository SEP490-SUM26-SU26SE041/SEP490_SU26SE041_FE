import React, { useState } from 'react';

const TechnicianDashboard = () => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-slate-800 text-white flex flex-col fixed h-full z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight">Smart <span className="text-blue-400">Farm</span></h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Technician Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white shadow-lg">🛠️ IoT Maintenance</button>
          <button onClick={() => navigateTo('/technician/task-list')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white">📋 My Tasks</button>
          <button onClick={() => navigateTo('/technician/care-completion')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white">✅ Care Completion</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white">📡 Sensor Calibration</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white">🚨 System Alerts</button>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10">🚪 Logout</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-10 bg-[#f8fafc]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900">Technician Dashboard</h2>
          <p className="text-slate-500 mt-1">Maintain and optimize hardware infrastructure.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-400 text-xs uppercase mb-2">Device Status</h4>
            <p className="text-2xl font-bold text-blue-600">94/96 Online</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-400 text-xs uppercase mb-2">Open Tickets</h4>
            <p className="text-2xl font-bold text-amber-600">3 Pending</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-400 text-xs uppercase mb-2">Last Sync</h4>
            <p className="text-2xl font-bold text-slate-900">2 mins ago</p>
          </div>
        </div>
        <div className="mt-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-64 border-dashed border-2 flex items-center justify-center text-slate-400 italic">
          Device management interface placeholder
        </div>
      </main>
    </div>
  );
};

export default TechnicianDashboard;
