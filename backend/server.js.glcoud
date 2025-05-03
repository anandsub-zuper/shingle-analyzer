// Modified server.js for Google Cloud deployment
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080; // Use PORT provided by Cloud Run

// Configure CORS to allow requests from your Netlify domain and development
app.use(cors({
  origin: ['https://roof-shingle-analyzer.netlify.app', 'http://localhost:3000'],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add preflight handling for all routes
app.options('*', cors());

// Add structured logging middleware for Google Cloud
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Format logs as JSON for better integration with Google Cloud Logging
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: res.statusCode,
      userAgent: req.get('user-agent') || 'unknown',
      responseTime: duration,
      remoteIp: req.ip
    }));
  });
  next();
});

// Middleware for parsing JSON (with higher limit for large images)
app.use(express.json({ limit: '50mb' }));

// Function to validate image format
function validateImageFormat(base64Image) {
  // Check if the base64 string starts with the expected formats
  const pngHeader = "iVBORw0KGgo";         // PNG format header
  const jpegHeader = "/9j/";               // JPEG format header
  const gifHeader = "R0lGOD";              // GIF format header
  const webpHeader = "UklGR";              // WEBP format header
  
  if (base64Image.startsWith(pngHeader) ||
      base64Image.startsWith(jpegHeader) ||
      base64Image.startsWith(gifHeader) ||
      base64Image.startsWith(webpHeader)) {
    return true;
  }
  
  return false;
}

// Health check endpoint for Google Cloud
app.get('/health', (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  res.status(200).json({
    status: 'healthy',
    apiKeyConfigured: apiKey ? true : false,
    serverTime: new Date().toISOString(),
    serverEnvironment: process.env.NODE_ENV || 'development'
  });
});

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
  console.log(JSON.stringify({
    message: "Received request for shingle analysis",
    timestamp: new Date().toISOString()
  }));
  
  try {
    // Validate request body
    const { image } = req.body;
    
    if (!image) {
      console.log(JSON.stringify({
        message: "No image data received",
        timestamp: new Date().toISOString(),
        error: "No image data provided"
      }));
      return res.status(400).json({ error: "No image data provided" });
    }
    
    // Validate image format
    if (!validateImageFormat(image)) {
      console.log(JSON.stringify({
        message: "Invalid image format",
        timestamp: new Date().toISOString(),
        error: "Invalid image format"
      }));
      return res.status(400).json({ 
        error: "Invalid image format. Please upload PNG, JPEG, GIF, or WEBP images."
      });
    }
    
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(JSON.stringify({
        message: "No OpenAI API key configured",
        timestamp: new Date().toISOString(),
        error: "OpenAI API key not configured on server"
      }));
      return res.status(500).json({ error: "OpenAI API key not configured on server" });
    }
    
    console.log(JSON.stringify({
      message: "Preparing OpenAI API request",
      timestamp: new Date().toISOString()
    }));
    
    // Create the OpenAI API request payload
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in roofing shingles. Analyze the uploaded image and identify the type of shingle, manufacturer if possible, and all specifications you can determine. ALSO, carefully analyze for any visible damage or wear such as: missing granules, cracks, curling edges, blistering, algae growth, or impact damage from hail. Format your response as a JSON object with these fields: name, manufacturer, productLine, material, weight, dimensions, thickness, lifespan, pattern, warranty, and damageAssessment. In the damageAssessment field, include a nested object with: overallCondition (Excellent, Good, Fair, Poor), damageTypes (array of damage types found), severity (1-10 scale), description (detailed description of damage), and recommendedAction (what should be done about the damage)."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this roofing shingle image and provide detailed specifications along with any signs of damage or wear in JSON format."
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
      max_tokens: 1500
    };
    
    // Call the OpenAI API with improved error handling and timeouts
    try {
      console.log(JSON.stringify({
        message: "Sending request to OpenAI API",
        timestamp: new Date().toISOString()
      }));
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 60000 // 60 second timeout
        }
      );
      
      console.log(JSON.stringify({
        message: "OpenAI API response received successfully",
        timestamp: new Date().toISOString(),
        responseStatus: response.status
      }));
      
      // Process the response to ensure valid JSON
      let processedData = response.data;
      
      try {
        // Extract the JSON content from the response text if needed
        const responseContent = response.data.choices[0].message.content;
        if (typeof responseContent === 'string') {
          // Try to find JSON content within the string
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const jsonContent = JSON.parse(jsonMatch[0]);
              processedData = {
                ...response.data,
                parsedResults: jsonContent
              };
            } catch (e) {
              console.log(JSON.stringify({
                message: "Could not parse JSON from response content",
                timestamp: new Date().toISOString(),
                error: e.message
              }));
              // Continue with the original response
            }
          }
        }
      } catch (jsonError) {
        console.log(JSON.stringify({
          message: "Could not extract structured JSON from response",
          timestamp: new Date().toISOString(),
          error: jsonError.message
        }));
        // Continue with the original response
      }
      
      res.json(processedData);
    } catch (apiError) {
      console.error(JSON.stringify({
        message: "OpenAI API call failed",
        timestamp: new Date().toISOString(),
        error: apiError.message
      }));
      
      if (apiError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(JSON.stringify({
          status: apiError.response.status,
          data: apiError.response.data,
          timestamp: new Date().toISOString()
        }));
        
        res.status(500).json({
          error: `OpenAI API error: ${apiError.message}`,
          status: apiError.response.status,
          details: apiError.response.data
        });
      } else if (apiError.request) {
        // The request was made but no response was received
        console.error(JSON.stringify({
          message: 'No response received from OpenAI API',
          timestamp: new Date().toISOString()
        }));
        
        res.status(500).json({
          error: 'No response received from OpenAI API',
          message: apiError.message
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(JSON.stringify({
          message: 'Error setting up request',
          timestamp: new Date().toISOString(),
          error: apiError.message
        }));
        
        res.status(500).json({
          error: 'Error setting up OpenAI API request',
          message: apiError.message
        });
      }
    }
  } catch (error) {
    // General error handling for any other errors
    console.error(JSON.stringify({
      message: 'General error in request processing',
      timestamp: new Date().toISOString(),
      error: error.message
    }));
    
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

// Start the server with enhanced error handling
app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    message: `Server running on port ${PORT}`,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  }));
});
}).on('error', (err) => {
  console.error(JSON.stringify({
    message: 'Server failed to start',
    timestamp: new Date().toISOString(),
    error: err.message
  }));
  process.exit(1);
});

module.exports = app; // For testing purposes
