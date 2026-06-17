import React, { useState } from 'react';
import { CatalogTable } from './CatalogTable';
import { StatsWidgets, FeatureGrid } from './Widgets';
import { AREAS, PESTS, INVENTORY } from '../../api/mockData';

const MasterData = () => {
  const [activeTab, setActiveTab] = useState('PLANT SPECIES CATALOG');

  const tabs = [
    { label: 'DANH MỤC GIỐNG CÂY' },
    { label: 'KHU VỰC & NHÀ MÀNG' },
    { label: 'DỮ LIỆU SÂU BỆNH' },
    { label: 'QUẢN LÝ KHO' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'DANH MỤC GIỐNG CÂY':
        return (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
              <div>
                <h3 className="font-hanken text-2xl font-bold text-on-surface">Danh Mục Giống Cây</h3>
                <p className="text-sm text-on-surface-variant">Quản lý dữ liệu phân loại, yêu cầu sinh trưởng và các giai đoạn vòng đời.</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Thêm Giống Mới
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-8 h-full flex flex-col">
                <CatalogTable />
              </div>
              <div className="lg:col-span-4">
                <StatsWidgets />
              </div>
            </div>
            <FeatureGrid />
          </>
        );

      case 'KHU VỰC & NHÀ MÀNG':
        return (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
              <div>
                <h3 className="font-hanken text-2xl font-bold text-on-surface">Khu Vực & Nhà Màng</h3>
                <p className="text-sm text-on-surface-variant">Cấu hình sơ đồ cơ sở, vùng khí hậu và phân bổ lô đất.</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Thêm Khu Vực
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {AREAS.map((area) => (
                <div key={area.id} className="bg-white border border-outline-variant p-6 rounded-xl hover:shadow-lg transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{area.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${area.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                      {area.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-lg text-on-surface group-hover:text-primary transition-colors">{area.name}</h4>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Loại</span>
                      <span className="font-bold text-on-surface">{area.type}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Tổng Diện Tích</span>
                      <span className="font-bold text-on-surface">{area.area}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-outline-variant pt-2 mt-2">
                      <span className="text-on-surface-variant">Cây Trồng Hiện Tại</span>
                      <span className="font-bold text-primary">{area.plants}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-outline-variant rounded-xl p-8 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-on-surface">Dịch vụ Bản đồ Không gian</h4>
                <p className="text-sm text-on-surface-variant mt-1">Tích hợp dữ liệu từ vệ tinh hoặc flycam để quản lý khu vực chính xác.</p>
              </div>
              <button className="px-6 py-2 border border-outline-variant rounded-lg text-xs font-bold hover:bg-surface-container transition-all">Cấu hình GIS</button>
            </div>
          </div>
        );

      case 'DỮ LIỆU SÂU BỆNH':
        return (
          <div className="space-y-8">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
              <div>
                <h3 className="font-hanken text-2xl font-bold text-on-surface">Dữ Liệu Sâu Bệnh</h3>
                <p className="text-sm text-on-surface-variant">Sổ bộ tổng hợp các mối đe dọa sinh học và phương án xử lý.</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Ghi Nhận Nguy Cơ Mới
              </button>
            </div>

            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tên Thông Thường</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Phân Loại</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Mức Độ Rủi Ro</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Biện Pháp Xử Lý Chính</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Cây Dễ Mắc Phải</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {PESTS.map((pest, i) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-bold text-sm text-on-surface">{pest.name}</td>
                      <td className="px-6 py-4"><span className="text-xs px-2 py-1 bg-slate-100 rounded-md font-medium text-slate-600">{pest.type}</span></td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pest.risk === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>
                          {pest.risk}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-on-surface-variant italic">{pest.treatment}</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant">{pest.affected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'QUẢN LÝ KHO':
        return (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
              <div>
                <h3 className="font-hanken text-2xl font-bold text-on-surface">Quản Lý Kho</h3>
                <p className="text-sm text-on-surface-variant">Theo dõi vật tư nông nghiệp, hạt giống và mức tồn kho thiết bị.</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-bold tracking-wider hover:bg-primary/90 transition-all shadow-md active:scale-95 uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Cập Nhật Tồn Kho
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tên Vật Tư</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Danh Mục</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Số Lượng</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nhà Cung Cấp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {INVENTORY.map((inv, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4 font-bold text-sm text-on-surface">{inv.item}</td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">{inv.category}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-end gap-1">
                            <span className="text-sm font-bold text-primary">{inv.stock}</span>
                            <span className="text-[10px] text-on-surface-variant font-medium uppercase mb-0.5">{inv.unit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-on-surface-variant">{inv.supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl">
                  <h4 className="font-bold text-primary text-sm uppercase tracking-widest mb-4">Cảnh Báo Tồn Kho</h4>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">!</div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">Phân bón Kali đang sắp hết</p>
                        <p className="text-[10px] text-on-surface-variant mt-1">Còn lại: 15kg. Đã chạm mức cần đặt hàng lại.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-outline-variant p-6 rounded-xl">
                  <h4 className="font-bold text-on-surface text-sm uppercase tracking-widest mb-4">Liên Kết Nhanh</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container rounded-md transition-colors">Xuất Báo Cáo Tồn Kho</button>
                    <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container rounded-md transition-colors">Danh bạ Nhà Cung Cấp</button>
                    <button className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-container rounded-md transition-colors">Theo dõi Đơn Hàng</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col animate-fade-in w-full">
      {/* Header - Hidden on mobile, shown on desktop */}
      <header className="hidden lg:flex min-h-20 py-4 border-b border-outline-variant items-center justify-between px-10 bg-white/50 backdrop-blur-md sticky top-0 z-20 gap-4">
        <h2 className="font-hanken text-xl lg:text-2xl font-bold text-primary w-full lg:w-auto text-center lg:text-left">Dữ liệu Danh mục</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative group w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input 
              type="text" 
              placeholder="Tìm kiếm dữ liệu..." 
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

      <div className="px-6 lg:px-12 py-8 lg:py-10 space-y-8 lg:space-y-10">
        <div className="border-b border-outline-variant bg-white/50 backdrop-blur-sm sticky top-20 lg:top-20 z-10 overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
          <div className="flex gap-8 lg:gap-10">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`pb-4 px-1 text-[10px] lg:text-xs font-bold tracking-[0.05em] transition-all whitespace-nowrap relative ${
                  activeTab === tab.label 
                    ? 'text-primary' 
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
                {activeTab === tab.label && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default MasterData;
