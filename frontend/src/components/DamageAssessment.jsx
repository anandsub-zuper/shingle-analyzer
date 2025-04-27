// src/components/DamageAssessment.jsx
import React from 'react';

const DamageAssessment = ({ damageData }) => {
  if (!damageData) return null;

  // Define severity color scale
  const getSeverityColor = (severity) => {
    if (severity <= 3) return '#4CAF50'; // Green for minor
    if (severity <= 6) return '#FFC107'; // Yellow for moderate
    if (severity <= 8) return '#FF9800'; // Orange for significant
    return '#F44336'; // Red for severe
  };

  // Map condition to icon/color
  const getConditionDisplay = (condition) => {
    switch(condition.toLowerCase()) {
      case 'excellent':
        return { icon: '✓✓', color: '#4CAF50', description: 'No visible damage, like-new condition' };
      case 'good':
        return { icon: '✓', color: '#8BC34A', description: 'Minor wear, fully functional' };
      case 'fair':
        return { icon: '⚠️', color: '#FFC107', description: 'Noticeable wear, may need attention soon' };
      case 'poor':
        return { icon: '❗', color: '#F44336', description: 'Significant damage, needs immediate attention' };
      default:
        return { icon: '?', color: '#9E9E9E', description: 'Unknown condition' };
    }
  };

  const conditionDisplay = getConditionDisplay(damageData.overallCondition || 'Unknown');

  return (
    <div className="damage-assessment">
      <h3 className="damage-header">Damage Assessment</h3>
      
      <div className="condition-indicator" style={{ backgroundColor: conditionDisplay.color }}>
        <span className="condition-icon">{conditionDisplay.icon}</span>
        <span className="condition-text">{damageData.overallCondition || 'Unknown'}</span>
      </div>
      
      <div className="condition-description">
        {conditionDisplay.description}
      </div>
      
      {damageData.damageTypes && damageData.damageTypes.length > 0 ? (
        <div className="damage-types">
          <h4>Detected Issues:</h4>
          <ul className="damage-list">
            {damageData.damageTypes.map((damage, index) => (
              <li key={index} className="damage-item">
                {damage}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="no-damage-message">No specific damage detected.</p>
      )}
      
      {damageData.severity && (
        <div className="severity-meter">
          <h4>Severity Level: {damageData.severity}/10</h4>
          <div className="meter-background">
            <div 
              className="meter-fill" 
              style={{ 
                width: `${damageData.severity * 10}%`,
                backgroundColor: getSeverityColor(damageData.severity)
              }} 
            />
          </div>
        </div>
      )}
      
      {damageData.description && (
        <div className="damage-description">
          <h4>Details:</h4>
          <p>{damageData.description}</p>
        </div>
      )}
      
      {damageData.recommendedAction && (
        <div className="recommended-action">
          <h4>Recommended Action:</h4>
          <p>{damageData.recommendedAction}</p>
        </div>
      )}
    </div>
  );
};

export default DamageAssessment;
