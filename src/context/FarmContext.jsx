import { createContext, useContext, useReducer } from 'react';

export const TIME_STATES = {
  morning:   { bgHex: 0xf5f3ef, fogHex: 0xf5f3ef, lightHex: 0xfff5e6, intensity: 1.2, moisture: 75, temp: 22, lux: 450,  ph: 6.6, dark: false },
  noon:      { bgHex: 0xfffdfa, fogHex: 0xfffdfa, lightHex: 0xffffff, intensity: 1.6, moisture: 55, temp: 32, lux: 1100, ph: 6.4, dark: false },
  afternoon: { bgHex: 0xfff0e0, fogHex: 0xfff0e0, lightHex: 0xffd4a6, intensity: 1.3, moisture: 60, temp: 29, lux: 700,  ph: 6.5, dark: false },
  evening:   { bgHex: 0x2c3e50, fogHex: 0x1a252f, lightHex: 0x8e44ad, intensity: 0.6, moisture: 70, temp: 24, lux: 150,  ph: 6.7, dark: true  },
  night:     { bgHex: 0x0f172a, fogHex: 0x020617, lightHex: 0x1e293b, intensity: 0.3, moisture: 85, temp: 19, lux: 20,   ph: 6.8, dark: true  },
};

export const MAX_SEEDS = 15;

const initialState = {
  currentSection: 0,
  timeOfDay: 'morning',
  currentWeather: 'clear',   // clear | rain | thunder | insects | disease
  plantingState: 'idle',     // idle | seeding | planted | germinated
  seedsPlanted: 0,
  isAiViewActive: false,
  aiZoom: 1,
  notification: null,
  sensorData: { moisture: 65, temperature: 24, light: 780, ph: 6.5, ai: 95 },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SECTION':    return { ...state, currentSection: action.payload };
    case 'SET_TIME':       return { ...state, timeOfDay: action.payload };
    case 'SET_WEATHER':    return { ...state, currentWeather: action.payload };
    case 'SET_PLANTING':   return { ...state, plantingState: action.payload };
    case 'SET_SEEDS':      return { ...state, seedsPlanted: action.payload };
    case 'TOGGLE_AI':      return { ...state, isAiViewActive: !state.isAiViewActive, aiZoom: !state.isAiViewActive ? state.aiZoom : 1 };
    case 'SET_AI_ZOOM':    return { ...state, aiZoom: Math.max(0.5, Math.min(20, state.aiZoom + action.payload)) };
    case 'UPDATE_SENSORS': return { ...state, sensorData: action.payload };
    case 'NOTIFY':         return { ...state, notification: { text: action.text, color: action.color } };
    case 'CLEAR_NOTIFY':   return { ...state, notification: null };
    default:               return state;
  }
}

const FarmCtx = createContext(null);

export function FarmProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <FarmCtx.Provider value={{ state, dispatch }}>
      {children}
    </FarmCtx.Provider>
  );
}

export const useFarm = () => useContext(FarmCtx);
