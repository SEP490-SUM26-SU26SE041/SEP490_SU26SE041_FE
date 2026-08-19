import { useEffect, useRef } from 'react';
import { useFarm, TIME_STATES } from '../../context/FarmContext';
import '../../styles/FarmOverlay.css';

const SECTIONS = ['overview', 'planting', 'growing', 'monitoring'];

/* ── Controls Panel (time + weather) ── */
function ControlsPanel() {
  const { state, dispatch } = useFarm();

  const setTime = (t) => {
    dispatch({ type: 'SET_TIME', payload: t });
    document.body.classList.toggle('dark-ui', TIME_STATES[t].dark);
  };

  const setWeather = (w) => dispatch({ type: 'SET_WEATHER', payload: w });

  return (
    <div className="controls-panel">
      <div className="time-selector">
        {[
          { key: 'morning',   icon: '🌅', label: 'Sáng'   },
          { key: 'noon',      icon: '☀️', label: 'Trưa'     },
          { key: 'afternoon', icon: '🌇', label: 'Chiều'   },
          { key: 'evening',   icon: '🌙', label: 'Tối'    },
          { key: 'night',     icon: '🌌', label: 'Đêm'    },
        ].map(t => (
          <button
            key={t.key}
            className={`time-btn${state.timeOfDay === t.key ? ' active-time' : ''}`}
            onClick={() => setTime(t.key)}
          >
            <span>{t.icon}</span>
            <div className="time-label">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="weather-selector">
        {[
          { key: 'clear',    icon: '☀️', label: 'Nắng' },
          { key: 'rain',     icon: '🌧️', label: 'Mưa'  },
          { key: 'thunder',  icon: '⚡',  label: 'Bão' },
          { key: 'insects',  icon: '🐜',  label: 'Sâu'  },
          { key: 'disease',  icon: '🦠',  label: 'Bệnh' },
        ].map(w => (
          <button
            key={w.key}
            className={`weather-btn${state.currentWeather === w.key ? ' active-weather' : ''}`}
            onClick={() => setWeather(w.key)}
          >
            <span>{w.icon}</span>
            <div className="weather-label">{w.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Sensor Grid (section 3) ── */
function SensorGrid() {
  const { state, dispatch } = useFarm();
  const sd = state.sensorData;

  const getAIStatus = (v) => {
    if (v < 40) return 'Nguy Cấp';
    if (v < 70) return 'Cảnh Báo';
    if (v < 90) return 'Tốt';
    return 'Xuất Sắc';
  };

  return (
    <div className="sensor-grid">
      <div className="sensor-card">
        <div className="sensor-icon">💧</div>
        <div className="sensor-label">Độ Ẩm Đất</div>
        <div className="sensor-value">{sd.moisture.toFixed(0)}%</div>
        <div className="sensor-bar"><div className="sensor-fill" style={{ width: `${Math.min(sd.moisture, 100)}%`, background: '#3498db' }} /></div>
      </div>
      <div className="sensor-card">
        <div className="sensor-icon">🌡️</div>
        <div className="sensor-label">Nhiệt Độ</div>
        <div className="sensor-value">{sd.temperature.toFixed(1)}°C</div>
        <div className="sensor-bar"><div className="sensor-fill" style={{ width: `${sd.temperature / 45 * 100}%`, background: '#e74c3c' }} /></div>
      </div>
      <div className="sensor-card">
        <div className="sensor-icon">☀️</div>
        <div className="sensor-label">Cường Độ Ánh Sáng</div>
        <div className="sensor-value">{Math.round(sd.light)} lux</div>
        <div className="sensor-bar"><div className="sensor-fill" style={{ width: `${Math.min(sd.light / 1200 * 100, 100)}%`, background: '#f39c12' }} /></div>
      </div>
      <div className="sensor-card">
        <div className="sensor-icon">⚗️</div>
        <div className="sensor-label">Độ pH Đất</div>
        <div className="sensor-value">{sd.ph.toFixed(1)}</div>
        <div className="sensor-bar"><div className="sensor-fill" style={{ width: `${sd.ph / 14 * 100}%`, background: '#2ecc71' }} /></div>
      </div>
      <div className="sensor-card" style={{ gridColumn: 'span 2' }}>
        <div className="sensor-icon">📸</div>
        <div className="sensor-label">Camera AI</div>
        <div className="sensor-value">Tình Trạng Cây: {getAIStatus(sd.ai)} ({sd.ai.toFixed(0)}%)</div>
        <div className="sensor-bar"><div className="sensor-fill" style={{ width: `${Math.max(sd.ai, 0)}%`, background: '#95a5a6' }} /></div>
        <button
          className={`view-cam-btn${state.isAiViewActive ? ' active-cam' : ''}`}
          onClick={() => {
            if (state.isAiViewActive) {
              window.__aiPanOffset = { yaw: 0, pitch: 0 };
            }
            dispatch({ type: 'TOGGLE_AI' });
          }}
        >
          <span>{state.isAiViewActive ? '❌' : '👁️'}</span>
          <span>{state.isAiViewActive ? ' Đóng' : ' Xem Camera'}</span>
        </button>
      </div>
    </div>
  );
}

/* ── Planting Section ── */
function PlantingSection({ dispatch, state }) {
  const startSeeding = () => {
    dispatch({ type: 'SET_PLANTING', payload: 'seeding' });
    dispatch({ type: 'NOTIFY', text: 'Click chuột trái để rải hạt!', color: '#d35400' });
  };

  const triggerGermination = () => {
    dispatch({ type: 'SET_PLANTING', payload: 'germinating' });
    dispatch({ type: 'NOTIFY', text: 'Đang tưới nước...', color: '#3498db' });
    setTimeout(() => {
      dispatch({ type: 'SET_PLANTING', payload: 'germinated' });
      dispatch({ type: 'NOTIFY', text: 'Hạt giống đã nảy mầm!', color: '#2ecc71' });
    }, 3000);
  };

  return (
    <>
      <div className="btn-group">
        {state.plantingState === 'idle' && (
          <button className="action-btn" onClick={startSeeding}>
            <span>📦</span> Gieo hạt (Ươm mầm)
          </button>
        )}
        {state.plantingState === 'seeding' && (
          <button className="action-btn" disabled>
            🌱 Đang gieo hạt ({state.seedsPlanted}/15)
          </button>
        )}
        {state.plantingState === 'planted' && (
          <button className="action-btn" onClick={triggerGermination}>
            <span>💧</span> Tưới nước
          </button>
        )}
        {state.plantingState === 'germinated' && (
          <>
            <button className="action-btn" disabled style={{ background: '#2ecc71' }}>
              ✨ Đã nảy mầm!
            </button>
            <button className="action-btn" style={{ background: '#2c3e50' }}
              onClick={() => {
                dispatch({ type: 'NOTIFY', text: 'Cây đang vươn mình...', color: '#27ae60' });
                // We'll use a global flag for the 3D scene to see
                window.__fastGrowth = true;
                setTimeout(() => {
                  window.__fastGrowth = false;
                  dispatch({ type: 'SET_SECTION', payload: 2 });
                }, 2000);
              }}>
              Tiếp theo ➔
            </button>
          </>
        )}
      </div>
      <div className="info-cards">
        <div className="info-card"><div className="card-number">01</div><div><div className="card-title">Chuẩn Bị Đất</div><div className="card-detail">Phân hữu cơ giàu dinh dưỡng được trộn theo tỷ lệ chính xác</div></div></div>
        <div className="info-card"><div className="card-number">02</div><div><div className="card-title">Đặt Hạt Giống</div><div className="card-detail">Kiểm soát độ sâu tự động ở khoảng 2-3cm</div></div></div>
        <div className="info-card"><div className="card-number">03</div><div><div className="card-title">Tưới Nước Lần Đầu</div><div className="card-detail">Mức độ ẩm được kiểm soát để nảy mầm</div></div></div>
      </div>
    </>
  );
}

/* ─────────────── FARM OVERLAY ─────────────── */
export default function FarmOverlay() {
  const { state, dispatch } = useFarm();
  const notifyTimer = useRef(null);

  // Clear notification after 2s
  useEffect(() => {
    if (state.notification) {
      clearTimeout(notifyTimer.current);
      notifyTimer.current = setTimeout(() => dispatch({ type: 'CLEAR_NOTIFY' }), 2000);
    }
  }, [state.notification, dispatch]);

  // Pan camera by dragging inside PiP (stores offset in window ref for FarmScene to consume)
  const panDragRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  const onPanDown = (e) => {
    panDragRef.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onPanMove = (e) => {
    if (!panDragRef.current.isDragging) return;
    const dx = e.clientX - panDragRef.current.lastX;
    const dy = e.clientY - panDragRef.current.lastY;
    panDragRef.current.lastX = e.clientX;
    panDragRef.current.lastY = e.clientY;
    if (!window.__aiPanOffset) window.__aiPanOffset = { yaw: 0, pitch: 0 };
    window.__aiPanOffset.yaw   = Math.max(-60, Math.min(60, window.__aiPanOffset.yaw   - dx * 0.3));
    window.__aiPanOffset.pitch = Math.max(-30, Math.min(30, window.__aiPanOffset.pitch - dy * 0.3));
    e.stopPropagation();
  };
  const onPanUp = (e) => {
    panDragRef.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const goTo = (s) => dispatch({ type: 'SET_SECTION', payload: s });

  return (
    <div id="ui-overlay">
      {/* Header */}
      <header className="header">
        <div className="logo">Vườn Ươm Thực Nghiệm Thông Minh SEP490</div>
        <nav className="nav">
          {['Tổng Quan', 'Gieo Trồng', 'Phát Triển', 'Giám Sát'].map((name, i) => (
            <button
              key={i}
              className={`nav-link${state.currentSection === i ? ' active' : ''}`}
              onClick={() => goTo(i)}
            >
              {name}
            </button>
          ))}
        </nav>
        <button className="cart-btn" onClick={() => {
          window.history.pushState(null, '', '/login');
          window.dispatchEvent(new Event('navigate'));
        }}>Đăng Nhập ↗</button>
      </header>

      {/* Section: Overview */}
      <div className={`section-content${state.currentSection !== 0 ? ' hidden' : ''}`}>
        <div className="section-label">(A)</div>
        <h1 className="section-title">Từ Hạt Giống<br />Đến Cảm Biến</h1>
        <p className="section-desc">Mô hình hoàn chỉnh cho nông nghiệp thông minh — từ gieo trồng đến giám sát IoT thời gian thực. Cuộn xuống để khám phá từng giai đoạn.</p>
        <div className="scroll-hint"><div className="scroll-arrow">↓</div><span>Cuộn xuống để khám phá</span></div>
      </div>

      {/* Section: Planting */}
      <div className={`section-content${state.currentSection !== 1 ? ' hidden' : ''}`}>
        <div className="section-label">(B)</div>
        <h1 className="section-title">Gieo Trồng</h1>
        <p className="section-desc">Hạt giống được đặt cẩn thận trong luống đất đã chuẩn bị với khoảng cách tối ưu. Mỗi lần click chuột trái, hạt giống sẽ rơi từ túi xuống.</p>
        <PlantingSection dispatch={dispatch} state={state} />
      </div>

      {/* Section: Growing */}
      <div className={`section-content${state.currentSection !== 2 ? ' hidden' : ''}`}>
        <div className="section-label">(C)</div>
        <h1 className="section-title">Phát Triển</h1>
        <p className="section-desc">Quan sát hạt giống chuyển đổi thành cây phát triển mạnh. Mỗi giai đoạn được theo dõi và tối ưu hóa thông qua giám sát môi trường liên tục.</p>
        <div className="growth-timeline">
          {['Tuần 1 — Nảy Mầm', 'Tuần 3 — Giai Đoạn Mầm', 'Tuần 6 — Sinh Trưởng Thực Vật', 'Tuần 10 — Ra Hoa'].map((t, i) => (
            <div key={i} className={`timeline-item${i === 0 ? ' active-tl' : ''}`}>
              <div className="timeline-dot" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Monitoring */}
      <div className={`section-content${state.currentSection !== 3 ? ' hidden' : ''}`}>
        <div className="section-label">(D)</div>
        <h1 className="section-title">Giám Sát</h1>
        <p className="section-desc">Cảm biến IoT thu thập dữ liệu thời gian thực và truyền đến cổng trung tâm. Tất cả chỉ số có thể truy cập qua bảng điều khiển đám mây.</p>
        <SensorGrid />
      </div>

      {/* AI View — fixed position, drag inside to pan camera */}
      {state.isAiViewActive && (
        <div className="ai-view-container">
          {/* Drag zone — covers the whole frame, behind the controls */}
          <div
            className="ai-pan-zone"
            onPointerDown={onPanDown}
            onPointerMove={onPanMove}
            onPointerUp={onPanUp}
            onPointerCancel={onPanUp}
          />
          <div className="ai-view-label"><span className="live-dot">●</span> LIVE</div>
          <div className="ai-pan-hint">⟵ Drag to pan ⟶</div>
          <div className="zoom-controls">
            <button className="zoom-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => dispatch({ type: 'SET_AI_ZOOM', payload: 1 })}>+</button>
            <button className="zoom-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => dispatch({ type: 'SET_AI_ZOOM', payload: -1 })}>−</button>
          </div>
        </div>
      )}

      {/* Nav dots */}
      <div className="section-dots">
        {SECTIONS.map((_, i) => (
          <button key={i} className={`dot${state.currentSection === i ? ' active-dot' : ''}`} onClick={() => goTo(i)} />
        ))}
      </div>

      {/* Notification */}
      {state.notification && (
        <div className="notification" style={{ borderColor: state.notification.color, color: state.notification.color }}>
          📡 {state.notification.text}
        </div>
      )}

      {/* Controls panel */}
      <ControlsPanel />
    </div>
  );
}
