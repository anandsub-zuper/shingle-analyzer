// src/utils/apiHelper.js

/**
 * Utility functions for API communication with robust error handling and performance monitoring
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
 * Timeout for the first request attempt (shorter to fail fast)
 */
const FIRST_ATTEMPT_TIMEOUT = 25000; // 25 seconds (shorter than Heroku's 30s limit)

/**
 * Keep-alive ping interval in milliseconds
 */
const KEEP_ALIVE_INTERVAL = 15000; // 15 seconds

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
 * Helper function to handle API responses
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} Parsed response data
 */
const handleResponse = async (response) => {
  // Handle different content types
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
    
    // Try to extract JSON from text response
    try {
      return JSON.parse(text);
    } catch (e) {
      // Return text response if it's not JSON
      return { text, contentType };
    }
  }
};

/**
 * Send a ping request to keep the connection alive
 * @param {string} url - URL to ping
 */
const sendKeepAlivePing = async (url) => {
  try {
    await fetch(url, { 
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    // Ignore errors, this is just a keep-alive ping
    console.log('Keep-alive ping error (safe to ignore):', e.message);
  }
};

/**
 * Call API with improved timeout handling and retry logic
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
  const monitor = monitorApiCall(endpoint);
  
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
      
      // Build the URL
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
      
      // Use a different strategy for the first attempt vs. retries
      if (attempt === 0) {
        // For first attempt, set a shorter timeout to avoid Heroku's 30s limit
        // This lets us fail fast and retry
        const response = await fetchWithTimeout(url, options, FIRST_ATTEMPT_TIMEOUT);
        const data = await handleResponse(response);
        monitor.success(data);
        return data;
      } else {
        // For retry attempts, use normal timeout but add connection monitoring
        const controller = new AbortController();
        const { signal } = controller;
        
        // Add signal to options
        const newOptions = {
          ...options,
          signal
        };
        
        // Set up a ping interval to keep the connection alive
        const pingInterval = setInterval(() => {
          sendKeepAlivePing(url);
        }, KEEP_ALIVE_INTERVAL);
        
        try {
          const response = await fetch(url, newOptions);
          clearInterval(pingInterval);
          const data = await handleResponse(response);
          monitor.success(data);
          return data;
        } catch (error) {
          clearInterval(pingInterval);
          throw error;
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
  
  // If we've exhausted all retries, log and throw the last error
  monitor.error(lastError);
  throw lastError;
};

/**
 * Performance monitoring for API calls
 * @param {string} endpoint - API endpoint being called
 * @param {function} callback - Optional callback for monitoring events
 * @returns {Object} Monitoring functions
 */
export const monitorApiCall = (endpoint, callback) => {
  const start = Date.now();
  let requestStatus = 'pending';
  
  // Return the monitoring result
  return {
    // Function to call when request completes successfully
    success: (data) => {
      const duration = Date.now() - start;
      requestStatus = 'success';
      console.log(`[Performance] Request to ${endpoint} completed successfully in ${duration}ms`);
      
      // Call user callback if provided
      if (callback) callback({ duration, status: requestStatus, data });
      
      return { duration, status: requestStatus };
    },
    
    // Function to call when request fails
    error: (error) => {
      const duration = Date.now() - start;
      requestStatus = 'error';
      console.log(`[Performance] Request to ${endpoint} failed after ${duration}ms: ${error.message}`);
      
      // Call user callback if provided
      if (callback) callback({ duration, status: requestStatus, error });
      
      return { duration, status: requestStatus };
    }
  };
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
  await pingServer();
  
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
  checkApiStatus,
  monitorApiCall
};
