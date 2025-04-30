// src/components/MultiImageUploader.jsx
import React, { useState, useEffect, useRef } from 'react';
import { checkApiStatus } from '../utils/apiHelper';
import '../styles/MultiImageUploader.css';

const MultiImageUploader = ({ onImagesSelected, maxImages = 15, isAdvanced = false }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [serverMessage, setServerMessage] = useState(`Checking ${isAdvanced ? 'advanced' : 'standard'} server status...`);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingFiles, setProcessingFiles] = useState(false);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);
  // Ref for file input
  const fileInputRef = useRef(null);

  // Check server status on mount and set cleanup on unmount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkApiStatus(isAdvanced);
        if (isMounted.current) {
          setServerStatus(status.status === 'online' ? 'online' : 'offline');
          setServerMessage(status.message || (status.status === 'online' 
            ? `Server is online and ready for processing`
            : `Server is currently offline or unavailable`));
        }
      } catch (error) {
        if (isMounted.current) {
          setServerStatus('offline');
          setServerMessage(`Could not connect to ${isAdvanced ? 'advanced' : 'standard'} processing server`);
        }
      }
    };

    checkStatus();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted.current = false;
    };
  }, [isAdvanced]);

  // Generate previews whenever selected files change
  useEffect(() => {
    if (!isMounted.current) return;
    
    const newPreviews = [];
    
    // Don't start processing if there are no files
    if (selectedFiles.length === 0) {
      setPreviews([]);
      
      // Call the callback with empty array
      if (onImagesSelected) {
        onImagesSelected([]);
      }
      return;
    }
    
    setProcessingFiles(true);
    setUploadProgress(0);
    
    // Clean up previous preview URLs
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    
    // Track progress for large batches
    let processedCount = 0;
    
    // Process files in batches for better UI responsiveness
    const processFileBatch = async (startIndex) => {
      const batchSize = 3; // Process 3 files at a time
      const endIndex = Math.min(startIndex + batchSize, selectedFiles.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        if (!isMounted.current) return;
        
        const file = selectedFiles[i];
        newPreviews.push({
          file,
          url: URL.createObjectURL(file),
          id: `file-${Date.now()}-${i}` // Unique ID for each preview
        });
        
        processedCount++;
        setUploadProgress(Math.round((processedCount / selectedFiles.length) * 100));
      }
      
      // Update previews with the current batch
      if (isMounted.current) {
        setPreviews([...newPreviews]);
      }
      
      // Process next batch if more files remain
      if (endIndex < selectedFiles.length && isMounted.current) {
        // Small delay to keep UI responsive
        setTimeout(() => processFileBatch(endIndex), 50);
      } else if (isMounted.current) {
        // All files processed
        setProcessingFiles(false);
        
        // Call the callback with the selected files
        if (onImagesSelected) {
          onImagesSelected(selectedFiles);
        }
      }
    };
    
    // Start processing the first batch
    processFileBatch(0);
    
    // Clean up preview URLs when component unmounts or files change
    return () => {
      newPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFiles, onImagesSelected]);

  // Handle file selection via input
  const handleFileSelect = (event) => {
    const files = event.target.files;
    
    if (files && files.length > 0) {
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
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
    }
  };

  // Add files to the selection with validation
  const addFiles = (fileList) => {
    const validFiles = [];
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
    
    // Convert FileList to array and filter valid image files
    Array.from(fileList).forEach(file => {
      // Check file type
      if (!validTypes.includes(file.type)) {
        console.warn(`File ${file.name} rejected: invalid type ${file.type}`);
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} rejected: size exceeds 10MB limit`);
        return;
      }
      
      validFiles.push(file);
    });
    
    // Check for duplicate files by name
    const existingFileNames = selectedFiles.map(f => f.name);
    const newValidFiles = validFiles.filter(file => !existingFileNames.includes(file.name));
    
    if (newValidFiles.length === 0) {
      return; // No valid new files to add
    }
    
    // Limit to max number of images, prioritizing new files
    const totalFiles = [...selectedFiles, ...newValidFiles];
    if (totalFiles.length > maxImages) {
      // If we have too many files, keep all new valid files and as many existing files as will fit
      const newFilesToKeep = Math.min(newValidFiles.length, maxImages);
      const existingFilesToKeep = Math.max(0, maxImages - newFilesToKeep);
      
      setSelectedFiles([
        ...selectedFiles.slice(0, existingFilesToKeep),
        ...newValidFiles.slice(0, newFilesToKeep)
      ]);
    } else {
      // If we're under the limit, keep all files
      setSelectedFiles(totalFiles);
    }
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

  // Add more files via the file input
  const addMoreFiles = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Get display message for remaining image count
  const getRemainingImageMessage = () => {
    const remaining = maxImages - selectedFiles.length;
    
    if (remaining === 0) {
      return "Maximum number of images reached";
    } else if (remaining === 1) {
      return "1 image remaining";
    } else {
      return `${remaining} images remaining`;
    }
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
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
          ref={fileInputRef}
          type="file"
          accept="image/jpeg, image/png, image/jpg, image/webp"
          onChange={handleFileSelect}
          className="file-input"
          multiple
          disabled={serverStatus === 'offline' || selectedFiles.length >= maxImages}
        />
        <div className="upload-icon">📸</div>
        <div className="upload-text">
          <p className="primary-text">
            {isAdvanced 
              ? "Drag & drop multiple roof images here" 
              : "Drag & drop roof image here"}
          </p>
          <p className="secondary-text">Or click to select files</p>
          <p className="help-text">
            {isAdvanced 
              ? `Upload 8-15 images of your roof from different angles for best results (max ${maxImages})`
              : "Upload a clear image of your roof for analysis"}
          </p>
        </div>
      </div>
      
      {/* Processing indicator for large batches */}
      {processingFiles && (
        <div className="processing-indicator">
          <div className="processing-spinner"></div>
          <span>Processing {selectedFiles.length} images...</span>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Image preview grid */}
      {previews.length > 0 && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>
              {previews.length} {previews.length === 1 ? 'Image' : 'Images'} Selected
              {isAdvanced && (
                <span className="image-count-guidance">
                  {previews.length < 3 ? (
                    <span className="count-warning">At least 3 recommended</span>
                  ) : previews.length < 8 ? (
                    <span className="count-info">8+ for best results</span>
                  ) : (
                    <span className="count-success">Good image count ✓</span>
                  )}
                </span>
              )}
            </h3>
            <button className="clear-button" onClick={clearFiles}>Clear All</button>
          </div>
          
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div className="preview-item" key={preview.id || index}>
                <div className="preview-image-container">
                  <img src={preview.url} alt={`Preview ${index + 1}`} className="preview-image" />
                  <div className="image-number">{index + 1}</div>
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
            
            {/* Add more images placeholder - only show if under max */}
            {previews.length < maxImages && (
              <div 
                className="preview-item add-more"
                onClick={addMoreFiles}
              >
                <div className="add-more-container">
                  <div className="add-icon">+</div>
                  <p>Add More</p>
                  <p className="add-more-count">
                    {getRemainingImageMessage()}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {isAdvanced && (
            <div className="preview-footer">
              <p className="preview-tip">
                <strong>Tip:</strong> For best results, include images from all sides of the roof.
                The AI uses multiple perspectives to triangulate measurements.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiImageUploader;
