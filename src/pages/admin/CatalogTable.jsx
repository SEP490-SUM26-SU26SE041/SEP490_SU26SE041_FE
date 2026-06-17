import React from 'react';
import { SPECIES as species } from '../../api/mockData';

export const CatalogTable = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/50 px-6 py-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Danh Mục Đang Hoạt Động (142)</span>
        <div className="flex gap-2">
          <button className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </button>
          <button className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low/30">
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tên & Chủng Loại</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chu Kỳ Sinh Trưởng</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nhiệt Độ Tối Ưu</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {species.map((item) => (
              <tr key={item.id} className="group transition-colors hover:bg-surface-container-low/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary-container">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-on-surface">{item.name}</div>
                      <div className="text-[11px] text-on-surface-variant">{item.variety}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-on-surface">{item.cycle}</td>
                <td className="px-6 py-4 font-mono text-xs text-on-surface">{item.temp}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    item.status === 'Active' 
                      ? 'bg-secondary-container text-on-secondary-container' 
                      : 'bg-tertiary-container/20 text-on-tertiary-container'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-on-surface-variant transition-colors hover:text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low/30 px-6 py-4">
        <span className="text-xs text-on-surface-variant">Đang hiển thị 1-10 trên 142 giống</span>
        <div className="flex gap-2">
          <button className="rounded border border-outline-variant px-3 py-1 text-[10px] font-bold transition-colors hover:bg-white disabled:opacity-30" disabled>
            TRƯỚC
          </button>
          <button className="rounded border border-outline-variant px-3 py-1 text-[10px] font-bold transition-colors hover:bg-white">
            TIẾP THEO
          </button>
        </div>
      </div>
    </div>
  );
};
