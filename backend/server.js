// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'https://roof-shingle-analyzer.netlify.app',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // For handling large image files

// API endpoint to proxy requests to OpenAI
app.post('/api/analyze-shingle', async (req, res) => {
  try {
    const { image, apiKey } = req.body;
    
    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-vision-preview",
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No additional details available'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
