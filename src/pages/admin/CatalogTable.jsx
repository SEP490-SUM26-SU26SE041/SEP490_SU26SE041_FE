import React from 'react';

const species = [
  {
    id: 1,
    name: 'Solanum lycopersicum',
    variety: 'Heirloom Red / Indeterminate',
    cycle: '85-90 Days',
    temp: '22°C - 28°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&h=100&fit=crop'
  },
  {
    id: 2,
    name: 'Lactuca sativa',
    variety: 'Parris Island Cos',
    cycle: '65-70 Days',
    temp: '15°C - 21°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1622206141855-520e74f3883a?w=100&h=100&fit=crop'
  },
  {
    id: 3,
    name: 'Capsicum annuum',
    variety: 'California Wonder',
    cycle: '75-80 Days',
    temp: '20°C - 30°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?w=100&h=100&fit=crop'
  },
  {
    id: 4,
    name: 'Fragaria x ananassa',
    variety: 'Garden Strawberry / Everbearing',
    cycle: '120-140 Days',
    temp: '18°C - 24°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1464960710334-31f2f272df7f?w=100&h=100&fit=crop'
  },
  {
    id: 5,
    name: 'Cucumis sativus',
    variety: 'Marketmore 76',
    cycle: '55-65 Days',
    temp: '22°C - 30°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1449339043483-287d3d636573?w=100&h=100&fit=crop'
  },
  {
    id: 6,
    name: 'Spinacia oleracea',
    variety: 'Bloomsdale Long Standing',
    cycle: '40-45 Days',
    temp: '10°C - 18°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=100&h=100&fit=crop'
  },
  {
    id: 7,
    name: 'Daucus carota',
    variety: 'Nantes Coreless',
    cycle: '65-75 Days',
    temp: '15°C - 21°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=100&h=100&fit=crop'
  },
  {
    id: 8,
    name: 'Solanum melongena',
    variety: 'Black Beauty Eggplant',
    cycle: '75-85 Days',
    temp: '24°C - 32°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=100&h=100&fit=crop'
  },
  {
    id: 9,
    name: 'Brassica oleracea',
    variety: 'Waltham 29 Broccoli',
    cycle: '85-95 Days',
    temp: '15°C - 20°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=100&h=100&fit=crop'
  },
  {
    id: 10,
    name: 'Allium cepa',
    variety: 'Walla Walla Yellow Onion',
    cycle: '100-110 Days',
    temp: '15°C - 25°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1508747703725-7197771375a0?w=100&h=100&fit=crop'
  }
];

export const CatalogTable = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/50 px-6 py-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Active Catalog Entries (142)</span>
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
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Name & Variety</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Growth Cycle</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Optimal Temp</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Actions</th>
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
        <span className="text-xs text-on-surface-variant">Showing 1-10 of 142 species</span>
        <div className="flex gap-2">
          <button className="rounded border border-outline-variant px-3 py-1 text-[10px] font-bold transition-colors hover:bg-white disabled:opacity-30" disabled>
            PREV
          </button>
          <button className="rounded border border-outline-variant px-3 py-1 text-[10px] font-bold transition-colors hover:bg-white">
            NEXT
          </button>
        </div>
      </div>
    </div>
  );
};
