// Enhanced Vision API Prompt Engineering for Roof Shingle Analyzer
// This file replaces the existing server.js API endpoint for roof analysis

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
//const emailService = require('./services/emailService');
//const emailRoutes = require('./routes/emailRoutes');

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
//app.use('/api', emailRoutes);

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

// Enhanced API endpoint for shingle analysis
app.post('/api/analyze-shingle', async (req, res) => {
  console.log("Received request for shingle analysis");
  
  try {
    // Validate request body
    const { image } = req.body;
    
    if (!image) {
      console.log("No image data received");
      return res.status(400).json({ error: "No image data provided" });
    }
    
    // Validate image format
    if (!validateImageFormat(image)) {
      console.log("Invalid image format");
      return res.status(400).json({ 
        error: "Invalid image format. Please upload PNG, JPEG, GIF, or WEBP images."
      });
    }
    
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("No OpenAI API key configured");
      return res.status(500).json({ error: "OpenAI API key not configured on server" });
    }
    
    console.log("Preparing OpenAI API request");
    
    // Enhanced prompt for OpenAI Vision API
    /* const enhancedSystemPrompt = `
You are an expert roof inspector specializing in shingle identification and damage assessment with 30 years of experience.

TASK: 
Analyze the uploaded roof image to provide a detailed professional assessment.

REQUIRED OUTPUT FORMAT:
Respond with a JSON object containing these sections:

1. MATERIAL SPECIFICATION:
- name: Full name of the shingle/roofing material
- manufacturer: Manufacturer name if identifiable, or list of possible manufacturers
- productLine: Product line or model if identifiable
- material: Primary material composition (e.g. asphalt, metal, clay, etc.)
- materialSubtype: Specific material subtype (e.g. architectural shingle, 3-tab shingle, etc.)
- weight: Estimated weight per square (100 sq ft) or square meter
- dimensions: Standard dimensions for this shingle type
- thickness: Estimated thickness in mm or inches
- estimatedAge: Approximate age of the roof based on wear patterns
- lifespan: Expected total lifespan for this material type
- pattern: Description of the pattern
- warranty: Typical warranty for this type of material
- colors: Array of colors visible in the shingles
- fireRating: Typical fire rating for this material (Class A, B, C)
- windRating: Typical wind resistance rating (in mph or km/h)
- impactResistance: Impact resistance rating (1-4, with 4 being highest)
- energyEfficiency: Energy efficiency rating if applicable

2. DAMAGE ASSESSMENT:
- overallCondition: One of: ["Excellent", "Good", "Fair", "Poor", "Critical"]
- damageTypes: Array of detected damage types from these options: 
  ["Granule Loss", "Cracking", "Curling", "Blistering", "Missing Shingles", 
   "Wind Damage", "Hail Damage", "Impact Damage", "Water Infiltration", 
   "Algae Growth", "Moss Growth", "Thermal Splitting", "Manufacturing Defects", 
   "Improper Installation", "Storm Damage", "Age-Related Wear", "UV Degradation", 
   "Flashing Issues", "Punctures", "Fastener Issues", "Debris Damage"]
- damageSeverity: Numerical rating from 1-10 of overall damage severity
- granuleLoss: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- cracking: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- curling: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- blistering: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- missingShingles: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- hailDamage: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected,
    impactDensity: estimated impacts per 100 sq ft if applicable
  }
- waterDamage: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- algaeGrowth: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- description: Comprehensive description of all damage observed
- likelyDamageCauses: Array of likely causes (e.g. "Hail", "Wind", "Age", "Poor Installation")
- estimatedTimeframeSinceDamage: Estimated time since damage occurred
- weatherRelated: Boolean indicating if damage appears weather-related
- structuralConcerns: Boolean indicating if damage affects structural integrity
- progressiveIssues: Boolean indicating if damage is likely to worsen rapidly
- recommendedAction: Professional recommendation on what should be done

3. REPAIR ASSESSMENT:
- repairRecommendation: One of: ["No Action Needed", "Minor Repairs", "Major Repairs", "Partial Replacement", "Full Replacement"]
- urgency: One of: ["None", "Low", "Moderate", "High", "Emergency"]
- repairDifficulty: One of: ["Easy", "Moderate", "Complex", "Very Complex"]
- diyFeasibility: Boolean indicating if repairs could be DIY
- anticipatedRepairCost: Estimated cost range for repairs
- anticipatedReplacementCost: Estimated cost range for full replacement
- specialConsiderations: Array of special considerations for repairs

4. METADATA:
- confidenceScore: Your confidence in this assessment (1-10)
- visibleSectionEstimate: Estimate of what percentage of the total roof is visible in the image
- visibilityQuality: One of: ["Excellent", "Good", "Fair", "Poor"]
- limitationNotes: Notes about limitations in your assessment
- additionalInspectionNeeded: Boolean indicating if additional inspection is recommended

Ensure the entire response is properly formatted as valid JSON.
`;*/

    // In server.js, update the system prompt

const enhancedSystemPrompt = `
You are an expert roof inspector specializing in shingle identification and damage assessment with 30 years of experience.

TASK: 
Analyze the uploaded image to provide a detailed professional assessment.

REQUIRED OUTPUT FORMAT:
Respond with a JSON object containing these sections:

1. MATERIAL SPECIFICATION:
- name: Full name of the shingle/roofing material
- manufacturer: Manufacturer name if identifiable, or list of possible manufacturers
- productLine: Product line or model if identifiable
- material: Primary material composition (e.g. asphalt, metal, clay, etc.)
- materialSubtype: Specific material subtype (e.g. architectural shingle, 3-tab shingle, etc.)
- weight: Estimated weight per square (100 sq ft) or square meter
- dimensions: Standard dimensions for this shingle type
- thickness: Estimated thickness in mm or inches
- estimatedAge: Approximate age of the roof based on wear patterns
- lifespan: Expected total lifespan for this material type
- pattern: Description of the pattern
- warranty: Typical warranty for this type of material
- colors: Array of colors visible in the shingles
- fireRating: Typical fire rating for this material (Class A, B, C)
- windRating: Typical wind resistance rating (in mph or km/h)
- impactResistance: Impact resistance rating (1-4, with 4 being highest)
- energyEfficiency: Energy efficiency rating if applicable

2. DAMAGE ASSESSMENT:
- overallCondition: One of: ["Excellent", "Good", "Fair", "Poor", "Critical"]
- damageTypes: Array of detected damage types from these options: 
  ["Granule Loss", "Cracking", "Curling", "Blistering", "Missing Shingles", 
   "Wind Damage", "Hail Damage", "Impact Damage", "Water Infiltration", 
   "Algae Growth", "Moss Growth", "Thermal Splitting", "Manufacturing Defects", 
   "Improper Installation", "Storm Damage", "Age-Related Wear", "UV Degradation", 
   "Flashing Issues", "Punctures", "Fastener Issues", "Debris Damage"]
- damageSeverity: Numerical rating from 1-10 of overall damage severity
- granuleLoss: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- cracking: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- curling: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- blistering: {
    present: boolean, 
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- missingShingles: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- hailDamage: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected,
    impactDensity: estimated impacts per 100 sq ft if applicable
  }
- waterDamage: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- algaeGrowth: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- description: Comprehensive description of all damage observed
- likelyDamageCauses: Array of likely causes (e.g. "Hail", "Wind", "Age", "Poor Installation")
- estimatedTimeframeSinceDamage: Estimated time since damage occurred
- weatherRelated: Boolean indicating if damage appears weather-related
- structuralConcerns: Boolean indicating if damage affects structural integrity
- progressiveIssues: Boolean indicating if damage is likely to worsen rapidly
- recommendedAction: Professional recommendation on what should be done

3. REPAIR ASSESSMENT:
- repairRecommendation: One of: ["No Action Needed", "Minor Repairs", "Major Repairs", "Partial Replacement", "Full Replacement"]
- urgency: One of: ["None", "Low", "Moderate", "High", "Emergency"]
- repairDifficulty: One of: ["Easy", "Moderate", "Complex", "Very Complex"]
- diyFeasibility: Boolean indicating if repairs could be DIY
- anticipatedRepairCost: Estimated cost range for repairs
- anticipatedReplacementCost: Estimated cost range for full replacement
- specialConsiderations: Array of special considerations for repairs

4. METADATA:
- confidenceScore: Your confidence in this assessment (1-10)
- visibleSectionEstimate: Estimate of what percentage of the total roof is visible in the image
- visibilityQuality: One of: ["Excellent", "Good", "Fair", "Poor"]
- limitationNotes: Notes about limitations in your assessment
- additionalInspectionNeeded: Boolean indicating if additional inspection is recommended

5. CALCULATED_METRICS:
- totalDamagePercentage: Calculate the total percentage of roof affected by damage by summing the coverage percentages for all damage types (granuleLoss, cracking, etc.). Apply a 15% overlap reduction for each additional damage type after the first.
- remainingLife: {
    years: Number of years remaining (expectedLifespan - estimatedAge, modified by damageSeverity),
    percentage: Percentage of expected life remaining (0-100),
    calculationMethod: Description of how this was calculated
  }
- repairPriority: Description of priority level with reasoning, based on:
    - "Immediate" if structural concerns are present
    - "High" if water damage with progressive issues
    - "Urgent" if severity is 8+
    - "High" if severity is 6-7
    - "Moderate" if severity is 4-5
    - "Low" if severity is 2-3
    - "None" if severity is 0-1
- costEstimates: {
    repair: Estimated cost range for repairs in USD formatted as "$X - $Y",
    replacement: Estimated cost range for full replacement in USD formatted as "$X - $Y",
    costBasis: Standard 2025 rates used for calculation (e.g., "$350-550 per square for asphalt")
  }
- repairRecommendation: {
    recommendation: One of ["Replace", "Consider Replacement", "Repair", "Monitor"],
    reasoning: Detailed explanation of recommendation factors
  }

CALCULATION METHODOLOGY:
1. For damage percentage: Sum all individual damage coverages (granuleLoss.coverage, cracking.coverage, etc.). If more than one damage type is present, reduce the total by 15% for each additional damage type to account for overlap.

2. For remaining life: 
   a. Calculate baseline = (lifespan - estimatedAge)
   b. Apply severity multiplier:
      - 0.3 for damageSeverity 8-10 (70% reduction)
      - 0.6 for damageSeverity 6-7 (40% reduction)
      - 0.8 for damageSeverity 4-5 (20% reduction)
      - 0.9 for damageSeverity 2-3 (10% reduction)
      - 1.0 for damageSeverity 0-1 (no reduction)
   c. Final remaining years = baseline × severity multiplier
   d. Percentage = (remaining years ÷ lifespan) × 100

3. For cost estimates: 
   - Use these 2025 standard rates per square (100 sq ft):
     - Asphalt: $350-550
     - Metal: $800-1200
     - Wood: $650-950
     - Clay/Tile: $1000-2000
     - Slate: $1500-2500
     - Concrete: $850-1250
   - For repairs: Calculate affected area (roof area × damage percentage), then multiply by appropriate material rate
   - For replacement: Calculate total roof area (estimated at 1800 sq ft if not specified), then multiply by material rate
   - Add 40-50% for labor and overhead on repairs
   - Add 50-60% for labor and overhead on replacement

4. For repair recommendation:
   - Recommend "Replace" if at least two of these factors are present:
     - Total damage over 35%
     - Damage severity 7 or higher
     - Less than 25% remaining life
     - Structural concerns
   - Recommend "Consider Replacement" if only one factor above is present
   - Recommend "Repair" if damage is significant (severity > 3 or coverage > 10%) but not severe enough for replacement
   - Recommend "Monitor" if damage is minor (severity ≤ 3 and coverage ≤ 10%)

ENSURE ALL CALCULATIONS are consistent and adhere to these formulas precisely. Format cost estimates as dollar ranges (e.g., "$500 - $1,200").

Ensure the entire response is properly formatted as valid JSON.
`;
    
    // Create the OpenAI API request payload with enhanced prompt
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: enhancedSystemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this roofing shingle image and provide a detailed professional assessment in the requested JSON format."
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
      max_tokens: 3000,  // Increased token limit for more comprehensive response
      temperature: 0.2   // Lower temperature for more consistent output
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
      
      // Process the response to ensure valid JSON
      let processedData = response.data;
      
      try {
        // Extract the JSON content from the response text if needed
        const responseContent = response.data.choices[0].message.content;
        if (typeof responseContent === 'string') {
          // Try to find JSON content within the string
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonContent = JSON.parse(jsonMatch[0]);
            processedData = {
              ...response.data,
              parsedResults: jsonContent
            };
          }
        }
      } catch (jsonError) {
        console.warn("Could not extract structured JSON from response:", jsonError);
        // Continue with the original response
      }
      
      res.json(processedData);
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
  res.send('Enhanced Shingle Analyzer API server is running. Use /api/analyze-shingle endpoint for shingle analysis.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Enhanced Shingle Analyzer server running on port ${PORT}`);
});

module.exports = app; // For testing purposes
