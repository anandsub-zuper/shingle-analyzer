// src/api/RoofModelingAPI.js
/**
 * API client for interacting with the 3D roof modeling backend
 * Handles communication with the Vultr GPU server
 */

const API_BASE_URL = 'https://corsproxy.io/?' + encodeURIComponent('http://66.135.21.204:5001');

/**
 * Upload multiple roof images and start the 3D modeling process
 * @param {File[]} images - Array of image files to process
 * @param {Function} onProgress - Optional callback for upload progress updates
 * @returns {Promise<{jobId: string, message: string}>} - Job information
 */
export const uploadRoofImages = async (images, onProgress = null) => {
  try {
    const formData = new FormData();
    
    // Add all images to the form data
    images.forEach((image, index) => {
      formData.append('images', image);
    });
    
    // Create a request with progress tracking if a callback is provided
    const xhr = new XMLHttpRequest();
    
    // Create a promise to handle the async XHR request
    const uploadPromise = new Promise((resolve, reject) => {
      xhr.open('POST', `${API_BASE_URL}/api/process`, true);
      
      // Set up progress tracking
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }
      
      // Handle response
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      };
      
      // Handle errors
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };
      
      // Send the request
      xhr.send(formData);
    });
    
    return await uploadPromise;
  } catch (error) {
    console.error('Error uploading roof images:', error);
    throw error;
  }
};

/**
 * Check the status of a 3D modeling job
 * @param {string} jobId - ID of the processing job
 * @returns {Promise<{status: string, progress: number, message: string}>} - Job status info
 */
export const checkJobStatus = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch job status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking job status:', error);
    throw error;
  }
};

/**
 * Get the URL of the completed 3D model
 * @param {string} jobId - ID of the completed processing job
 * @returns {Promise<{modelUrl: string, measurements: Object}>} - Model URL and measurements
 */
export const getModelData = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/model/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch model data: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting model data:', error);
    throw error;
  }
};

/**
 * Check the server status to ensure it's online and ready
 * @returns {Promise<{status: string, message: string}>} - Server status info
 */
export const checkServerStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status`);
    
    if (!response.ok) {
      throw new Error(`Server status check failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking server status:', error);
    throw error;
  }
};

export default {
  uploadRoofImages,
  checkJobStatus,
  getModelData,
  checkServerStatus
};
