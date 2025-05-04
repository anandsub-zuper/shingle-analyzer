// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { RoofAnalyzer } from './components';
import './App.css';

// Create a wrapper component to handle location changes
function AppContent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === '/3d-modeling') {
      return '3d';
    } else {
      return 'roof';
    }
  });

  // Update active tab when location changes
  useEffect(() => {
    if (location.pathname === '/3d-modeling') {
      setActiveTab('3d');
    } else {
      setActiveTab('roof');
    }
  }, [location]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Roof Analyzer</h1>
        <p>Upload roof images for AI-powered analysis</p>

        <nav className="main-nav">
          <Link
            to="/"
            className={`nav-link ${activeTab === 'roof' ? 'active' : ''}`}
            onClick={() => setActiveTab('roof')}
          >
            Roof Analysis
          </Link>
          <Link
            to="/3d-modeling"
            className={`nav-link ${activeTab === '3d' ? 'active' : ''} coming-soon`}
            onClick={() => setActiveTab('3d')}
          >
            3D Modeling (Coming Soon)
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<RoofAnalyzer />} />
          <Route path="/3d-modeling" element={<ComingSoonPage />} />
        </Routes>
      </main>

      <footer className="App-footer">
        <div className="footer-content">
          <p className="footer-item">
            <span className="footer-label">Roof Analysis:</span>
            <span className="footer-value">Powered by OpenAI Vision API</span>
          </p>
        </div>
        <p className="copyright">© 2025 Roof Analyzer - All Rights Reserved</p>
      </footer>
    </div>
  );
}

// Simple coming soon page component
function ComingSoonPage() {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-content">
        <h2>3D Roof Modeling</h2>
        <div className="coming-soon-badge">Coming Soon</div>
        <p className="coming-soon-description">
          We're working on advanced 3D modeling technology that will allow you to:
        </p>
        <ul className="coming-soon-features">
          <li>Create detailed 3D models from multiple roof images</li>
          <li>Calculate precise roof measurements and dimensions</li>
          <li>Identify structural elements and potential issues</li>
          <li>Generate accurate cost estimates for repairs or replacement</li>
        </ul>
        <p className="coming-soon-subscribe">
          Stay tuned for this exciting new feature!
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
