# Shingle Analyzer Frontend

This is the frontend application for the Roofing Shingle Analyzer. It allows users to upload images of roofing shingles and receive AI-powered analysis of their specifications.

## Features

- Image upload and preview
- Integration with OpenAI Vision API through a proxy server
- Detailed display of shingle specifications
- Mobile-responsive design

## Setup Instructions

1. **Install dependencies**
   ```
   npm install
   ```

2. **Configure the backend API endpoint**
   Open `src/components/ShingleAnalyzer.jsx` and update the API endpoint URL to point to your backend server:
   ```javascript
   const response = await fetch('https://your-backend-server.com/api/analyze-shingle', {
     // ... rest of the code
   });
   ```

3. **Start the development server**
   ```
   npm start
   ```

4. **Build for production**
   ```
   npm run build
   ```

## How It Works

1. User uploads an image of a roofing shingle
2. The image is converted to base64 format
3. The image data and provided API key are sent to the backend server
4. The backend server forwards the request to OpenAI's Vision API
5. The AI analyzes the image and returns specifications
6. Results are displayed to the user

## Important Notes

- This application requires a backend server to proxy requests to OpenAI. Direct requests from the browser to OpenAI will fail due to CORS restrictions.
- The backend server code is available in the `backend` directory of this repository.
- You need a valid OpenAI API key with access to the Vision API to use this application.

## Technologies Used

- React
- JavaScript (ES6+)
- CSS3
- OpenAI Vision API (via backend)
