import React, { useState } from 'react';

const FarmManagerDashboard = () => {
  const [activeTab, setActiveTab] = useState('nursery');

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50">
        <div className="p-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-slate-900">Smart <span className="text-emerald-600">Farm</span></h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Manager Portal</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => setActiveTab('nursery')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'nursery' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>🌱 Nursery</button>
          <button onClick={() => setActiveTab('tasks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'tasks' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>📋 Tasks</button>
          <button onClick={() => setActiveTab('progress')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'progress' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>📈 Progress</button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 font-medium">🚪 Logout</button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-10 overflow-y-auto bg-[#f1f5f9]">
        {activeTab === 'nursery' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Active Batches', value: '12', sub: 'In production', icon: '🌱' },
                { label: 'Total Plants', value: '2,450', sub: 'Healthy', icon: '📈' },
                { label: 'Capacity', value: '78%', sub: 'Zone A-F', icon: '🏠' },
                { label: 'Alerts', value: '0', sub: 'All stable', icon: '✅' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <span className="text-2xl mb-2 block">{stat.icon}</span>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Core Flow 1: Nursery Batch Initialization */}
              <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold mb-6">Initialize New Batch</h3>
                <form className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Plant Species</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500">
                      <option>Organic Lettuce</option>
                      <option>Cherry Tomato</option>
                      <option>Bell Pepper</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantity</label>
                      <input type="number" placeholder="200" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                        <option>Greenhouse A</option>
                        <option>Greenhouse B</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Planting Date</label>
                    <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
                  </div>
                  <button className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2">Start Batch</button>
                </form>
              </div>

              {/* Batch Life-cycle Tracking */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-lg">Active Lifecycle Tracking</h3>
                </div>
                <div className="p-6 space-y-6">
                  {[
                    { id: 'BATCH-001', plant: 'Organic Lettuce', qty: 500, loc: 'Zone A', progress: 65, status: 'Growing' },
                    { id: 'BATCH-002', plant: 'Cherry Tomato', qty: 300, loc: 'Zone C', progress: 90, status: 'Ready' },
                  ].map((batch, i) => (
                    <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400">{batch.id}</span>
                          <h4 className="font-bold text-slate-900">{batch.plant}</h4>
                          <p className="text-xs text-slate-500">{batch.qty} units • {batch.loc}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${batch.status === 'Ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{batch.status}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${batch.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Core Flow 6: Task Assignment */}
              <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold mb-6">Assign Task</h3>
                <form className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Care Activity</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                      <option>Watering Schedule</option>
                      <option>Nutrient Application</option>
                      <option>Disease Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assign To</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none">
                      <optgroup label="Technicians">
                        <option>Tech Alice</option>
                        <option>Tech Bob</option>
                      </optgroup>
                      <optgroup label="Students">
                        <option>Student John</option>
                        <option>Student Mary</option>
                      </optgroup>
                    </select>
                  </div>
                  <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all">Assign Task</button>
                </form>
              </div>

              {/* Monitor Progress (Completed/Pending) */}
              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Task Status Monitor</h3>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">8 Pending</span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">14 Completed</span>
                  </div>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Task / Activity</th>
                      <th className="px-6 py-4">Assigned To</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { task: 'Nutrient Check Zone B', who: 'Tech Alice', status: 'Pending', time: '14:00' },
                      { task: 'Watering Lettuce B-01', who: 'Student John', status: 'Completed', time: '09:30' },
                      { task: 'Pest Inspection', who: 'Tech Bob', status: 'Pending', time: '16:30' },
                    ].map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{item.task}</td>
                        <td className="px-6 py-4 text-slate-500 font-medium">{item.who}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 font-bold">{item.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">📊</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Analytical Growth Monitor</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm">Visualize production metrics, efficiency logs, and resource consumption across all greenhouses.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Yield Efficiency</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">+14.2%</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Resource Savings</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">2.4k Liters</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Task Speed</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">98.5%</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FarmManagerDashboard;
