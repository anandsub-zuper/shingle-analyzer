// src/components/DebugHelper.jsx
import React, { useState, useEffect } from 'react';
import '../styles/DebugHelper.css';

const DebugHelper = ({ apiResponse, error }) => {
  const [showFull, setShowFull] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({
    online: navigator.onLine,
    connectionType: 'unknown'
  });
  
  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setNetworkInfo(prev => ({ ...prev, online: true }));
    const handleOffline = () => setNetworkInfo(prev => ({ ...prev, online: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Try to get connection info if available in browser
    if ('connection' in navigator) {
      const updateConnectionInfo = () => {
        const connection = navigator.connection;
        setNetworkInfo(prev => ({
          ...prev,
          connectionType: connection.effectiveType || 'unknown',
          downlink: connection.downlink,
          rtt: connection.rtt
        }));
      };
      
      updateConnectionInfo();
      navigator.connection.addEventListener('change', updateConnectionInfo);
      
      return () => {
        navigator.connection.removeEventListener('change', updateConnectionInfo);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const extractContent = () => {
    if (!apiResponse) return null;
    
    if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
      return apiResponse.choices[0].message.content;
    }
    return "No content found in API response";
  };
  
  const content = extractContent();
  const jsonCodeBlockMatch = typeof content === 'string' && content.match(/```json\s*([\s\S]*?)(\s*```|$)/);
  const directJsonMatch = typeof content === 'string' && content.match(/(\{[\s\S]*\})/);
  
  return (
    <div className="debug-helper">
      <h3>Debug Information</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={() => setShowFull(!showFull)}
          className="debug-button"
        >
          {showFull ? 'Show Summary' : 'Show Full Response'}
        </button>
      </div>
      
      {/* Network Status Information */}
      <div className="debug-section">
        <h4>Network Status:</h4>
        <ul className="debug-list">
          <li><strong>Online:</strong> {networkInfo.online ? 'Yes' : 'No'}</li>
          {networkInfo.connectionType !== 'unknown' && (
            <>
              <li><strong>Connection Type:</strong> {networkInfo.connectionType}</li>
              {networkInfo.downlink && <li><strong>Downlink:</strong> {networkInfo.downlink} Mbps</li>}
              {networkInfo.rtt && <li><strong>Round-Trip Time:</strong> {networkInfo.rtt} ms</li>}
            </>
          )}
        </ul>
      </div>
      
      {/* Error Information */}
      {error && (
        <div className="debug-section error-section">
          <h4>Error Details:</h4>
          <div className="error-message-debug">
            {error}
          </div>
          <div className="error-troubleshooting">
            <h5>Possible Solutions:</h5>
            <ul className="debug-list">
              {error.includes('CORS') && (
                <>
                  <li>The server is configured to accept requests only from specific domains</li>
                  <li>Try reloading the page</li>
                  <li>The server might be temporarily unavailable</li>
                </>
              )}
              {error.includes('timeout') && (
                <>
                  <li>The server might be under heavy load</li>
                  <li>Your internet connection might be slow</li>
                  <li>Try uploading a smaller image</li>
                </>
              )}
              {error.includes('fetch') && (
                <>
                  <li>Check your internet connection</li>
                  <li>The server might be offline</li>
                  <li>Try again in a few minutes</li>
                </>
              )}
              {error.includes('channel closed') && (
                <>
                  <li>Browser extension might be interfering</li>
                  <li>Try using incognito mode</li>
                  <li>Clear browser cache and cookies</li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}
      
      {!showFull && apiResponse && (
        <div>
          <h4>Response Structure:</h4>
          <ul className="debug-list">
            <li><strong>Has choices array:</strong> {apiResponse.choices ? 'Yes' : 'No'}</li>
            <li><strong>First choice has message:</strong> {apiResponse.choices?.[0]?.message ? 'Yes' : 'No'}</li>
            <li><strong>Message has content:</strong> {apiResponse.choices?.[0]?.message?.content ? 'Yes' : 'No'}</li>
            <li><strong>Content type:</strong> {typeof apiResponse.choices?.[0]?.message?.content}</li>
            <li><strong>Has JSON code block:</strong> {jsonCodeBlockMatch ? 'Yes' : 'No'}</li>
            <li><strong>Has direct JSON:</strong> {directJsonMatch ? 'Yes' : 'No'}</li>
            <li><strong>Has parsedResults:</strong> {apiResponse.parsedResults ? 'Yes' : 'No'}</li>
          </ul>
          
          {content && (
            <>
              <h4>Content Sample:</h4>
              <div className="code-block">
                {typeof content === 'string' 
                  ? content.substring(0, 300) + (content.length > 300 ? '...' : '') 
                  : JSON.stringify(content, null, 2).substring(0, 300) + '...'}
              </div>
            </>
          )}
          
          {jsonCodeBlockMatch && (
            <div>
              <h4>JSON Code Block Sample:</h4>
              <div className="code-block">
                {jsonCodeBlockMatch[1].substring(0, 300) + (jsonCodeBlockMatch[1].length > 300 ? '...' : '')}
              </div>
            </div>
          )}
          
          {directJsonMatch && (
            <div>
              <h4>Direct JSON Sample:</h4>
              <div className="code-block">
                {directJsonMatch[1].substring(0, 300) + (directJsonMatch[1].length > 300 ? '...' : '')}
              </div>
            </div>
          )}
          
          {apiResponse.parsedResults && (
            <div>
              <h4>Parsed Results Sample:</h4>
              <div className="code-block">
                {JSON.stringify(apiResponse.parsedResults, null, 2).substring(0, 300) + '...'}
              </div>
            </div>
          )}
        </div>
      )}
      
      {showFull && apiResponse && (
        <div>
          <h4>Full API Response:</h4>
          <div className="code-block tall">
            {JSON.stringify(apiResponse, null, 2)}
          </div>
        </div>
      )}
      
      <div className="tips">
        <p><strong>Debugging Tips:</strong></p>
        <ul className="debug-list">
          <li className="tip-item">Look for errors in "Message has content" or "Content type"</li>
          <li className="tip-item">Check if JSON is properly detected in "Has JSON code block" or "Has direct JSON"</li>
          <li className="tip-item">Network issues often show up as "Failed to fetch" errors</li>
          <li className="tip-item">Race conditions appear when messages about "channel closed" occur</li>
          <li className="tip-item">If you're seeing CORS errors, the server might need configuration updates</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugHelper;
