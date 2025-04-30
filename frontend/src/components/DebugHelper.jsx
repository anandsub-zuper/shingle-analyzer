// src/components/DebugHelper.jsx
import React, { useState, useEffect } from 'react';
import { extractJsonFromContent, attemptJsonRepair } from '../utils/jsonUtils';

const DebugHelper = ({ apiResponse, className = '' }) => {
  const [showFull, setShowFull] = useState(false);
  const [repairAttempt, setRepairAttempt] = useState(null);
  
  // Try to repair JSON when the component mounts
  useEffect(() => {
    if (apiResponse && apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
      const content = apiResponse.choices[0].message.content;
      if (typeof content === 'string') {
        // Try to repair the JSON
        const repairedJson = attemptJsonRepair(content);
        try {
          // Try to extract JSON from the repaired content
          const extractedJson = extractJsonFromContent(repairedJson);
          if (extractedJson) {
            setRepairAttempt({
              success: true,
              repaired: repairedJson,
              parsed: extractedJson
            });
          } else {
            setRepairAttempt({
              success: false,
              repaired: repairedJson,
              error: "Could not extract JSON after repair"
            });
          }
        } catch (e) {
          setRepairAttempt({
            success: false,
            repaired: repairedJson,
            error: e.message
          });
        }
      }
    }
  }, [apiResponse]);
  
  if (!apiResponse) {
    return <div className={`debug-empty ${className}`}>No API response to debug</div>;
  }
  
  const extractContent = () => {
    if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
      return apiResponse.choices[0].message.content;
    }
    return "No content found in API response";
  };
  
  const content = extractContent();
  const jsonCodeBlockMatch = typeof content === 'string' && content.match(/```json\s*([\s\S]*?)(\s*```|$)/);
  const directJsonMatch = typeof content === 'string' && content.match(/(\{[\s\S]*\})/);
  
  return (
    <div className={`debug-helper ${className}`} style={{ 
      margin: '20px 0', 
      padding: '15px', 
      backgroundColor: '#f8f9fc', 
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <h3 style={{ 
        marginTop: 0, 
        color: '#2d3748', 
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '8px'
      }}>API Response Debug</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={() => setShowFull(!showFull)}
          style={{
            padding: '8px 12px',
            backgroundColor: '#4361ee',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          {showFull ? 'Show Summary' : 'Show Full Response'}
        </button>
      </div>
      
      {!showFull && (
        <div>
          <h4 style={{ color: '#4a5568', marginBottom: '8px' }}>Response Structure:</h4>
          <ul style={{ backgroundColor: 'white', padding: '12px', borderRadius: '6px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
            <li><strong>Has choices array:</strong> {apiResponse.choices ? 'Yes' : 'No'}</li>
            <li><strong>First choice has message:</strong> {apiResponse.choices?.[0]?.message ? 'Yes' : 'No'}</li>
            <li><strong>Message has content:</strong> {apiResponse.choices?.[0]?.message?.content ? 'Yes' : 'No'}</li>
            <li><strong>Content type:</strong> {typeof apiResponse.choices?.[0]?.message?.content}</li>
            <li><strong>Has JSON code block:</strong> {jsonCodeBlockMatch ? 'Yes' : 'No'}</li>
            <li><strong>Has direct JSON:</strong> {directJsonMatch ? 'Yes' : 'No'}</li>
            <li><strong>Has parsedResults:</strong> {apiResponse.parsedResults ? 'Yes' : 'No'}</li>
          </ul>
          
          <h4 style={{ color: '#4a5568', marginTop: '15px', marginBottom: '8px' }}>Content Sample:</h4>
          <div style={{ 
            maxHeight: '200px', 
            overflow: 'auto',
            padding: '12px',
            backgroundColor: '#1a202c',
            color: '#e2e8f0',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontFamily: 'monospace'
          }}>
            {typeof content === 'string' 
              ? content.substring(0, 700) + (content.length > 700 ? '...' : '') 
              : JSON.stringify(content, null, 2).substring(0, 700) + '...'}
          </div>
          
          {jsonCodeBlockMatch && (
            <div>
              <h4 style={{ color: '#4a5568', marginTop: '15px', marginBottom: '8px' }}>JSON Code Block:</h4>
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                padding: '12px',
                backgroundColor: '#1a202c',
                color: '#e2e8f0',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                {jsonCodeBlockMatch[1].substring(0, 700) + (jsonCodeBlockMatch[1].length > 700 ? '...' : '')}
              </div>
            </div>
          )}
          
          {directJsonMatch && (
            <div>
              <h4 style={{ color: '#4a5568', marginTop: '15px', marginBottom: '8px' }}>Direct JSON:</h4>
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                padding: '12px',
                backgroundColor: '#1a202c',
                color: '#e2e8f0',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                {directJsonMatch[1].substring(0, 700) + (directJsonMatch[1].length > 700 ? '...' : '')}
              </div>
            </div>
          )}
          
          {apiResponse.parsedResults && (
            <div>
              <h4 style={{ color: '#4a5568', marginTop: '15px', marginBottom: '8px' }}>Parsed Results:</h4>
              <div style={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                padding: '12px',
                backgroundColor: '#1a202c',
                color: '#e2e8f0',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(apiResponse.parsedResults, null, 2).substring(0, 700) + '...'}
              </div>
            </div>
          )}
          
          {repairAttempt && (
            <div>
              <h4 style={{ 
                color: repairAttempt.success ? '#38a169' : '#e53e3e', 
                marginTop: '15px', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '8px' }}>{repairAttempt.success ? '✅' : '❌'}</span>
                JSON Repair Attempt:
              </h4>
              {repairAttempt.success ? (
                <div style={{ 
                  maxHeight: '200px', 
                  overflow: 'auto',
                  padding: '12px',
                  backgroundColor: '#1a202c',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace'
                }}>
                  {JSON.stringify(repairAttempt.parsed, null, 2).substring(0, 700) + '...'}
                </div>
              ) : (
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#fed7d7',
                  color: '#822727',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  <strong>Error:</strong> {repairAttempt.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {showFull && (
        <div>
          <h4 style={{ color: '#4a5568', marginBottom: '8px' }}>Full API Response:</h4>
          <pre style={{ 
            maxHeight: '500px', 
            overflow: 'auto',
            padding: '12px',
            backgroundColor: '#1a202c',
            color: '#e2e8f0',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontFamily: 'monospace'
          }}>
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ 
        marginTop: '15px', 
        paddingTop: '15px', 
        borderTop: '1px solid #e2e8f0', 
        fontSize: '0.9rem',
        color: '#718096'
      }}>
        <p style={{ margin: '0' }}>Debug tips:</p>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Check if the response contains valid JSON structure</li>
          <li>Look for JSON in code blocks (```json ... ```)</li>
          <li>Check if backend extracted parsedResults</li>
          <li>If no structured data, try manual extraction</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugHelper;
