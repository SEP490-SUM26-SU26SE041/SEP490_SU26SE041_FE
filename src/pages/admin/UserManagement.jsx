import React from 'react';

const UserManagement = ({ users }) => {
  const STATS = [
    { label: 'Total Users', value: '142', color: 'text-primary' },
    { label: 'Active Now', value: '18', color: 'text-primary' },
    { label: 'Pending Tasks', value: '5', color: 'text-tertiary' },
    { label: 'System Health', value: '99%', color: 'text-primary' },
  ];

  return (
    <div className="flex flex-col animate-fade-in w-full">
      {/* Header - Hidden on mobile, shown on desktop */}
      <header className="hidden lg:flex min-h-20 py-4 border-b border-outline-variant items-center justify-between px-10 bg-white/50 backdrop-blur-md sticky top-0 z-20 gap-4">
        <h2 className="font-hanken text-xl lg:text-2xl font-bold text-primary w-full lg:w-auto text-center lg:text-left">User Management</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative group w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search users..." 
              className="pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-full"
            />
          </div>
          <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-outline-variant pt-4 sm:pt-0 sm:pl-4 w-full sm:w-auto justify-center">
            <button className="p-2 hover:bg-surface-container transition-colors rounded-full text-on-surface-variant">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <button className="p-2 hover:bg-surface-container transition-colors rounded-full text-on-surface-variant">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-white border border-outline-variant p-4 lg:p-6 rounded-xl flex flex-col gap-1 lg:gap-2 transition-transform hover:-translate-y-1 shadow-sm">
              <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{stat.label}</span>
              <span className={`font-hanken text-2xl lg:text-4xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="max-w-md">
            <h3 className="font-hanken text-lg lg:text-2xl font-bold text-on-surface">System Accounts</h3>
            <p className="text-[10px] lg:text-sm text-on-surface-variant mt-0.5 lg:mt-1">Manage global access and role permissions.</p>
          </div>
          <button className="w-full sm:w-auto bg-primary hover:bg-[#3d5728] text-white px-6 py-3 lg:py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] tracking-wider transition-all shadow-md active:scale-95 uppercase">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Add User
          </button>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant text-left">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Last Login</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {users.map((user, idx) => (
                  <tr key={idx} className={`group hover:bg-surface-container/30 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/20' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${user.avatarBg}`}>
                          {user.initials}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#1a1c1c]">{user.name}</div>
                          <div className="text-xs text-on-surface-variant">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${user.roleColor}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-primary' : 'bg-slate-300'}`} />
                        <span className="text-sm text-on-surface-variant">{user.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[13px] text-on-surface-variant">
                      {user.lastLogin}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="text-primary font-bold text-[10px] uppercase hover:underline p-1">Edit</button>
                        <button className="text-rose-500 font-bold text-[10px] uppercase hover:underline p-1">{user.status === 'Active' ? 'Disable' : 'Enable'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant flex justify-between items-center">
            <span className="text-xs text-on-surface-variant font-medium">Showing {users.length} of 142 users</span>
            <div className="flex items-center gap-2">
              <button className="p-1.5 border border-outline-variant rounded hover:bg-white transition-colors disabled:opacity-40" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="w-8 h-8 flex items-center justify-center bg-primary text-white text-xs font-bold rounded">1</button>
              <button className="w-8 h-8 flex items-center justify-center text-on-surface-variant text-xs hover:bg-white border border-transparent hover:border-outline-variant rounded transition-all">2</button>
              <button className="w-8 h-8 flex items-center justify-center text-on-surface-variant text-xs hover:bg-white border border-transparent hover:border-outline-variant rounded transition-all">3</button>
              <button className="p-1.5 border border-outline-variant rounded hover:bg-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
