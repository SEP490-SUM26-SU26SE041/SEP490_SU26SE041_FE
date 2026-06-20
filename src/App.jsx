import React, { useState, useEffect } from 'react';
import { FarmProvider } from './context/FarmContext';
import Simulation from './pages/Simulation';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import FarmManagerDashboard from './pages/farm-manager/FarmManagerDashboard';
import TechnicianDashboard from './pages/technician/TechnicianDashboard';
import ResearcherDashboard from './pages/researcher/ResearcherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import MorphologyDataEntry from './pages/student/MorphologyDataEntry';
import PersonalTaskList from './pages/PersonalTaskList';
import CareCompletionForm from './pages/CareCompletionForm';
import AIAssistantDashboard from './pages/ai-assistant/AIAssistantDashboard';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './context/ToastContext';

const App = () => {
  const GOOGLE_CLIENT_ID = "381864878555-tb9lhets0jsdrn431mvupkt4p2ip2l8i.apps.googleusercontent.com";
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
      case '/technician/task-list':
        return <PersonalTaskList />;
      case '/technician/care-completion':
        return <CareCompletionForm />;
      case '/researcher':
        return <ResearcherDashboard />;
      case '/student':
        return <StudentDashboard />;
      case '/student/morphology-entry':
        return <MorphologyDataEntry />;
      case '/student/task-list':
        return <PersonalTaskList />;
      case '/student/care-completion':
        return <CareCompletionForm />;
      case '/ai-assistant':
        return <AIAssistantDashboard />;
      case '/':
      default:
        return <Simulation />;
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        <FarmProvider>
          <div className="app-container">
            {renderView()}
          </div>
        </FarmProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
