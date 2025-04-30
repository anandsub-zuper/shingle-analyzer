// src/utils/apiHelper.js

/**
 * Utility functions for API communication with robust error handling
 */

/**
 * Maximum number of retry attempts for API calls
 */
const MAX_RETRIES = 3;

/**
 * Base URL for API requests
 */
const API_BASE_URL = 'https://shingle-analyzer-cf8f8df19174.herokuapp.com';

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Calculate exponential backoff delay for retries
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
const getRetryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000);

/**
 * Check if the API server is awake by pinging it
 * @returns {Promise<boolean>} True if server responds, false otherwise
 */
export const pingServer = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/test`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('Server ping failed:', error.message);
    return false;
  }
};

/**
 * Convert file to base64 string
 * @param {File} file - File object to convert
 * @returns {Promise<string>} Base64 encoded string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } catch (error) {
        reject(new Error("Error extracting base64 data"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Enhanced fetch with timeout, retry, and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
export const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  // Merge the user signal with our controller signal
  const userSignal = options.signal;
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timeout. The server took too long to respond.'));
    }, timeout);
    
    // Clean up the timeout if the user signal aborts
    if (userSignal) {
      userSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
  });
  
  // Create the fetch promise with our abort signal
  const fetchPromise = fetch(url, {
    ...options,
    signal
  });
  
  // Race the fetch against the timeout
  return Promise.race([fetchPromise, timeoutPromise]);
};

/**
 * Call API with retry logic
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} timeout - Timeout in milliseconds
 * @param {function} onRetry - Callback for retry attempts
 * @returns {Promise<Object>} API response
 */
export const callApiWithRetry = async (
  endpoint,
  options = {},
  maxRetries = MAX_RETRIES,
  timeout = DEFAULT_TIMEOUT,
  onRetry = null
) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait before retrying (except for first attempt)
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        console.log(`Retry attempt ${attempt} of ${maxRetries} after ${delay}ms delay`);
        
        // Call the retry callback if provided
        if (onRetry) {
          onRetry(attempt, maxRetries);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Make the API call with timeout
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
      const response = await fetchWithTimeout(url, options, timeout);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        // Check if response is OK (status in 200-299 range)
        if (!response.ok) {
          throw new Error(`API error: ${data.error?.message || data.error || response.statusText}`);
        }
        
        return data;
      } else {
        // For non-JSON responses
        const text = await response.text();
        
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText} - ${text.substring(0, 100)}`);
        }
        
        // Try to extract JSON from text response (sometimes APIs return JSON with wrong content-type)
        try {
          return JSON.parse(text);
        } catch (e) {
          // Return text response if it's not JSON
          return { text, contentType };
        }
      }
    } catch (error) {
      lastError = error;
      
      // Only retry on network errors or timeouts, not API errors
      const shouldRetry = (
        attempt < maxRetries && (
          error.name === 'TypeError' ||
          error.name === 'AbortError' ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('timeout') ||
          error.message.includes('CORS') ||
          (error.message.includes('API error') && error.message.includes('503'))
        )
      );
      
      if (!shouldRetry) {
        break;
      }
      
      // Log retry attempts
      console.warn(`API call failed (attempt ${attempt + 1}): ${error.message}`);
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
};

/**
 * Analyze an image with automatic retries
 * @param {string} base64Image - Base64 encoded image
 * @param {AbortSignal} signal - AbortSignal for cancellation
 * @param {function} onRetry - Callback function for retries
 * @returns {Promise<Object>} Analysis results
 */
export const analyzeImage = async (base64Image, signal, onRetry = null) => {
  // First ping the server to wake it up
  const isAwake = await pingServer();
  
  if (!isAwake) {
    console.log('Server appears to be asleep, expect longer response time');
  }
  
  // Call the API with retries
  return callApiWithRetry(
    '/api/analyze-shingle',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image
      }),
      signal
    },
    MAX_RETRIES,
    DEFAULT_TIMEOUT,
    onRetry
  );
};

/**
 * Check API key status
 * @returns {Promise<Object>} API key status info
 */
export const checkApiStatus = async () => {
  return callApiWithRetry('/api-status', {
    method: 'GET'
  }, 1, 5000);
};

export default {
  pingServer,
  fileToBase64,
  fetchWithTimeout,
  callApiWithRetry,
  analyzeImage,
  checkApiStatus
};
