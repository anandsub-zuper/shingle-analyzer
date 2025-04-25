// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS to allow requests from your Netlify domain
app.use(cors({
  origin: 'https://roof-shingle-analyzer.netlify.app',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add preflight handling for all routes
app.options('*', cors());

// Middleware for parsing JSON (with higher limit for large images)
app.use(express.json({ limit: '50mb' }));

// API status endpoint to check if API key is configured
app.get('/api-status', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.json({
    apiKeyConfigured: apiKey ? 'Yes (first 4 chars: ' + apiKey.substring(0, 4) + '...)' : 'No',
    apiKeyLength: apiKey ? apiKey.length : 0,
    serverTime: new Date().toISOString()
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is running correctly', 
    serverTime: new Date().toISOString() 
  });
});

// Main API endpoint for shingle analysis
app.post('/api/analyze-shingle', async (req, res) => {
  console.log("Received request for shingle analysis");
  
  try {
    // Validate request body
    const { image } = req.body;
    
    if (!image) {
      console.log("No image data received");
      return res.status(400).json({ error: "No image data provided" });
    }
    
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("No OpenAI API key configured");
      return res.status(500).json({ error: "OpenAI API key not configured on server" });
    }
    
    console.log("Preparing OpenAI API request");
    
    // Create the OpenAI API request payload
    // Updated to use gpt-4o model which has vision capabilities
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in roofing shingles. Analyze the uploaded image and identify the type of shingle, manufacturer if possible, and all specifications you can determine. Format your response as a JSON object with these fields: name, manufacturer, productLine, material, weight, dimensions, thickness, lifespan, pattern, warranty, and any other relevant specifications you can determine. If you're not certain about any field, make your best estimate and indicate uncertainty with '(estimated)' after the value."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this roofing shingle image and provide detailed specifications in JSON format."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    };
    
    // Call the OpenAI API
    try {
      console.log("Sending request to OpenAI API");
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
      
      console.log("OpenAI API response received successfully");
      res.json(response.data);
    } catch (apiError) {
      console.error("OpenAI API call failed:");
      
      if (apiError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`Status: ${apiError.response.status}`);
        console.error('Error data:', apiError.response.data);
        
        res.status(500).json({
          error: `OpenAI API error: ${apiError.message}`,
          status: apiError.response.status,
          details: apiError.response.data
        });
      } else if (apiError.request) {
        // The request was made but no response was received
        console.error('No response received from OpenAI API');
        res.status(500).json({
          error: 'No response received from OpenAI API',
          message: apiError.message
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', apiError.message);
        res.status(500).json({
          error: 'Error setting up OpenAI API request',
          message: apiError.message
        });
      }
    }
  } catch (error) {
    // General error handling for any other errors
    console.error('General error in request processing:', error);
    res.status(500).json({
      error: 'Server error processing request',
      message: error.message
    });
  }
});

// Handle root path
app.get('/', (req, res) => {
  res.send('Shingle Analyzer API server is running. Use /api/analyze-shingle endpoint for shingle analysis.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
