import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import SharedSidebar from '../components/SharedSidebar';

const PersonalTaskList = () => {
  const { showToast } = useToast();
  const [userRole] = useState(() => {
    const path = window.location.pathname;
    return path.includes('technician') ? 'Technician' : 'Student';
  });

  const [tasks, setTasks] = useState([
    {
      id: 'T001',
      title: 'Check IoT sensor battery levels',
      description: 'Inspect sensors in zones A-01 to A-05 and replace batteries if below 20%',
      priority: 'High',
      status: 'Pending',
      dueDate: '2026-06-20',
      zone: 'A-01 to A-05',
      assignedBy: 'Manager Tran Minh',
      createdAt: '2026-06-20T08:00:00'
    },
    {
      id: 'T002',
      title: 'Record plant morphology data - Block B',
      description: 'Measure plant height, leaf count, and observe pest/disease symptoms for tomato plants in Block B',
      priority: 'High',
      status: 'In Progress',
      dueDate: '2026-06-20',
      zone: 'B-01 to B-10',
      assignedBy: 'Manager Tran Minh',
      createdAt: '2026-06-20T08:30:00'
    },
    {
      id: 'T003',
      title: 'Irrigation system maintenance',
      description: 'Check drip irrigation lines and clear any blockages in zones C-01 to C-03',
      priority: 'Medium',
      status: 'Pending',
      dueDate: '2026-06-20',
      zone: 'C-01 to C-03',
      assignedBy: 'Manager Tran Minh',
      createdAt: '2026-06-19T14:00:00'
    },
    {
      id: 'T004',
      title: 'Weed removal - Rows 1-20',
      description: 'Manual weed removal from vegetable rows 1-20 in the main field',
      priority: 'Medium',
      status: 'Pending',
      dueDate: '2026-06-21',
      zone: 'Main Field',
      assignedBy: 'Manager Tran Minh',
      createdAt: '2026-06-19T15:00:00'
    },
    {
      id: 'T005',
      title: 'Fertilizer application - Zone D',
      description: 'Apply organic fertilizer according to schedule in Zone D. Consult spreadsheet for dosage.',
      priority: 'Low',
      status: 'Pending',
      dueDate: '2026-06-22',
      zone: 'D-01 to D-08',
      assignedBy: 'Manager Tran Minh',
      createdAt: '2026-06-19T16:00:00'
    },
    {
      id: 'T006',
      title: 'Study: IoT Sensor Calibration',
      description: 'Complete the online module on sensor calibration and data accuracy',
      priority: 'Medium',
      status: 'Pending',
      dueDate: '2026-06-25',
      zone: 'Online',
      assignedBy: 'Instructor Nguyen Lan',
      createdAt: '2026-06-20T09:00:00'
    }
  ]);

  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
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

  const updateTaskStatus = (taskId, newStatus) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));
    showToast(`Task updated to: ${newStatus}`, 'success');
  };

  const filteredTasks = tasks.filter(task => {
    const statusMatch = filterStatus === 'All' || task.status === filterStatus;
    const priorityMatch = filterPriority === 'All' || task.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    completed: tasks.filter(t => t.status === 'Completed').length
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700 border-red-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-blue-50 border-blue-200';
      case 'In Progress': return 'bg-orange-50 border-orange-200';
      case 'Completed': return 'bg-green-50 border-green-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-blue-200 text-blue-800';
      case 'In Progress': return 'bg-orange-200 text-orange-800';
      case 'Completed': return 'bg-green-200 text-green-800';
      default: return 'bg-slate-200 text-slate-800';
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar userRole={userRole} currentPage={currentPage} navigateTo={navigateTo} />

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Requirement T16</p>
              <h1 className="text-4xl font-bold text-slate-900 mt-2">Xem danh sách công việc cá nhân được giao</h1>
              <p className="text-slate-600 mt-2 max-w-3xl">View your personal assigned tasks for today. Stay informed about what you need to complete at the farm without needing to contact the manager.</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tasks</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{taskStats.total}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl shadow-md p-6 border border-blue-200">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Pending</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{taskStats.pending}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl shadow-md p-6 border border-orange-200">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">In Progress</p>
              <p className="text-3xl font-bold text-orange-900 mt-2">{taskStats.inProgress}</p>
            </div>
            <div className="bg-green-50 rounded-2xl shadow-md p-6 border border-green-200">
              <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Completed</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{taskStats.completed}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200 mb-8">
            <h2 className="font-bold text-slate-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                >
                  <option>All</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-2xl shadow-md border-l-4 p-6 transition hover:shadow-lg ${getStatusColor(task.status)} ${
                    task.priority === 'High' ? 'border-l-red-500' : task.priority === 'Medium' ? 'border-l-yellow-500' : 'border-l-green-500'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
                    <div className="lg:col-span-2">
                      <div className="flex items-start gap-3 mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{task.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-slate-500 font-semibold">Priority</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold">Status</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(task.status)}`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-slate-500 font-semibold">Due Date</p>
                          <p className="text-sm font-bold text-slate-900">{task.dueDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-semibold">Zone</p>
                          <p className="text-sm font-bold text-slate-900">{task.zone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-300/30 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold">Assigned by:</span> {task.assignedBy}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.status === 'Pending' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'In Progress')}
                          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                        >
                          Start Task
                        </button>
                      )}
                      {task.status === 'In Progress' && (
                        <>
                          <button
                            onClick={() => updateTaskStatus(task.id, 'Completed')}
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                          >
                            Mark Complete
                          </button>
                          <button
                            onClick={() => updateTaskStatus(task.id, 'Pending')}
                            className="px-4 py-2 bg-slate-400 text-white font-semibold rounded-lg hover:bg-slate-500 transition"
                          >
                            Back to Pending
                          </button>
                        </>
                      )}
                      {task.status === 'Completed' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'In Progress')}
                          className="px-4 py-2 bg-slate-400 text-white font-semibold rounded-lg hover:bg-slate-500 transition"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl shadow-md p-12 border border-slate-200 text-center">
                <p className="text-2xl text-slate-400 mb-4">📭</p>
                <p className="text-slate-600">No tasks match your filters</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PersonalTaskList;
