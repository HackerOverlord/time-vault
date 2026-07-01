'use client';

import { useState } from 'react';
// Import your views directly as components
import LoginView from './login/page';
import RegisterView from './register/page';
import DashboardView from './dashboard/page';

export type ScreenState = 'login' | 'register' | 'dashboard';

export default function SinglePageApp() {
  // Set the starting screen
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('login');

  // Central function to shift views
  const handleNavigate = (nextScreen: ScreenState) => {
    setCurrentScreen(nextScreen);
  };

  // Dynamically swap the layout in place based on our state
  return (
    <div className="min-h-screen bg-black text-white">
      {currentScreen === 'login' && (
        <LoginView onNavigate={handleNavigate} />
      )}
      
      {currentScreen === 'register' && (
        <RegisterView onNavigate={handleNavigate} />
      )}
      
      {currentScreen === 'dashboard' && (
        <DashboardView onNavigate={handleNavigate} />
      )}
    </div>
  );
}
