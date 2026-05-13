import React, { useState } from 'react';

const ResearcherDashboard = () => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-indigo-900 text-white flex flex-col fixed h-full z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight">Smart <span className="text-indigo-300">Farm</span></h1>
          <p className="text-[10px] text-indigo-300/60 mt-1 uppercase tracking-widest font-bold">Researcher Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-700 text-white shadow-lg shadow-indigo-950/20">🧪 Crop Analysis</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-300 hover:bg-indigo-800 hover:text-white">🌱 Growth Experiments</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-300 hover:bg-indigo-800 hover:text-white">📊 Optimization Reports</button>
        </nav>
        <div className="p-4 border-t border-indigo-800">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-300 hover:bg-rose-500/10">🚪 Logout</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-10 bg-[#f1f5f9]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900">Researcher Dashboard</h2>
          <p className="text-slate-500 mt-1">Data-driven agricultural insights.</p>
        </header>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[400px] border-dashed border-2 flex items-center justify-center text-slate-400">
           Analytics and Experimentation Workspace
        </div>
      </main>
    </div>
  );
};

export default ResearcherDashboard;
