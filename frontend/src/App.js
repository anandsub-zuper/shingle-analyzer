// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { RoofAnalyzer } from './components';
import InsuranceReportGenerator from './components/insurance/InsuranceReportGenerator';
import './App.css';

// Create a wrapper component to handle location changes
function AppContent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === '/3d-modeling') {
      return '3d';
    } else if (location.pathname === '/insurance-report') {
      return 'insurance';
    } else {
      return 'roof';
    }
  });

  // For sharing analysis results between routes
  const [analysisResults, setAnalysisResults] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);

  // Update active tab when location changes
  useEffect(() => {
    if (location.pathname === '/3d-modeling') {
      setActiveTab('3d');
    } else if (location.pathname === '/insurance-report') {
      setActiveTab('insurance');
    } else {
      setActiveTab('roof');
    }
  }, [location]);

  // Handler for when analysis is completed
  const handleAnalysisComplete = (results, imageData) => {
    setAnalysisResults(results);
    setUploadedImage(imageData);
  };

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
            to="/insurance-report"
            className={`nav-link ${activeTab === 'insurance' ? 'active' : ''}`}
            onClick={() => setActiveTab('insurance')}
          >
            Insurance Report
          </Link>
          <Link
            to="/3d-modeling"
            className={`nav-link ${activeTab === '3d' ? 'active' : ''} coming-soon`}
            onClick={() => setActiveTab('3d')}
          >
            3D Modeling
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route 
            path="/" 
            element={
              <RoofAnalyzer 
                onAnalysisComplete={handleAnalysisComplete} 
              />
            } 
          />
          <Route 
            path="/insurance-report" 
            element={
              <InsuranceReportGenerator 
                analysisResults={analysisResults}
                damageAssessment={analysisResults?.specifications?.damageAssessment || {}}
                materialSpecs={analysisResults?.specifications || {}}
                costEstimates={analysisResults?.specifications?.damageAssessment?.costEstimates || {}}
                uploadedImage={uploadedImage}
              />
            } 
          />
          <Route path="/3d-modeling" element={<ComingSoonPage />} />
        </Routes>
      </main>

      <footer className="App-footer">
        <div className="footer-content">
          <p className="footer-item">
            <span className="footer-label">Roof Analysis:</span>
            <span className="footer-value">Powered by OpenAI Vision API</span>
          </p>
          <p className="footer-item">
            <span className="footer-label">Location Detection:</span>
            <span className="footer-value">Google Maps Geocoding API</span>
          </p>
          <p className="footer-item">
            <span className="footer-label">Property Data:</span>
            <span className="footer-value">RentCast Property API</span>
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
        <div className="coming-soon-badge">Now Available</div>
        <p className="coming-soon-description">
          Our advanced 3D modeling technology allows you to:
        </p>
        <ul className="coming-soon-features">
          <li>Create detailed 3D models from multiple roof images</li>
          <li>Calculate precise roof measurements and dimensions</li>
          <li>Identify structural elements and potential issues</li>
          <li>Generate accurate cost estimates for repairs or replacement</li>
        </ul>
        <p className="coming-soon-subscribe">
          Upload multiple images of your roof to get started!
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
