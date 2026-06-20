import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';

const MorphologyDataEntry = () => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    recordDate: new Date().toISOString().split('T')[0],
    plantId: '',
    cropName: '',
    growthStage: 'Vegetative',
    plantHeight: '',
    stemDiameter: '',
    leafCount: '',
    leafColor: 'Medium green',
    stemCondition: 'Healthy',
    branchingPattern: 'Normal',
    vigorLevel: 'Good',
    pestSymptoms: 'None',
    diseaseSymptoms: 'None',
    floweringState: 'Not flowering',
    fruitingState: 'No fruit',
    additionalNotes: '',
  });

  const [entries, setEntries] = useState([]);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.plantId || !formData.cropName) {
      showToast('Please fill in Plant ID and Crop Name', 'error');
      return;
    }

    const newEntry = {
      id: `MOR-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      ...formData
    };

    setEntries(prev => [newEntry, ...prev]);
    showToast('Morphology record saved successfully', 'success');
    
    // Reset form
    setFormData({
      recordDate: new Date().toISOString().split('T')[0],
      plantId: '',
      cropName: '',
      growthStage: 'Vegetative',
      plantHeight: '',
      stemDiameter: '',
      leafCount: '',
      leafColor: 'Medium green',
      stemCondition: 'Healthy',
      branchingPattern: 'Normal',
      vigorLevel: 'Good',
      pestSymptoms: 'None',
      diseaseSymptoms: 'None',
      floweringState: 'Not flowering',
      fruitingState: 'No fruit',
      additionalNotes: '',
    });
  };

  const handleReset = () => {
    setFormData({
      recordDate: new Date().toISOString().split('T')[0],
      plantId: '',
      cropName: '',
      growthStage: 'Vegetative',
      plantHeight: '',
      stemDiameter: '',
      leafCount: '',
      leafColor: 'Medium green',
      stemCondition: 'Healthy',
      branchingPattern: 'Normal',
      vigorLevel: 'Good',
      pestSymptoms: 'None',
      diseaseSymptoms: 'None',
      floweringState: 'Not flowering',
      fruitingState: 'No fruit',
      additionalNotes: '',
    });
    showToast('Form reset', 'info');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-50 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Smart <span className="text-blue-600">Farm</span></h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">STUDENT PORTAL</p>
        </div>

        <div className="px-4 py-6 border-b border-slate-100">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 p-4 border border-blue-200">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Requirement 4</p>
            <p className="text-lg font-bold text-blue-900 mt-1">Morphology Entry</p>
            <p className="text-xs text-blue-700 mt-2">Plant data collection</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4">
          <button onClick={() => navigateTo('/student')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">📖 Lessons</button>
          <button onClick={() => navigateTo('/student/task-list')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">📋 My Tasks</button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">🌿 Morphology Entry</button>
          {/* <button onClick={() => navigateTo('/')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition">🎮 Practice Simulation</button> */}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={() => navigateTo('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition">🚪 Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Requirement 4</p>
                <h1 className="text-4xl font-bold text-slate-900 mt-2">Nhập số liệu đo đạc hình thái cây</h1>
                <p className="text-slate-600 mt-2 max-w-3xl">Thu thập các chỉ số sinh học định tính của cây trồng mà cảm biến IoT không thể đo được (Collect qualitative biological indicators of crops that IoT sensors cannot measure)</p>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Data Entry Form</h2>

                {/* Row 1: Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Record Date *</label>
                    <input
                      type="date"
                      name="recordDate"
                      value={formData.recordDate}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Plant ID *</label>
                    <input
                      type="text"
                      name="plantId"
                      value={formData.plantId}
                      onChange={handleChange}
                      placeholder="e.g., PLT-001"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Crop Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Crop Name *</label>
                    <input
                      type="text"
                      name="cropName"
                      value={formData.cropName}
                      onChange={handleChange}
                      placeholder="e.g., Tomato"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Growth Stage</label>
                    <select
                      name="growthStage"
                      value={formData.growthStage}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
                    >
                      <option>Seedling</option>
                      <option>Vegetative</option>
                      <option>Flowering</option>
                      <option>Fruiting</option>
                      <option>Mature</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Measurements */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Morphological Measurements</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Plant Height (cm)</label>
                      <input
                        type="number"
                        name="plantHeight"
                        value={formData.plantHeight}
                        onChange={handleChange}
                        step="0.1"
                        placeholder="e.g., 45.5"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Stem Diameter (mm)</label>
                      <input
                        type="number"
                        name="stemDiameter"
                        value={formData.stemDiameter}
                        onChange={handleChange}
                        step="0.1"
                        placeholder="e.g., 12.3"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Leaf Count (pieces)</label>
                      <input
                        type="number"
                        name="leafCount"
                        value={formData.leafCount}
                        onChange={handleChange}
                        placeholder="e.g., 24"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Qualitative Observations */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Qualitative Observations</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Leaf Color</label>
                      <select
                        name="leafColor"
                        value={formData.leafColor}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-slate-900"
                      >
                        <option>Light green</option>
                        <option>Medium green</option>
                        <option>Dark green</option>
                        <option>Yellowish</option>
                        <option>Reddish</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Stem Condition</label>
                      <select
                        name="stemCondition"
                        value={formData.stemCondition}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-slate-900"
                      >
                        <option>Healthy</option>
                        <option>Slightly bent</option>
                        <option>Bent</option>
                        <option>Lodged</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Branching Pattern</label>
                      <select
                        name="branchingPattern"
                        value={formData.branchingPattern}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-slate-900"
                      >
                        <option>Sparse</option>
                        <option>Normal</option>
                        <option>Dense</option>
                        <option>Irregular</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Vigor Level</label>
                      <select
                        name="vigorLevel"
                        value={formData.vigorLevel}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-slate-900"
                      >
                        <option>Poor</option>
                        <option>Fair</option>
                        <option>Good</option>
                        <option>Excellent</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 5: Health & Development */}
                <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Health & Development Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Pest Symptoms</label>
                      <select
                        name="pestSymptoms"
                        value={formData.pestSymptoms}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-slate-900"
                      >
                        <option>None</option>
                        <option>Minor (1-5%)</option>
                        <option>Moderate (5-20%)</option>
                        <option>Severe (&gt;20%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Disease Symptoms</label>
                      <select
                        name="diseaseSymptoms"
                        value={formData.diseaseSymptoms}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-slate-900"
                      >
                        <option>None</option>
                        <option>Minor (1-5%)</option>
                        <option>Moderate (5-20%)</option>
                        <option>Severe (&gt;20%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Flowering State</label>
                      <select
                        name="floweringState"
                        value={formData.floweringState}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-slate-900"
                      >
                        <option>Not flowering</option>
                        <option>Budding</option>
                        <option>Early flowering</option>
                        <option>Full flowering</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Fruiting State</label>
                      <select
                        name="fruitingState"
                        value={formData.fruitingState}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-slate-900"
                      >
                        <option>No fruit</option>
                        <option>Early fruit set</option>
                        <option>Developing fruit</option>
                        <option>Ripe fruit</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes</label>
                  <textarea
                    name="additionalNotes"
                    value={formData.additionalNotes}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Any other observations..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 px-4 rounded-lg hover:from-amber-600 hover:to-orange-600 transition"
                  >
                    Save Record
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 bg-slate-200 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-slate-300 transition"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 sticky top-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4">About This Task</h3>
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="pb-4 border-b border-slate-200">
                    <p className="font-semibold text-slate-900 mb-2">Objective</p>
                    <p>Collect qualitative biological indicators that IoT sensors cannot automatically measure.</p>
                  </div>
                  <div className="pb-4 border-b border-slate-200">
                    <p className="font-semibold text-slate-900 mb-2">Data Categories</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Morphological measurements</li>
                      <li>Visual observations</li>
                      <li>Plant health status</li>
                      <li>Development stage</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-2">Total Records</p>
                    <p className="text-2xl font-bold text-amber-600">{entries.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Records Table */}
          {entries.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">Saved Records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Record ID</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Plant ID</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Crop</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Stage</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Height (cm)</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Vigor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-slate-900">{entry.id}</td>
                        <td className="px-6 py-3">{entry.recordDate}</td>
                        <td className="px-6 py-3 font-semibold text-slate-900">{entry.plantId}</td>
                        <td className="px-6 py-3">{entry.cropName}</td>
                        <td className="px-6 py-3">{entry.growthStage}</td>
                        <td className="px-6 py-3">{entry.plantHeight || '-'}</td>
                        <td className="px-6 py-3"><span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{entry.vigorLevel}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MorphologyDataEntry;
