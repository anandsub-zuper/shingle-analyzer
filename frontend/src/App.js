// src/App.js
import React from 'react';
import ShingleAnalyzer from './components/ShingleAnalyzer';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Roofing Shingle Analyzer</h1>
        <p>Upload a shingle image to identify its specifications using AI</p>
      </header>
      <main>
        <ShingleAnalyzer />
      </main>
      <footer className="App-footer">
        <p>Powered by OpenAI Vision API</p>
      </footer>
    </div>
  );
}

export default App;
