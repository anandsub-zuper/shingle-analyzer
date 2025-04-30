// src/components/LoadingSpinner.jsx
import React, { useState, useEffect } from 'react';

const LoadingSpinner = ({ isLoading, loadingText = "Analyzing..." }) => {
  const [progress, setProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState(0);
  
  const loadingPhases = [
    "Initializing analysis...",
    "Detecting roof material...",
    "Identifying patterns...",
    "Analyzing potential damage...",
    "Calculating specifications...",
    "Generating recommendations...",
    "Finalizing results..."
  ];

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setLoadingPhase(0);
      return;
    }

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(prevProgress => {
        // Progress increases more slowly as it gets higher
        const increment = Math.max(1, 5 - Math.floor(prevProgress / 20));
        const newProgress = Math.min(95, prevProgress + increment);
        
        // Update loading phase based on progress
        if (newProgress > loadingPhase * 15 + 10 && loadingPhase < loadingPhases.length - 1) {
          setLoadingPhase(prevPhase => prevPhase + 1);
        }
        
        return newProgress;
      });
    }, 600);

    return () => clearInterval(progressInterval);
  }, [isLoading, loadingPhase]);

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-spinner-container">
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner"></div>
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-percentage">{progress}%</div>
          </div>
        </div>
        <div className="loading-text">{loadingPhases[loadingPhase]}</div>
        <div className="loading-subtext">{loadingText}</div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
