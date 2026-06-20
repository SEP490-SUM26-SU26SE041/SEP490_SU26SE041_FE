import React, { useState, useEffect } from 'react';
import SharedSidebar from '../../components/SharedSidebar';

const StudentDashboard = () => {
  const [currentPage, setCurrentPage] = useState(window.location.pathname);

  useEffect(() => {
    const handleNavigate = () => {
      setCurrentPage(window.location.pathname);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar userRole="Student" currentPage={currentPage} navigateTo={navigateTo} />

      <main className="flex-1 ml-64 p-10 bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
