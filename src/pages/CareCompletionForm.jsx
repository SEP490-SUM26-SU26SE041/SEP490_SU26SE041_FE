import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import SharedSidebar from '../components/SharedSidebar';

const CareCompletionForm = () => {
  const { showToast } = useToast();
  const [userRole] = useState(() => {
    const path = window.location.pathname;
    return path.includes('technician') ? 'Technician' : 'Student';
  });

  const [formData, setFormData] = useState({
    taskId: '',
    taskDate: new Date().toISOString().split('T')[0],
    zoneArea: '',
    careActions: {
      watering: false,
      fertilizing: false,
      pruning: false,
      pestControl: false,
      weeding: false,
      inspection: false
    },
    completionNotes: '',
    performedBy: '',
    supervisor: '',
    completionTime: ''
  });

  const [completions, setCompletions] = useState([]);
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('careActions.')) {
      const actionName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        careActions: {
          ...prev.careActions,
          [actionName]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.taskId.trim()) {
      showToast('Please enter Task ID', 'error');
      return;
    }

    if (!formData.zoneArea.trim()) {
      showToast('Please enter Zone/Area', 'error');
      return;
    }

    const selectedActions = Object.entries(formData.careActions)
      .filter(([_, selected]) => selected)
      .map(([action, _]) => action);

    if (selectedActions.length === 0) {
      showToast('Please select at least one care action', 'error');
      return;
    }

    if (!formData.performedBy.trim()) {
      showToast('Please enter name of person who performed actions', 'error');
      return;
    }

    // Create completion record
    const completion = {
      id: `CARE-${Date.now()}`,
      ...formData,
      careActions: selectedActions,
      completedAt: new Date().toISOString()
    };

    setCompletions(prev => [...prev, completion]);
    showToast('✅ Care completion confirmed successfully!', 'success');

    // Reset form
    setFormData({
      taskId: '',
      taskDate: new Date().toISOString().split('T')[0],
      zoneArea: '',
      careActions: {
        watering: false,
        fertilizing: false,
        pruning: false,
        pestControl: false,
        weeding: false,
        inspection: false
      },
      completionNotes: '',
      performedBy: '',
      supervisor: '',
      completionTime: ''
    });
  };

  const handleReset = () => {
    setFormData({
      taskId: '',
      taskDate: new Date().toISOString().split('T')[0],
      zoneArea: '',
      careActions: {
        watering: false,
        fertilizing: false,
        pruning: false,
        pestControl: false,
        weeding: false,
        inspection: false
      },
      completionNotes: '',
      performedBy: '',
      supervisor: '',
      completionTime: ''
    });
    showToast('Form cleared', 'info');
  };

  const CareActionCheckbox = ({ label, name }) => (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition">
      <input
        type="checkbox"
        name={`careActions.${name}`}
        checked={formData.careActions[name]}
        onChange={handleChange}
        className="w-5 h-5 text-blue-600 rounded"
      />
      <span className="text-slate-700 font-medium">{label}</span>
    </label>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar userRole={userRole} currentPage={currentPage} navigateTo={navigateTo} />

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Requirement T18</p>
            <h1 className="text-4xl font-bold text-slate-900 mt-2">Đánh dấu hoàn thành việc chăm sóc</h1>
            <p className="text-slate-600 mt-2 max-w-3xl">Confirm physical care actions (watering, fertilizing, etc.) have been performed correctly according to procedure.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
            {/* Task Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Task Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Task ID *</label>
                  <input
                    type="text"
                    name="taskId"
                    placeholder="e.g., T001"
                    value={formData.taskId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Task Date *</label>
                  <input
                    type="date"
                    name="taskDate"
                    value={formData.taskDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Zone / Area *</label>
                  <input
                    type="text"
                    name="zoneArea"
                    placeholder="e.g., A-01, B-05, Main Field"
                    value={formData.zoneArea}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Completion Time</label>
                  <input
                    type="time"
                    name="completionTime"
                    value={formData.completionTime}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Care Actions */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Physical Care Actions Completed *</h2>
              <div className="grid grid-cols-2 gap-4">
                <CareActionCheckbox label="🚿 Watering (Tưới cây)" name="watering" />
                <CareActionCheckbox label="🌾 Fertilizing (Bón phân)" name="fertilizing" />
                <CareActionCheckbox label="✂️ Pruning (Cắt tỉa)" name="pruning" />
                <CareActionCheckbox label="🐛 Pest Control (Phòng trừ sâu bệnh)" name="pestControl" />
                <CareActionCheckbox label="🌱 Weeding (Nhổ cỏ)" name="weeding" />
                <CareActionCheckbox label="🔍 Inspection (Kiểm tra)" name="inspection" />
              </div>
            </div>

            {/* Personnel Information */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Personnel Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Performed By (Name) *</label>
                  <input
                    type="text"
                    name="performedBy"
                    placeholder="Name of person who performed actions"
                    value={formData.performedBy}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Supervisor / Verified By</label>
                  <input
                    type="text"
                    name="supervisor"
                    placeholder="Supervisor or manager name (optional)"
                    value={formData.supervisor}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Completion Notes */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes</label>
              <textarea
                name="completionNotes"
                placeholder="Any observations, issues, or additional notes about the care completion..."
                value={formData.completionNotes}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
              >
                Clear Form
              </button>
              <button
                type="submit"
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold hover:from-green-600 hover:to-emerald-700 transition shadow-lg"
              >
                ✅ Confirm Completion
              </button>
            </div>
          </form>

          {/* Recent Completions */}
          {completions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Completions</h2>
              <div className="space-y-4">
                {completions.map((completion) => (
                  <div key={completion.id} className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600 font-semibold">Task ID:</p>
                        <p className="text-slate-900 font-bold">{completion.taskId}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-semibold">Completion ID:</p>
                        <p className="text-slate-900 font-bold">{completion.id}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-semibold">Zone:</p>
                        <p className="text-slate-900">{completion.zoneArea}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-semibold">Performed By:</p>
                        <p className="text-slate-900">{completion.performedBy}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-600 font-semibold">Actions Completed:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {completion.careActions.map((action) => (
                            <span key={action} className="px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-semibold capitalize">
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CareCompletionForm;
