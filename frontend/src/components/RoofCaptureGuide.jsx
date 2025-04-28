// src/components/RoofCaptureGuide.jsx
import React from 'react';

const RoofCaptureGuide = () => {
  return (
    <div className="roof-capture-guide">
      <h3 className="section-subtitle">How to Capture Roof Images for 3D Modeling</h3>
      
      <div className="capture-tips">
        <div className="tip-card">
          <div className="tip-icon">📸</div>
          <h4>Take 8-15 Photos</h4>
          <p>For best results, capture 8-15 photos of your roof from different angles. More photos generally lead to better 3D models.</p>
        </div>

        <div className="tip-card">
          <div className="tip-icon">🔄</div>
          <h4>Capture from Multiple Angles</h4>
          <p>Walk around the building and take photos from different positions. Try to maintain roughly 20-30 feet from the building.</p>
        </div>

        <div className="tip-card">
          <div className="tip-icon">🌞</div>
          <h4>Good Lighting Conditions</h4>
          <p>Shoot on a clear day with consistent lighting. Avoid harsh shadows, rain, or extremely bright conditions.</p>
        </div>

        <div className="tip-card">
          <div className="tip-icon">🔎</div>
          <h4>Focus on the Roof</h4>
          <p>Ensure the roof is clearly visible and occupies a significant portion of each photo.</p>
        </div>
      </div>

      <div className="example-images">
        <h4>Example Photo Positions</h4>
        <div className="examples-grid">
          <div className="example">
            <div className="example-image good">
              <img src="/images/guides/roof-photo-good1.jpg" alt="Good roof photo example" />
            </div>
            <p className="example-caption positive">✓ Good: Clear view of roof from ground level</p>
          </div>
          
          <div className="example">
            <div className="example-image good">
              <img src="/images/guides/roof-photo-good2.jpg" alt="Good roof photo example with overlap" />
            </div>
            <p className="example-caption positive">✓ Good: Overlapping with previous photo</p>
          </div>
          
          <div className="example">
            <div className="example-image bad">
              <img src="/images/guides/roof-photo-bad1.jpg" alt="Bad roof photo with obstacles" />
            </div>
            <p className="example-caption negative">✗ Avoid: Trees or objects blocking the view</p>
          </div>
          
          <div className="example">
            <div className="example-image bad">
              <img src="/images/guides/roof-photo-bad2.jpg" alt="Bad roof photo too far away" />
            </div>
            <p className="example-caption negative">✗ Avoid: Photos that are too distant</p>
          </div>
        </div>
      </div>

      <div className="capture-diagram">
        <h4>Recommended Photo Positions</h4>
        <img 
          src="/images/guides/roof-capture-positions.svg" 
          alt="Diagram showing recommended positions for taking roof photos" 
          className="diagram-image"
        />
        <p className="diagram-caption">
          Take photos from multiple positions around the building, keeping the roof clearly visible in each shot. 
          Aim for 30-40% overlap between consecutive images.
        </p>
      </div>

      <div className="additional-tips">
        <h4>Additional Tips</h4>
        <ul className="tips-list">
          <li>Use the highest resolution your camera supports</li>
          <li>Keep the camera steady to avoid motion blur</li>
          <li>Include corner shots to capture the full 3D structure</li>
          <li>If possible, include some elevated angles (from a higher window, deck, or ladder)</li>
          <li>Ensure every part of the roof appears in at least 3 different photos</li>
        </ul>
      </div>
    </div>
  );
};

export default RoofCaptureGuide;
