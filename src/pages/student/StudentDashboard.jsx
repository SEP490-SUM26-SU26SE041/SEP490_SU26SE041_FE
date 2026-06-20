import React, { useState } from 'react';

const StudentDashboard = () => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Smart <span className="text-amber-500">Farm</span></h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Student Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 font-bold">📖 Lessons</button>
          <button onClick={() => navigateTo('/student/task-list')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900">📋 My Tasks</button>
          <button onClick={() => navigateTo('/student/morphology-entry')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900">🌿 Morphology Entry</button>
          <button onClick={() => navigateTo('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900">🎮 Practice Simulation</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900">🏆 Learning Progress</button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50">🚪 Logout</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-10 bg-[#fafafa]">
        <header className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900">Student Dashboard</h2>
          <p className="text-slate-500 mt-1">Learn the future of sustainable farming.</p>
        </header>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[400px] border-dashed border-2 flex flex-col items-center justify-center text-slate-400">
           <span className="text-5xl mb-4">📚</span>
           <p>Choose a lesson to begin your journey.</p>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
