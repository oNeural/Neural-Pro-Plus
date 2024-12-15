import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ProjectsView } from './components/ProjectsView';
import { EditorView } from './components/EditorView';
import { WelcomeTour } from './components/WelcomeTour';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { HomeView } from './components/HomeView';
import { NeuralBackground } from './components/NeuralBackground';
import { AnimatePresence } from 'framer-motion';
import './index.css';

const BackgroundWrapper: React.FC = () => {
  const location = useLocation();
  const isEditorPage = location.pathname.includes('/editor');
  return isEditorPage ? null : <NeuralBackground />;
};

const AppContent: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isWelcomeTourOpen, setIsWelcomeTourOpen] = React.useState(false);

  React.useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsWelcomeTourOpen(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900/50 text-gray-200 relative flex flex-col">
      <BackgroundWrapper />
      <Header 
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onHelpClick={() => setIsWelcomeTourOpen(true)}
      />
      
      <AnimatePresence>
        {isMobileMenuOpen && (
          <MobileNav 
            onClose={() => setIsMobileMenuOpen(false)}
            onHelpClick={() => {
              setIsWelcomeTourOpen(true);
              setIsMobileMenuOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 container mx-auto px-4 pt-20 pb-8 max-w-7xl relative">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/editor/:projectId?" element={<EditorView />} />
        </Routes>
      </main>

      <WelcomeTour 
        isOpen={isWelcomeTourOpen}
        onClose={() => setIsWelcomeTourOpen(false)}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;