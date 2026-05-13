import React, { useState, useEffect } from 'react';
import { FarmProvider } from './context/FarmContext';
import Simulation from './pages/Simulation';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import FarmManagerDashboard from './pages/farm-manager/FarmManagerDashboard';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import ResearcherDashboard from './pages/researcher/ResearcherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import AIAssistantDashboard from './pages/ai-assistant/AIAssistantDashboard';

const App = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleNavigate = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('popstate', handleNavigate);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('popstate', handleNavigate);
    };
  }, []);

  const renderView = () => {
    switch (currentPath) {
      case '/login':
        return <Login />;
      case '/admin':
        return <AdminDashboard />;
      case '/farm-manager':
        return <FarmManagerDashboard />;
      case '/technician':
        return <TechnicianDashboard />;
      case '/researcher':
        return <ResearcherDashboard />;
      case '/student':
        return <StudentDashboard />;
      case '/ai-assistant':
        return <AIAssistantDashboard />;
      case '/':
      default:
        return <Simulation />;
    }
  };

  return (
    <FarmProvider>
      <div className="app-container">
        {renderView()}
      </div>
    </FarmProvider>
  );
};

export default App;
