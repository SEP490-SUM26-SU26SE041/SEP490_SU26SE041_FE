import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import SharedSidebar from '../../components/SharedSidebar';

const EmergencyReportForm = () => {
  const { showToast } = useToast();
  const [userRole] = useState(() => {
    const path = window.location.pathname;
    return path.includes('technician') ? 'Technician' : 'Student';
  });

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    reportTime: new Date().toTimeString().slice(0, 5),
    issueType: '',
    zone: '',
    severity: 'High',
    description: '',
    affectedArea: '',
    estimatedDamage: '',
    immediateActions: '',
    photosAttached: false,
    reportedBy: '',
    contactNumber: ''
  });

  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('emergencyReports');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentPage, setCurrentPage] = useState(window.location.pathname);
  const [submittedReport, setSubmittedReport] = useState(null);

  useEffect(() => {
    const handleNavigate = () => {
      setCurrentPage(window.location.pathname);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  useEffect(() => {
    localStorage.setItem('emergencyReports', JSON.stringify(reports));
  }, [reports]);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.issueType.trim()) {
      showToast('Please select issue type', 'error');
      return;
    }

    if (!formData.zone.trim()) {
      showToast('Please enter zone/location', 'error');
      return;
    }

    if (!formData.description.trim()) {
      showToast('Please describe the issue', 'error');
      return;
    }

    if (!formData.reportedBy.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    if (!formData.contactNumber.trim()) {
      showToast('Please enter contact number', 'error');
      return;
    }

    // Create report
    const report = {
      id: `EMER-${Date.now()}`,
      ...formData,
      createdAt: new Date().toISOString(),
      status: 'Submitted'
    };

    setReports([report, ...reports]);
    setSubmittedReport(report);

    showToast('Emergency report submitted successfully! Report ID: ' + report.id, 'success');

    // Reset form after 2 seconds
    setTimeout(() => {
      setFormData({
        reportDate: new Date().toISOString().split('T')[0],
        reportTime: new Date().toTimeString().slice(0, 5),
        issueType: '',
        zone: '',
        severity: 'High',
        description: '',
        affectedArea: '',
        estimatedDamage: '',
        immediateActions: '',
        photosAttached: false,
        reportedBy: '',
        contactNumber: ''
      });
      setSubmittedReport(null);
    }, 2000);
  };

  const getIssueIcon = (type) => {
    const icons = {
      'equipment-damage': '⚙️',
      'roof-collapse': '🏚️',
      'mass-plant-death': '🌿',
      'irrigation-failure': '💧',
      'electrical-failure': '⚡',
      'other': '⚠️'
    };
    return icons[type] || '⚠️';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'High':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      case 'Medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      default:
        return 'bg-blue-100 border-blue-300 text-blue-900';
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar userRole={userRole} currentPage={currentPage} navigateTo={navigateTo} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Requirement T5</p>
              <h1 className="text-4xl font-bold text-slate-900 mt-2">🚨 Emergency Report</h1>
              <p className="text-slate-600 mt-2 max-w-3xl">Report urgent issues that exceed handling authority</p>
            </div>

            {/* Success Message */}
            {submittedReport && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold">✓ Report submitted successfully</p>
                <p className="text-green-700 text-sm mt-1">Report ID: <span className="font-mono font-bold">{submittedReport.id}</span></p>
              </div>
            )}

            {/* Main Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Issue Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">Issue Type *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { value: 'equipment-damage', label: 'Equipment Damage' },
                      { value: 'roof-collapse', label: 'Roof/Shelter Collapse' },
                      { value: 'mass-plant-death', label: 'Mass Plant Death' },
                      { value: 'irrigation-failure', label: 'Irrigation Failure' },
                      { value: 'electrical-failure', label: 'Electrical Failure' },
                      { value: 'other', label: 'Other Emergency' }
                    ].map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, issueType: type.value }))}
                        className={`p-3 rounded-lg border-2 transition font-medium text-sm ${
                          formData.issueType === type.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                        }`}
                      >
                        <span className="mr-2">{getIssueIcon(type.value)}</span>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity Level */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">Severity Level *</label>
                  <div className="flex gap-3">
                    {['Critical', 'High', 'Medium'].map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, severity: level }))}
                        className={`px-4 py-2 rounded-lg border-2 transition font-medium ${
                          formData.severity === level
                            ? `border-red-500 bg-red-50 text-red-700 ${level === 'Critical' ? 'ring-2 ring-red-300' : ''}`
                            : 'border-slate-200 bg-white text-slate-700 hover:border-red-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Report Date */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Report Date *</label>
                    <input
                      type="date"
                      name="reportDate"
                      value={formData.reportDate}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Report Time */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Report Time *</label>
                    <input
                      type="time"
                      name="reportTime"
                      value={formData.reportTime}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Zone/Location */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Zone/Location *</label>
                    <input
                      type="text"
                      name="zone"
                      value={formData.zone}
                      onChange={handleChange}
                      placeholder="e.g., Zone A-01, Block B-03"
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Affected Area */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Affected Area *</label>
                    <input
                      type="text"
                      name="affectedArea"
                      value={formData.affectedArea}
                      onChange={handleChange}
                      placeholder="e.g., 50 sqm, entire block, 200 plants"
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Reported By */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Reported By *</label>
                    <input
                      type="text"
                      name="reportedBy"
                      value={formData.reportedBy}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Number *</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      placeholder="Phone number"
                      className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Detailed Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe the issue, what caused it, and current status..."
                    rows="5"
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Estimated Damage */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Damage/Loss</label>
                  <textarea
                    name="estimatedDamage"
                    value={formData.estimatedDamage}
                    onChange={handleChange}
                    placeholder="Estimate the damage value or affected quantity (e.g., 500 damaged plants, equipment value 10M VND)"
                    rows="3"
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Immediate Actions Taken */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Immediate Actions Taken</label>
                  <textarea
                    name="immediateActions"
                    value={formData.immediateActions}
                    onChange={handleChange}
                    placeholder="List any temporary measures taken to prevent further damage..."
                    rows="3"
                    className="w-full px-4 py-3 rounded-lg bg-white text-slate-900 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Photos Attached */}
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    name="photosAttached"
                    checked={formData.photosAttached}
                    onChange={handleChange}
                    id="photosAttached"
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="photosAttached" className="text-sm font-medium text-blue-900">
                    📸 Photos/Evidence attached to this report
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition"
                  >
                    🚨 Submit Emergency Report
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('/technician')}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Reports */}
            {reports.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Reports</h2>
                <div className="space-y-4">
                  {reports.slice(0, 5).map(report => (
                    <div
                      key={report.id}
                      className={`p-4 rounded-lg border-2 ${getSeverityColor(report.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getIssueIcon(report.issueType)}</span>
                            <h3 className="font-bold">{report.issueType.replace(/-/g, ' ').toUpperCase()}</h3>
                            <span className="text-xs font-mono">{report.id}</span>
                          </div>
                          <p className="text-sm mt-2 opacity-90">
                            <strong>Zone:</strong> {report.zone} | <strong>Reported by:</strong> {report.reportedBy}
                          </p>
                          <p className="text-sm mt-1 opacity-90">
                            <strong>Time:</strong> {report.reportDate} {report.reportTime}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          report.severity === 'Critical' ? 'bg-red-200 text-red-800' :
                          report.severity === 'High' ? 'bg-orange-200 text-orange-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {report.severity}
                        </span>
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

export default EmergencyReportForm;
