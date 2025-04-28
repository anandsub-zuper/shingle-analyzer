// In App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ShingleAnalyzer from './components/ShingleAnalyzer';
import ThreeDRoofAnalyzer from './components/ThreeDRoofAnalyzer';
import './App.css';

// Create a wrapper component to handle location changes
function AppContent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.pathname === '/3d-analyzer' ? '3d' : 'shingle'
  );

  // Update active tab when location changes
  useEffect(() => {
    if (location.pathname === '/3d-analyzer') {
      setActiveTab('3d');
    } else {
      setActiveTab('shingle');
    }
  }, [location]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Roofing Shingle Analyzer</h1>
        <p>Upload a shingle image or multiple roof images for AI-powered analysis</p>
        
        <nav className="main-nav">
          <Link 
            to="/" 
            className={`nav-link ${activeTab === 'shingle' ? 'active' : ''}`}
            onClick={() => setActiveTab('shingle')}
          >
            Single Shingle Analysis
          </Link>
          <Link 
            to="/3d-analyzer" 
            className={`nav-link ${activeTab === '3d' ? 'active' : ''}`}
            onClick={() => setActiveTab('3d')}
          >
            3D Roof Analysis
          </Link>
        </nav>
      </header>
      
      <main>
        <Routes>
          <Route path="/" element={<ShingleAnalyzer />} />
          <Route path="/3d-analyzer" element={<ThreeDRoofAnalyzer />} />
        </Routes>
      </main>
      
      <footer className="App-footer">
        <div className="footer-content">
          <p className="footer-item">
            <span className="footer-label">Shingle Analysis:</span>
            <span className="footer-value">Powered by OpenAI Vision API</span>
          </p>
          <p className="footer-item">
            <span className="footer-label">3D Roof Analysis:</span>
            <span className="footer-value">Powered by Neural Radiance Fields</span>
          </p>
        </div>
        <p className="copyright">© 2025 Roofing Analyzer - All Rights Reserved</p>
      </footer>
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
