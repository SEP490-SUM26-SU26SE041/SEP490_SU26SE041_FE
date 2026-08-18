import React, { useMemo } from 'react';
import {
  useWaterSensor,
  formatTemp,
  formatDsTemp,
  formatPercent,
  formatPh,
  sensorHealth,
} from './useWaterSensor';

// ── Status Badge (hiển thị trạng thái kết nối MQTT) ────────────────────────

const STATUS_META = {
  connecting: { label: 'Đang kết nối', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500 animate-pulse' },
  connected:  { label: 'Trực tuyến',  cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  disconnected: { label: 'Mất kết nối', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  error:      { label: 'Lỗi',        cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

function StatusBadge({ status, lastSeen }) {
  const meta = STATUS_META[status] || STATUS_META.disconnected;
  const seen = lastSeen
    ? ` · cập nhật ${lastSeen.toLocaleTimeString('vi-VN')}`
    : '';
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}>
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      {meta.label}{seen}
    </span>
  );
}

// ── Sensor Card (1 card hiển thị 1 chỉ số cảm biến) ─────────────────────────

function SensorCard({ title, value, unit, icon, accent, hint, warn }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
      warn
        ? 'bg-rose-50 border-rose-200'
        : 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-indigo-300 hover:shadow-md'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${accent}`}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-black tracking-tight ${warn ? 'text-rose-700' : 'text-slate-900'}`}>
          {value}
        </span>
        {value !== '---' && unit && (
          <span className="text-xs font-bold text-slate-500">{unit}</span>
        )}
      </div>
      {hint && <p className={`text-[10px] mt-1 ${warn ? 'text-rose-600' : 'text-slate-500'}`}>{hint}</p>}
    </div>
  );
}

// ── IoTSensorTab — Tab nội dung hiển thị trong ExperimentDetailModal ────────

export default function IoTSensorTab({ experimentTitle }) {
  const { data, status, error, log, lastSeen, topic, broker } = useWaterSensor();
  const health = useMemo(() => sensorHealth(data), [data]);

  const dsOk = data.ds18b20_t !== undefined && data.ds18b20_t !== -127;
  const phOk = data.ph !== undefined && data.ph >= 0 && data.ph <= 14;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header: status + thông tin kết nối ── */}
      <div className="bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 rounded-2xl border border-cyan-200 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🌊</span>
              <h3 className="font-bold text-base text-slate-900">ESP32-C3 Water Sensor</h3>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              Real-time từ thiết bị IoT · {experimentTitle ? `TN: ${experimentTitle}` : 'Demo'}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={status} lastSeen={lastSeen} />
              {health === 'ok' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Số liệu ổn định
                </span>
              )}
              {health === 'warning' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  ⚠ Có cảnh báo
                </span>
              )}
              {health === 'idle' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                  ⏳ Đang đợi dữ liệu
                </span>
              )}
            </div>
          </div>
          <div className="text-right space-y-1 shrink-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Broker</p>
            <p className="text-[11px] font-mono text-slate-700 break-all">{broker.replace('wss://', '')}</p>
            <p className="text-[10px] font-bold uppercase text-slate-500 mt-1">Topic</p>
            <p className="text-[11px] font-mono text-slate-700 break-all">{topic}</p>
          </div>
        </div>
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <b>Lỗi:</b> {error}
          </div>
        )}
      </div>

      {/* ── 5 Sensor Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SensorCard
          title="Độ ẩm (DHT11)"
          value={formatPercent(data.dht_h)}
          unit="%"
          icon="💧"
          accent="bg-sky-100 text-sky-700"
          hint="Không khí xung quanh"
        />
        <SensorCard
          title="Nhiệt độ (DHT11)"
          value={formatTemp(data.dht_t)}
          unit="°C"
          icon="🌡️"
          accent="bg-orange-100 text-orange-700"
          hint="Không khí xung quanh"
        />
        <SensorCard
          title="Nhiệt độ nước (DS18B20)"
          value={formatDsTemp(data.ds18b20_t)}
          unit="°C"
          icon="🌊"
          accent="bg-cyan-100 text-cyan-700"
          hint={dsOk ? 'Cảm biến chìm trong nước' : 'Cảm biến mất kết nối'}
          warn={!dsOk}
        />
        <SensorCard
          title="Ánh sáng (LDR)"
          value={formatPercent(data.light_pct)}
          unit="%"
          icon="☀️"
          accent="bg-amber-100 text-amber-700"
          hint="Cường độ tương đối"
        />
        <SensorCard
          title="pH (E-201-C)"
          value={formatPh(data.ph)}
          unit=""
          icon="🧪"
          accent={phOk ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}
          hint={phOk ? 'Lý tưởng 6.5 – 8.5' : 'Chưa có dữ liệu pH'}
          warn={phOk && (data.ph < 5 || data.ph > 9)}
        />
      </div>

      {/* ── Giải thích nhanh ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">📖 Cách đọc</p>
        <ul className="text-xs text-slate-600 space-y-1 leading-relaxed">
          <li>• ESP32-C3 publish JSON lên topic <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">{topic}</code> mỗi 3 giây.</li>
          <li>• DS18B20 trả <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">-127.0</code> khi mất kết nối → FE hiển thị <b>---</b>.</li>
          <li>• Trường <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">ph</code> chỉ có khi firmware <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">PH_MODE=1</code>.</li>
          <li>• Broker công cộng — mọi người đều có thể subscribe, không dùng cho dữ liệu nhạy cảm.</li>
        </ul>
      </div>

      {/* ── Recent log (debug + minh bạch luồng) ── */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 shadow-inner">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
            📡 Nhật ký MQTT ({log.length})
          </p>
          {lastSeen && (
            <p className="text-[10px] text-slate-400 font-mono">
              Last: {lastSeen.toLocaleTimeString('vi-VN')}
            </p>
          )}
        </div>
        {log.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3 text-center">Chưa có log. Đang đợi message từ broker...</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-[11px]">
            {log.map((entry, idx) => {
              const isError = entry.level === 'error';
              const isInfo  = entry.level === 'info';
              const isData  = entry.level === 'data';
              return (
                <div
                  key={`${entry.ts}-${idx}`}
                  className={`flex gap-2 py-0.5 px-2 rounded ${
                    isError ? 'bg-rose-900/40 text-rose-200' :
                    isData  ? 'bg-emerald-900/30 text-emerald-200' :
                    isInfo  ? 'bg-slate-800 text-slate-300' :
                              'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 shrink-0">
                    {new Date(entry.ts).toLocaleTimeString('vi-VN')}
                  </span>
                  <span className="break-all">{entry.msg}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
