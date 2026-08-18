import { useEffect, useRef, useState, useCallback } from 'react';
// mqtt được load qua <script src="...mqtt.min.js"> trong index.html và expose
// như global `window.mqtt`. Làm vậy để tránh Vite/Rollup optimize và gặp lỗi
// thiếu polyfill Buffer/process khi bundle cho browser. Chỉ connect sau khi
// script đã sẵn sàng để tránh race condition.

// ── Cấu hình kết nối MQTT (public HiveMQ broker) ───────────────────────────
// ESP32-C3 publish lên topic `watersensor/esp32c3/data` m�i 3 giây qua TCP 1883.
// Web browser (không m� được raw TCP) phải dùng WebSocket Secure trên port 8884.
// Topic và URL lấy từ firmware Water_Sensor/src/main.cpp.

const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC = 'watersensor/esp32c3/data';

// DS18B20 trả -127.0°C khi mất kết nối vật lý (DallasTemperature constant).
// FE phải check & hiển thị '---' thay vì -127 để tránh hiểu nhầm.
const DS18B20_DISCONNECTED = -127;

// Giới hạn log lưu trong state để tránh memory leak.
const MAX_LOG_ENTRIES = 30;

/**
 * Hook subscribe MQTT topic `watersensor/esp32c3/data` và trả về:
 *  - data: object JSON mới nhất (rỗng `{}` khi chưa nhận được)
 *  - status: 'connecting' | 'connected' | 'disconnected' | 'error'
 *  - log: danh sách các message gần đây (timestamp + payload) để debug
 *  - lastSeen: thời điểm nhận được message cuối cùng (Date | null)
 *  - error: thông báo lỗi (nếu có)
 *
 * Auto-reconnect mỗi 2 giây khi mất kết nối. Cleanup khi component unmount.
 */
export function useWaterSensor({ enabled = true } = {}) {
  const [data, setData] = useState({});
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const [lastSeen, setLastSeen] = useState(null);
  const clientRef = useRef(null);

  const appendLog = useCallback((entry) => {
    setLog(prev => {
      const next = [entry, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return undefined;
    }

    setStatus('connecting');
    setError(null);

    // Chờ window.mqtt sẵn sàng (CDN có thể load chậm). Thử lại mỗi 100ms
    // tối đa 30 lần (~3s). Sau đó báo lỗi rõ ràng.
    let cancelled = false;
    let retryCount = 0;
    let client = null;

    const tryConnect = () => {
      if (cancelled) return;
      // eslint-disable-next-line no-undef
      const mqttLib = typeof window !== 'undefined' ? window.mqtt : null;
      if (!mqttLib) {
        retryCount += 1;
        if (retryCount > 30) {
          setStatus('error');
          setError('Không thể tải thư viện MQTT từ CDN. Kiểm tra mạng.');
          appendLog({ ts: new Date().toISOString(), level: 'error', msg: 'window.mqtt not loaded after 3s' });
          return;
        }
        setTimeout(tryConnect, 100);
        return;
      }

      // clean: true — không giữ session, reconnect sẽ là fresh subscription.
      // reconnectPeriod: 2000ms — đủ nhanh để recover khi WiFi ESP32 thoát sleep.
      // keepalive: 30s — match với interval 3s của ESP32.
      client = mqttLib.connect(BROKER_URL, {
        clean: true,
        reconnectPeriod: 2000,
        keepalive: 30,
        connectTimeout: 8000,
        clientId: `fe_researcher_${Math.random().toString(16).slice(2, 10)}`,
      });
      clientRef.current = client;

      client.on('connect', () => {
        setStatus('connected');
        setError(null);
        client.subscribe(TOPIC, { qos: 0 }, (err) => {
          if (err) {
            setError(`Subscribe lỗi: ${err.message}`);
            appendLog({ ts: new Date().toISOString(), level: 'error', msg: `Subscribe failed: ${err.message}` });
          } else {
            appendLog({ ts: new Date().toISOString(), level: 'info', msg: `✔ Subscribed ${TOPIC}` });
          }
        });
      });

      client.on('reconnect', () => {
        setStatus('connecting');
        appendLog({ ts: new Date().toISOString(), level: 'info', msg: '⟳ Reconnecting...' });
      });

      client.on('close', () => {
        setStatus('disconnected');
      });

      client.on('error', (err) => {
        setStatus('error');
        setError(err?.message || 'Lỗi MQTT không xác định');
        appendLog({ ts: new Date().toISOString(), level: 'error', msg: err?.message || 'MQTT error' });
      });

      client.on('message', (topic, payload) => {
        if (topic !== TOPIC) return;
        const raw = payload.toString();
        const ts = new Date().toISOString();
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          appendLog({ ts, level: 'error', msg: `JSON parse lỗi: ${raw.slice(0, 80)}` });
          return;
        }
        setData(parsed);
        setLastSeen(new Date());
        appendLog({ ts, level: 'data', msg: raw });
      });
    };

    tryConnect();

    return () => {
      cancelled = true;
      appendLog({ ts: new Date().toISOString(), level: 'info', msg: '⏹ Disconnect (cleanup)' });
      if (client) {
        try {
          client.end(true);
        } catch {
          // ignore
        }
      }
      clientRef.current = null;
    };
  }, [enabled, appendLog]);

  return { data, status, error, log, lastSeen, topic: TOPIC, broker: BROKER_URL };
}

// ── Helper format an toàn ────────────────────────────────────────────────────
// Tất cả formatter đều trả '---' khi giá trị undefined / null / NaN.
// Đặc biệt DS18B20 = -127 phải hiển thị '---' (cảm biến mất kết nối).

export const formatTemp = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return '---';
  return Number(v).toFixed(1);
};

export const formatDsTemp = (v) => {
  if (v === undefined || v === null) return '---';
  if (v === DS18B20_DISCONNECTED) return '---';
  if (Number.isNaN(v)) return '---';
  return Number(v).toFixed(2);
};

export const formatPercent = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return '---';
  return Number(v).toFixed(1);
};

export const formatPh = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return '---';
  return Number(v).toFixed(2);
};

// Đánh giá nhanh tình trạng cảm biến để tô màu card.
export const sensorHealth = (data) => {
  if (!data || Object.keys(data).length === 0) return 'idle';
  const ds = data.ds18b20_t;
  if (ds === DS18B20_DISCONNECTED || ds === undefined) return 'warning';
  const ph = data.ph;
  if (ph !== undefined && (ph < 4 || ph > 10)) return 'warning';
  return 'ok';
};
