// src/components/MultiImageUploader.jsx
import React, { useState, useEffect } from 'react';
import { checkServerStatus } from '../api/RoofModelingAPI';
import '../styles/MultiImageUploader.css';

const MultiImageUploader = ({ onImagesSelected, maxImages = 15 }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [serverMessage, setServerMessage] = useState('Checking 3D server status...');

  // Check server status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkServerStatus();
        setServerStatus(status.status === 'online' ? 'online' : 'offline');
        setServerMessage(status.message || (status.status === 'online' 
          ? 'Server is online and ready for processing'
          : 'Server is currently offline or unavailable'));
      } catch (error) {
        setServerStatus('offline');
        setServerMessage('Could not connect to 3D processing server');
      }
    };

    checkStatus();
  }, []);

  // Generate previews whenever selected files change
  useEffect(() => {
    const newPreviews = [];
    
    // Clean up previous preview URLs
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    
    // Create new preview URLs
    selectedFiles.forEach(file => {
      newPreviews.push({
        file,
        url: URL.createObjectURL(file)
      });
    });
    
    setPreviews(newPreviews);
    
    // Call the callback with the selected files
    if (onImagesSelected) {
      onImagesSelected(selectedFiles);
    }
    
    // Clean up preview URLs when component unmounts
    return () => {
      newPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFiles, onImagesSelected]);

  // Handle file selection via input
  const handleFileSelect = (event) => {
    const files = event.target.files;
    
    if (files.length > 0) {
      addFiles(files);
    }
  };

  // Handle drag events
  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle file drop
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    
    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
    }
  };

  // Add files to the selection
  const addFiles = (fileList) => {
    const validFiles = [];
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    
    // Convert FileList to array and filter valid image files
    Array.from(fileList).forEach(file => {
      if (validTypes.includes(file.type)) {
        validFiles.push(file);
      }
    });
    
    // Limit to max number of images
    const totalFiles = [...selectedFiles, ...validFiles].slice(0, maxImages);
    setSelectedFiles(totalFiles);
  };

  // Remove a file from the selection
  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Clear all selected files
  const clearFiles = () => {
    setSelectedFiles([]);
  };

  return (
    <div className="multi-image-uploader">
      {/* Server status indicator */}
      <div className={`server-status ${serverStatus}`}>
        <div className="status-icon"></div>
        <div className="status-message">{serverMessage}</div>
      </div>
      
      {/* Drag and drop area */}
      <div 
        className={`upload-area ${dragActive ? 'active' : ''} ${serverStatus === 'offline' ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/jpeg, image/png, image/jpg, image/webp"
          onChange={handleFileSelect}
          className="file-input"
          multiple
          disabled={serverStatus === 'offline'}
        />
        <div className="upload-icon">📸</div>
        <div className="upload-text">
          <p className="primary-text">Drag & drop roof images here</p>
          <p className="secondary-text">Or click to select files</p>
          <p className="help-text">Upload 8-15 images of your roof from different angles for best results</p>
        </div>
      </div>
      
      {/* Image preview grid */}
      {previews.length > 0 && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>{previews.length} {previews.length === 1 ? 'Image' : 'Images'} Selected</h3>
            <button className="clear-button" onClick={clearFiles}>Clear All</button>
          </div>
          
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div className="preview-item" key={index}>
                <div className="preview-image-container">
                  <img src={preview.url} alt={`Preview ${index + 1}`} className="preview-image" />
                  <div className="image-info">
                    <span className="image-name">{preview.file.name}</span>
                    <span className="image-size">{formatFileSize(preview.file.size)}</span>
                  </div>
                  <button 
                    className="remove-button" 
                    onClick={() => removeFile(index)}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add more images placeholder */}
            {previews.length < maxImages && (
              <div 
                className="preview-item add-more"
                onClick={() => document.querySelector('.file-input').click()}
              >
                <div className="add-more-container">
                  <div className="add-icon">+</div>
                  <p>Add More</p>
                  <p className="add-more-count">
                    {maxImages - previews.length} {maxImages - previews.length === 1 ? 'image' : 'images'} remaining
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="preview-footer">
            <p className="preview-tip">
              <strong>Tip:</strong> For best results, use photos taken from different angles around the roof. 
              Make sure the entire roof is visible in each photo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
};

export default MultiImageUploader;
