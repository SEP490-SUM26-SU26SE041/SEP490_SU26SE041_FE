import React, { useState, useEffect } from 'react';
import { systemLogApi } from '../../api/systemLogApi';
import { useToast } from '../../context/ToastContext';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await systemLogApi.getLogs({
        pageNumber: page,
        pageSize: 15,
        action: filterAction,
        searchTerm: searchTerm
      });
      setLogs(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
      showToast('Không thể tải nhật ký hệ thống', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction, searchTerm]);

  const handleGenerateMock = async () => {
    try {
      setIsGenerating(true);
      await systemLogApi.addMockLog();
      showToast('Đã tạo log giả lập thành công', 'success');
      fetchLogs();
    } catch (error) {
      showToast('Lỗi tạo log giả lập', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const getActionColors = (action) => {
    switch (action) {
      case 'DELETE': return 'bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20';
      case 'ERROR': return 'bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20';
      case 'CREATE': return 'bg-[#486730]/10 text-[#486730] border-[#486730]/20';
      case 'APPROVE': return 'bg-[#486730]/10 text-[#486730] border-[#486730]/20';
      case 'UPDATE': return 'bg-[#7c5639]/10 text-[#7c5639] border-[#7c5639]/20';
      case 'REASSIGN': return 'bg-[#7c5639]/10 text-[#7c5639] border-[#7c5639]/20';
      case 'LOGIN': return 'bg-[#0ea5e9]/10 text-[#0ea5e9] border-[#0ea5e9]/20';
      case 'EXPORT': return 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20';
      default: return 'bg-[#74796c]/10 text-[#74796c] border-[#74796c]/20';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'DELETE': 
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
      case 'ERROR': 
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
      case 'UPDATE': 
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>;
      case 'REASSIGN': 
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3v4"/><path d="M21 7h-4"/><path d="M7 21v-4"/><path d="M3 17h4"/><path d="M3 7v10"/><path d="M21 7v10"/><path d="M17 21h4"/><path d="M7 3H3"/></svg>;
      case 'CREATE':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
      case 'APPROVE':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
      case 'LOGIN':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
      case 'EXPORT':
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
      default: 
        return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    }
  };

  return (
    <div className="flex flex-col animate-fade-in w-full bg-[#f9f9f8] p-6 lg:p-10 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="font-hanken text-2xl font-bold text-[#1a1c1c]">Nhật Ký Hệ Thống</h2>
          <p className="text-sm text-[#74796c] mt-1">Lịch sử thao tác, thay đổi dữ liệu và trạng thái hệ thống.</p>
        </div>
        <div className="flex gap-3">
          {/* P1-#29: chỉ hiện nút tạo log test trong DEV, tránh gây nhiễu log thật trên production */}
          {import.meta.env.DEV && (
            <button
              onClick={handleGenerateMock}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#c4c8ba] rounded-xl hover:bg-[#e8e8e7] text-xs font-bold uppercase tracking-wider text-[#1a1c1c] transition-colors disabled:opacity-50"
              title="Chỉ hoạt động ở môi trường DEV — production sẽ ẩn nút này"
            >
              {isGenerating ? 'Đang Tạo...' : '+ Tạo Log Test'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#c4c8ba] rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-[#c4c8ba] bg-[#f3f4f3] flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex gap-2 flex-wrap flex-1">
            <button 
              onClick={() => setFilterAction('')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === '' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Tất Cả
            </button>
            <button 
              onClick={() => setFilterAction('LOGIN')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'LOGIN' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setFilterAction('CREATE')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'CREATE' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Create
            </button>
            <button 
              onClick={() => setFilterAction('UPDATE')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'UPDATE' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Update
            </button>
            <button 
              onClick={() => setFilterAction('DELETE')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'DELETE' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Delete
            </button>
            <button 
              onClick={() => setFilterAction('APPROVE')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'APPROVE' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Approve
            </button>
            <button 
              onClick={() => setFilterAction('REASSIGN')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'REASSIGN' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Reassign
            </button>
            <button 
              onClick={() => setFilterAction('EXPORT')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'EXPORT' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Export
            </button>
            <button 
              onClick={() => setFilterAction('ERROR')} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${filterAction === 'ERROR' ? 'bg-[#486730] text-white' : 'bg-white border border-[#c4c8ba] text-[#74796c] hover:bg-gray-50'}`}
            >
              Error
            </button>
          </div>
          
          <div className="relative w-full sm:w-auto lg:w-64 mt-2 lg:mt-0 flex-shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#74796c] w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              placeholder="Tìm kiếm nội dung..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-[#c4c8ba] rounded-lg text-sm w-full sm:w-64 focus:ring-2 focus:ring-[#486730]/20 focus:border-[#486730] outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#c4c8ba] bg-gray-50/50">
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-[#74796c] w-48">Thời Gian</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-[#74796c] w-32">Thao Tác</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-[#74796c] w-40">Đối Tượng</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-[#74796c]">Mô Tả</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-[#74796c]">Đang tải dữ liệu...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-[#74796c]">Không có dữ liệu nhật ký</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-[#e2e2e2] hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-[#74796c]">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-4 px-6">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getActionColors(log.action)}`}>
                        {getActionIcon(log.action)}
                        {log.action}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#1a1c1c] font-semibold">{log.entityName || '-'}</td>
                    <td className="py-4 px-6 text-[#1a1c1c]">
                      {log.description}
                      {log.ipAddress && <span className="block text-xs text-[#74796c] mt-1">IP: {log.ipAddress}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[#c4c8ba] bg-[#f3f4f3] flex justify-between items-center mt-auto">
          <span className="text-xs font-bold text-[#74796c]">
            Tổng cộng: {totalCount} bản ghi
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-white border border-[#c4c8ba] rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-50"
            >
              Trang Trước
            </button>
            <div className="px-4 py-1.5 font-mono text-sm font-bold bg-white border border-[#c4c8ba] rounded-lg">
              {page}
            </div>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < 15}
              className="px-3 py-1.5 bg-white border border-[#c4c8ba] rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-50"
            >
              Trang Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
