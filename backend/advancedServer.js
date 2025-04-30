// advancedServer.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.ADVANCED_PORT || 3002; // Use different port from main server

// Configure CORS to allow requests from your Netlify domain
app.use(cors({
  origin: 'https://roof-shingle-analyzer.netlify.app',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add preflight handling for all routes
app.options('*', cors());

// Middleware for parsing JSON (with higher limit for large images)
app.use(express.json({ limit: '100mb' })); // Increased limit for multiple images

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
    serverTime: new Date().toISOString(),
    serverType: 'Advanced Multi-Image Analysis'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Advanced Roof Analyzer server is running correctly', 
    serverTime: new Date().toISOString(),
    serverType: 'Advanced Multi-Image Analysis'
  });
});

// Enhanced API endpoint for multi-image analysis
app.post('/api/analyze-roof-multiple', async (req, res) => {
  console.log("Received request for multi-image roof analysis");
  
  try {
    // Validate request body
    const { images } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log("No images received or invalid format");
      return res.status(400).json({ error: "Please provide an array of base64-encoded images" });
    }
    
    // Maximum number of images to process
    const MAX_IMAGES = 15;
    const processedImages = images.slice(0, MAX_IMAGES);
    
    if (images.length > MAX_IMAGES) {
      console.log(`Limiting to ${MAX_IMAGES} images from ${images.length} provided`);
    }
    
    // Validate each image
    for (let i = 0; i < processedImages.length; i++) {
      if (!validateImageFormat(processedImages[i])) {
        return res.status(400).json({ 
          error: `Image at index ${i} has invalid format. Please upload PNG, JPEG, GIF, or WEBP images only.`
        });
      }
    }
    
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("No OpenAI API key configured");
      return res.status(500).json({ error: "OpenAI API key not configured on server" });
    }
    
    console.log("Preparing OpenAI API request for multi-image analysis");
    
    // Enhanced prompt for OpenAI Vision API with advanced measurement capabilities
    const enhancedSystemPrompt = `
You are an expert roof inspector specializing in shingle identification, damage assessment, and precision measurement with 30 years of experience.

TASK: 
Analyze the uploaded roof image(s) to provide a detailed professional assessment including accurate measurements derived solely from visual analysis.

REQUIRED OUTPUT FORMAT:
Respond with a JSON object containing these sections:

1. MATERIAL SPECIFICATION:
- name: Full name of the shingle/roofing material
- manufacturer: Manufacturer name if identifiable, or list of possible manufacturers
- productLine: Product line or model if identifiable
- material: Primary material composition (e.g. asphalt, metal, clay, etc.)
- materialSubtype: Specific material subtype (e.g. architectural shingle, 3-tab shingle, etc.)
- materialGeneration: Identify if the material is first, second, or third generation
- weight: Estimated weight per square (100 sq ft) or square meter
- dimensions: Standard dimensions for this shingle type
- thickness: Estimated thickness in mm or inches
- estimatedAge: Approximate age of the roof based on wear patterns
- lifespan: Expected total lifespan for this material type
- pattern: Description of the pattern
- staggerPattern: Description of installation pattern if visible
- warranty: Typical warranty for this type of material
- colors: Array of colors visible in the shingles
- fireRating: Typical fire rating for this material (Class A, B, C)
- windRating: Typical wind resistance rating (in mph or km/h)
- impactResistance: Impact resistance rating (1-4, with 4 being highest)
- energyEfficiency: Energy efficiency rating if applicable
- materialTechnology: Any special technology incorporated (e.g., solar reflective granules)
- regionalVariant: Whether this appears to be a region-specific variant
- complianceStandards: Applicable building standards this material likely meets

2. DAMAGE ASSESSMENT:
- overallCondition: One of: ["Excellent", "Good", "Fair", "Poor", "Critical"]
- damageTypes: Array of detected damage types from these options: 
  ["Granule Loss", "Cracking", "Curling", "Blistering", "Missing Shingles", 
   "Wind Damage", "Hail Damage", "Impact Damage", "Water Infiltration", 
   "Algae Growth", "Moss Growth", "Thermal Splitting", "Manufacturing Defects", 
   "Improper Installation", "Storm Damage", "Age-Related Wear", "UV Degradation", 
   "Flashing Issues", "Punctures", "Fastener Issues", "Debris Damage", "Sealing Failure",
   "Nail Pops", "Ventilation Issues", "Valley Damage", "Ridge Cap Damage"]
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
- mossGrowth: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- uvDegradation: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- sealingFailure: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    coverage: estimated percentage of roof affected
  }
- nailPops: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description,
    count: estimated number of nail pops visible
  }
- flashingCondition: {
    condition: one of ["Excellent", "Good", "Fair", "Poor", "Critical"],
    issues: array of issues detected,
    description: detailed description
  }
- valleyDamage: {
    present: boolean,
    severity: 1-10 scale,
    description: detailed description
  }
- ridgeCapCondition: {
    condition: one of ["Excellent", "Good", "Fair", "Poor", "Critical"],
    description: detailed description
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

5. ADVANCED MEASUREMENTS:
- totalRoofArea: {
    value: Estimated total roof area in square feet,
    confidenceScore: 1-10 scale,
    method: Description of how this was calculated,
    visiblePercentage: Percentage of total roof visible,
    precisionFactor: Estimated margin of error as percentage
  }
- roofDimensions: {
    length: Estimated length in feet,
    width: Estimated width in feet,
    height: Estimated height in feet,
    confidenceScore: 1-10 scale,
    referenceMethods: Array of references used for estimation (e.g., "standard door height", "window size", "shingle dimensions")
  }
- roofPitch: {
    primary: Primary roof pitch as ratio (e.g., "6:12"),
    degrees: Angle in degrees,
    confidenceScore: 1-10 scale,
    method: Description of how this was determined
  }
- ridgeLength: {
    value: Estimated ridge length in feet,
    confidenceScore: 1-10 scale
  }
- valleyLength: {
    value: Estimated total valley length in feet,
    confidenceScore: 1-10 scale
  }
- eaveLength: {
    value: Estimated total eave length in feet,
    confidenceScore: 1-10 scale
  }
- facetMeasurements: Array of measurements for each visible roof facet:
    [{
      facetId: Identifier for the facet (e.g., "front-right slope"),
      area: Estimated area in square feet,
      dimensions: { length: value, width: value },
      pitch: { ratio: value, degrees: value },
      confidenceScore: 1-10 scale
    }]

6. THREE-DIMENSIONAL STRUCTURE:
- roofType: Primary roof design (gable, hip, mansard, gambrel, flat, etc.)
- roofComplexity: Rating of roof geometric complexity (1-10)
- numberOfFacets: Count of distinct roof planes/facets
- primaryPitch: Main roof pitch (rise:run ratio)
- secondaryPitches: Array of secondary roof pitches if applicable
- dormers: {
    count: Number of dormers visible,
    types: Array of dormer types identified,
    dimensions: Array of dormer dimensions if determinable
  }
- chimneys: {
    count: Number of chimneys visible,
    locations: Array of chimney locations,
    dimensions: Array of chimney dimensions if determinable
  }
- skylights: {
    count: Number of skylights visible,
    dimensions: Array of skylight dimensions if determinable
  }
- vents: {
    count: Number of vents visible,
    types: Array of vent types identified
  }
- valleys: {
    count: Number of valleys visible,
    totalLength: Estimated total length in feet if determinable
  }
- ridges: {
    count: Number of ridges visible,
    totalLength: Estimated total length in feet if determinable
  }
- overhangs: {
    typical: Typical overhang depth in inches,
    directions: Which sides have visible overhangs
  }
- specialFeatures: Array of unusual roof features with descriptions

7. MATERIAL QUANTITY ESTIMATION:
- shingleSquares: {
    value: Estimated number of squares needed (1 square = 100 sq ft),
    adjustedValue: Value adjusted for waste factor and roof complexity,
    confidenceScore: 1-10 scale
  }
- wastePercentage: {
    value: Recommended waste percentage based on roof complexity,
    factors: Array of factors affecting waste calculation
  }
- underlaymentArea: {
    value: Estimated underlayment area in square feet,
    confidenceScore: 1-10 scale
  }
- accessoryQuantities: {
    ridgeCap: Estimated linear feet of ridge cap material needed,
    starter: Estimated linear feet of starter strip needed,
    drip: Estimated linear feet of drip edge needed,
    valley: Estimated linear feet of valley material needed,
    step: Estimated linear feet of step flashing needed,
    confidenceScore: 1-10 scale for these estimates
  }

8. VISUAL REFERENCE ANALYSIS:
- referenceFeaturesIdentified: Array of features used as measurement references:
    [{
      type: Type of reference feature (e.g., "door", "window", "standard shingle"),
      dimensions: Standard dimensions assumed,
      locationInImage: Description of where this appears,
      usedFor: What measurements this reference was used to calculate
    }]
- measurementTriangulation: {
    primaryMethods: Array of main triangulation methods used,
    confidenceEnhancement: How triangulation improved measurement confidence,
    conflictResolution: How measurement conflicts were resolved if any
  }
- scaleEstablishment: {
    method: Description of how scale was established,
    standardElements: Array of standard architectural elements used,
    consistency: Assessment of measurement consistency across images
  }

9. MULTI-IMAGE INTEGRATION:
- imageAlignment: {
    matchedPoints: Number of matching points identified across images,
    alignmentQuality: Rating of alignment quality (1-10),
    coverageMap: Description of how images overlap and cover the roof
  }
- measurementConsistency: {
    overallConsistency: Rating of measurement consistency across images (1-10),
    varianceReport: Reporting of significant measurement variances between images,
    reconciliationMethod: How measurements were reconciled across images
  }
- compositeModel: {
    completeness: Rating of the completeness of the composite roof model (1-10),
    missingAreas: Description of areas not adequately captured across images,
    confidenceDistribution: How confidence varies across different roof areas
  }

10. INSTALLATION QUALITY:
- alignmentQuality: Assessment of shingle alignment (1-10 scale)
- nailingPattern: Visible nailing pattern and adequacy
- exposureConsistency: Consistency of shingle exposure
- valleyInstallation: Quality of valley installation if visible
- flashingInstallation: Quality of flashing installation
- ridgeCapInstallation: Quality of ridge cap installation
- overallWorkmanship: Overall workmanship rating (1-10 scale)

11. HISTORICAL ANALYSIS:
- previousRepairs: {
    evidence: Evidence of previous repairs,
    locations: Array of locations with previous repairs,
    quality: Assessment of repair quality
  }
- previousReplacements: {
    evidence: Evidence of partial replacements,
    sections: Array of sections previously replaced
  }
- layering: {
    evidence: Evidence of multiple layers,
    estimatedLayers: Estimated number of layers present
  }
- ageConsistency: {
    isConsistent: Whether the roof appears to be of consistent age throughout,
    variations: Description of age variations if present
  }

12. EMERGENCY ASSESSMENT:
- emergencyIssuesDetected: Boolean indicating if emergency issues are present
- immediateConcerns: Array of issues requiring immediate attention
- safetyRisks: Description of potential safety risks
- waterInfiltrationRisk: Risk level for immediate water infiltration (1-10 scale)
- recommendedTimeframe: Recommended timeframe for addressing critical issues

ADVANCED MEASUREMENT TECHNIQUES:
1. Use standard architectural elements to establish scale:
   - Standard door heights (typically 80 inches)
   - Standard window heights (typically 60 inches for main floor)
   - Standard brick/siding dimensions
   - Standard shingle exposures (5-6 inches for asphalt shingles)
   - Typical eave overhangs (12-24 inches depending on architectural style)
   - Standard chimney dimensions
   - Standard skylight sizes
   - Standard roof vent dimensions

2. Apply photogrammetric principles with multiple images:
   - Identify matching points across multiple images
   - Calculate perspectives based on identified vanishing points
   - Triangulate dimensions from multiple viewing angles
   - Cross-reference measurements between images
   - Apply epipolar geometry to reconstruct 3D elements
   - Use parallax differences to determine relative distances
   - Build a composite 3D understanding from multiple 2D images

3. Use roof geometry principles:
   - Calculate pitch based on visible architectural elements and shadows
   - Apply Pythagorean theorem to determine true slope dimensions
   - Calculate true roof area by accounting for pitch (actual area vs. footprint)
   - Apply standard roof framing principles for unseen structural elements
   - Use symmetry principles for inaccessible areas based on visible sections
   - Apply correction factors for perspective distortion

4. Apply statistical confidence techniques:
   - Assign confidence scores to each measurement
   - Weight measurements based on clarity and reference reliability
   - Report margin of error for measurements based on image quality
   - Use multiple measurement methods to triangulate and improve accuracy
   - Apply higher confidence to measurements visible in multiple images
   - Report precision factors based on image quality and reference clarity

5. Use visual cues for material estimation:
   - Count courses of visible shingles to estimate total courses
   - Use standard exposure rates to calculate coverage
   - Calculate material quantities based on industry standard installation patterns
   - Apply appropriate overage factors based on roof complexity
   - Calculate accessory materials based on linear measurements
   - Identify waste factors based on cutting patterns required

RESPONSE QUALITY CONSIDERATIONS:
- Be specific with measurements and provide confidence level for each
- Indicate which measurements are direct observations vs. calculated estimates
- Note when measurements are derived from standard architectural proportions
- Clearly state limitations in measurement confidence due to image quality
- When only single images are available for a measurement, note the higher uncertainty
- Report error margins for measurements based on reference clarity
- Distinguish high-confidence measurements from low-confidence estimates
- For damage assessment, differentiate between cosmetic and functional issues
- Use precise terminology for roofing elements and their conditions
- Explain your measurement methodology for key dimensions

Ensure the entire response is properly formatted as valid JSON.
`;
    
    // Create the content array with all images
    const contentArray = [
      {
        type: "text",
        text: "Please analyze these multiple roof images to provide a comprehensive assessment with measurements. Use multiple images to improve measurement accuracy through triangulation."
      }
    ];
    
    // Add each image to the content array
    processedImages.forEach((imgBase64, index) => {
      contentArray.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${imgBase64}`,
          detail: "high"
        }
      });
    });
    
    // Create the OpenAI API request payload
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: enhancedSystemPrompt
        },
        {
          role: "user",
          content: contentArray
        }
      ],
      max_tokens: 4000,
      temperature: 0.2
    };
    
    // Call the OpenAI API with extended timeout
    try {
      console.log("Sending request to OpenAI API for multi-image analysis");
      
      // Set a longer timeout for multiple images (2 minutes)
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 120000 // 2 minute timeout
        }
      );
      
      console.log("OpenAI API response received successfully for multi-image analysis");
      
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
                parsedResults: jsonContent,
                imageCount: processedImages.length
              };
              console.log("Successfully parsed JSON content from multi-image response");
            } catch (parseError) {
              console.warn("Could not parse JSON match:", parseError);
            }
          }
        }
      } catch (jsonError) {
        console.warn("Could not extract structured JSON from multi-image response:", jsonError);
        // Continue with the original response
      }
      
      res.json(processedData);
    } catch (apiError) {
      handleApiError(apiError, res);
    }
  } catch (error) {
    // General error handling
    console.error('General error in multi-image request processing:', error);
    res.status(500).json({
      error: 'Server error processing multi-image request',
      message: error.message
    });
  }
});

// Helper function for handling API errors
function handleApiError(apiError, res) {
  console.error("OpenAI API call failed:");
  
  if (apiError.response) {
    // The request was made and the server responded with an error status
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
      error: 'No response received from OpenAI API (timeout or server error)',
      message: apiError.message
    });
  } else {
    // Error in setting up the request
    console.error('Error setting up request:', apiError.message);
    res.status(500).json({
      error: 'Error setting up OpenAI API request',
      message: apiError.message
    });
  }
}

// Handle root path
app.get('/', (req, res) => {
  res.send('Advanced Roof Analyzer API server is running. Use /api/analyze-roof-multiple endpoint for multi-image roof analysis.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Advanced Roof Analyzer server running on port ${PORT}`);
});

module.exports = app; // For testing purposes
