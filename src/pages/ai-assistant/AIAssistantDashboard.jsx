import React, { useState } from 'react';

const AIAssistantDashboard = () => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-[#020617] font-sans text-slate-300 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col fixed h-full z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Smart <span className="text-cyan-400">Farm</span></h1>
          <p className="text-[10px] text-cyan-400/60 mt-1 uppercase tracking-widest font-bold">AI Neural Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]">🧠 Neural Status</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-cyan-300 transition-all">🤖 Auto-Control Logs</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-cyan-300 transition-all">📊 Training Metrics</button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400">🚪 Deactivate Session</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-10 bg-[#020617]">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">AI Core Dashboard</h2>
            <p className="text-slate-500 mt-1">Autonomous intelligence monitoring & control.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-cyan-400 uppercase">Core Online</span>
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 h-64 flex items-center justify-center text-slate-600 border-dashed border-2">
              Neural Network Topology
           </div>
           <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 h-64 flex items-center justify-center text-slate-600 border-dashed border-2">
              Real-time Decision Streams
           </div>
        </div>
      </main>
    </div>
  );
};

export default AIAssistantDashboard;
