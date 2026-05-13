import React from 'react';

export const StatsWidgets = () => {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Quick Stats</h4>
          <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        </div>
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <span className="text-sm font-medium text-on-surface-variant">Total Species</span>
            <span className="font-hanken text-3xl font-bold text-primary">142</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container">
            <div className="h-full w-3/4 bg-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-surface-container-low/50 p-4 border border-outline-variant/30">
              <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Vegetative</div>
              <div className="text-lg font-bold text-on-surface">58</div>
            </div>
            <div className="rounded-lg bg-surface-container-low/50 p-4 border border-outline-variant/30">
              <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Flowering</div>
              <div className="text-lg font-bold text-on-surface">24</div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Status */}
      <div className="relative overflow-hidden rounded-xl bg-primary p-6 text-white shadow-lg">
        <div className="relative z-10">
          <h4 className="mb-2 text-[9px] font-bold uppercase tracking-widest opacity-80">Database Status</h4>
          <div className="font-hanken text-xl font-bold leading-tight mb-4 uppercase">All Systems Nominal</div>
          <p className="mb-6 text-xs opacity-90 leading-relaxed">
            Last cloud synchronization performed 14 minutes ago. 42 updates pending area deployment.
          </p>
          <button className="w-full rounded-lg bg-white/10 backdrop-blur-md border border-white/20 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white transition-all hover:bg-white/20">
            Sync Now
          </button>
        </div>
        <svg className="absolute -bottom-6 -right-6 h-32 w-32 opacity-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
      </div>

      {/* Recent Modifications */}
      <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <h4 className="mb-6 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Recent Modifications</h4>
        <div className="space-y-6">
          <ModificationItem 
            color="bg-tertiary" 
            title="Tomato 'San Marzano'" 
            desc="pH Threshold updated by Admin" 
            time="2h ago" 
          />
          <ModificationItem 
            color="bg-primary" 
            title="New Area Added: GH-04" 
            desc="Operations deployment ready" 
            time="5h ago" 
          />
          <ModificationItem 
            color="bg-slate-400" 
            title="Pesticide: 'Neem-X 500'" 
            desc="Stock level re-calibration" 
            time="Yesterday" 
          />
        </div>
      </div>
    </div>
  );
};

const ModificationItem = ({ color, title, desc, time }) => (
  <div className="flex gap-4">
    <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
    <div>
      <div className="text-sm font-semibold text-on-surface leading-tight">{title}</div>
      <div className="text-xs text-on-surface-variant mt-0.5">{desc}</div>
      <div className="mt-1 font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">{time}</div>
    </div>
  </div>
);

export const FeatureGrid = () => {
  return (
    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
      <FeatureCard 
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>}
        iconColor="text-primary"
        title="Area Mapping"
        desc="Define physical zoning, greenhouse dimensions, and sensor node placement across your facility."
        linkText="MANAGE ZONES"
      />
      <FeatureCard 
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 9v6"/><path d="M9 12h6"/></svg>}
        iconColor="text-tertiary"
        title="Bio-Security"
        desc="Comprehensive database of localized pests and diseases with prevention protocols and treatment logs."
        linkText="VIEW DATABASE"
      />
      <FeatureCard 
        icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v8"/><path d="M14 2v8"/><path d="M8 10h8l1 12H7l1-12Z"/></svg>}
        iconColor="text-secondary"
        title="Chemical Registry"
        desc="Safety data sheets, application rates, and inventory management for fertilizers and pesticides."
        linkText="OPEN REGISTRY"
      />
    </div>
  );
};

const FeatureCard = ({ icon, iconColor, title, desc, linkText }) => (
  <div className="rounded-xl border border-outline-variant bg-white p-8 shadow-sm transition-transform hover:-translate-y-1">
    <div className={`mb-4 h-8 w-8 ${iconColor}`}>{icon}</div>
    <h5 className="font-hanken text-lg font-bold mb-3">{title}</h5>
    <p className="mb-6 text-sm leading-relaxed text-on-surface-variant">{desc}</p>
    <a href="#" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary group transition-all">
      {linkText}
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </a>
  </div>
);
