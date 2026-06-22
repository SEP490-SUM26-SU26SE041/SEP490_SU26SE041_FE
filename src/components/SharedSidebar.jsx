import React from 'react';

const SharedSidebar = ({ userRole, currentPage, navigateTo }) => {
  const getTaskInfo = () => {
    switch (currentPage) {
      case '/student/task-list':
      case '/technician/task-list':
        return { label: 'T16 - Task 4', title: 'Personal Task List', subtitle: "Today's assignments" };
      case '/student/morphology-entry':
        return { label: 'T19 - Task 5', title: 'Morphology Entry', subtitle: 'Plant data collection' };
      case '/student/care-completion':
      case '/technician/care-completion':
        return { label: 'T18 - Task 6', title: 'Care Completion', subtitle: 'Mark care actions as done' };
      case '/technician/emergency-report':
        return { label: 'T5 - Task 5', title: 'Emergency Report', subtitle: 'Report urgent issues' };
      default:
        return { label: 'Dashboard', title: 'Home', subtitle: 'Your ' + (userRole === 'Technician' ? 'work' : 'learning') + ' hub' };
    }
  };

  const taskInfo = getTaskInfo();
  const isDashboard = currentPage === '/student' || currentPage === '/technician';
  const isTaskList = currentPage === '/student/task-list' || currentPage === '/technician/task-list';
  const isMorphology = currentPage === '/student/morphology-entry';
  const isCareCompletion = currentPage === '/student/care-completion' || currentPage === '/technician/care-completion';
  const isEmergencyReport = currentPage === '/technician/emergency-report';

  const getBackLabel = () => {
    return userRole === 'Technician' ? 'Dashboard' : 'Dashboard';
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 overflow-y-auto">
      <div className="p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Smart <span className="text-blue-600">{userRole === 'Technician' ? 'Tech' : 'Farm'}</span></h1>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">{userRole.toUpperCase()} PORTAL</p>
      </div>

      <div className="px-4 py-6 border-b border-slate-100">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">{taskInfo.label}</p>
          <p className="text-lg font-bold text-blue-900 mt-1">{taskInfo.title}</p>
          <p className="text-xs text-blue-700 mt-2">{taskInfo.subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 py-4">
        {!isDashboard && (
          <button
            onClick={() => navigateTo(userRole === 'Technician' ? '/technician' : '/student')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            ← Back
          </button>
        )}

        {userRole === 'Student' && (
          <>
            {isDashboard ? (
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">📖 Lessons</button>
            ) : (
              <button
                onClick={() => navigateTo('/student')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                📖 Lessons
              </button>
            )}
          </>
        )}

        {isTaskList ? (
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">📋 Task List</button>
        ) : (
          <button
            onClick={() => navigateTo(userRole === 'Technician' ? '/technician/task-list' : '/student/task-list')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            📋 Task List
          </button>
        )}

        {userRole === 'Student' && (
          <>
            {isMorphology ? (
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">🌿 Morphology Entry</button>
            ) : (
              <button
                onClick={() => navigateTo('/student/morphology-entry')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                🌿 Morphology Entry
              </button>
            )}
          </>
        )}

        {isCareCompletion ? (
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">✅ Care Completion</button>
        ) : (
          <button
            onClick={() => navigateTo(userRole === 'Technician' ? '/technician/care-completion' : '/student/care-completion')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            ✅ Care Completion
          </button>
        )}

        {userRole === 'Technician' && (
          <>
            {isEmergencyReport ? (
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold border border-red-200">🚨 Emergency Report</button>
            ) : (
              <button
                onClick={() => navigateTo('/technician/emergency-report')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
              >
                🚨 Emergency Report
              </button>
            )}
          </>
        )}

        {/* {userRole === 'Student' && !isDashboard && (
          <>
            <button
              onClick={() => navigateTo('/')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              🎮 Practice Simulation
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">
              🏆 Learning Progress
            </button>
          </>
        )} */}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition">🚪 Logout</button>
      </div>
    </aside>
  );
};

export default SharedSidebar;
