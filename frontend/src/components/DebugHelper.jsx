// src/components/DebugHelper.jsx
import React, { useState } from 'react';

const DebugHelper = ({ apiResponse }) => {
  const [showFull, setShowFull] = useState(false);
  
  if (!apiResponse) {
    return <div>No API response to debug</div>;
  }
  
  const extractContent = () => {
    if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
      return apiResponse.choices[0].message.content;
    }
    return "No content found in API response";
  };
  
  const tryParseJson = (text) => {
    try {
      // Try to find JSON in the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try to parse the whole text as JSON
      return JSON.parse(text);
    } catch (e) {
      return `Error parsing JSON: ${e.message}`;
    }
  };
  
  const content = extractContent();
  const parsedJson = typeof content === 'string' ? tryParseJson(content) : "Content is not a string";

  return (
    <div style={{ 
      margin: '20px 0', 
      padding: '15px', 
      backgroundColor: '#f5f5f5', 
      border: '1px solid #ddd',
      borderRadius: '5px'
    }}>
      <h3 style={{ marginTop: 0 }}>API Response Debug</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => setShowFull(!showFull)}
          style={{
            padding: '5px 10px',
            backgroundColor: '#4361ee',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showFull ? 'Show Summary' : 'Show Full Response'}
        </button>
      </div>
      
      {showFull ? (
        <div>
          <h4>Full API Response:</h4>
          <pre style={{ 
            maxHeight: '500px', 
            overflow: 'auto',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            fontSize: '12px'
          }}>
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      ) : (
        <div>
          <h4>Response Structure:</h4>
          <ul>
            <li><strong>Has choices array:</strong> {apiResponse.choices ? 'Yes' : 'No'}</li>
            <li><strong>First choice has message:</strong> {apiResponse.choices?.[0]?.message ? 'Yes' : 'No'}</li>
            <li><strong>Message has content:</strong> {apiResponse.choices?.[0]?.message?.content ? 'Yes' : 'No'}</li>
          </ul>
          
          <h4>Content Sample:</h4>
          <pre style={{ 
            maxHeight: '200px', 
            overflow: 'auto',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            fontSize: '12px'
          }}>
            {typeof content === 'string' ? content.substring(0, 500) + '...' : 'Content is not a string'}
          </pre>
          
          <h4>Parsed JSON:</h4>
          <pre style={{ 
            maxHeight: '300px', 
            overflow: 'auto',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            fontSize: '12px'
          }}>
            {typeof parsedJson === 'object' ? 
              JSON.stringify(parsedJson, null, 2) : 
              parsedJson}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DebugHelper;
