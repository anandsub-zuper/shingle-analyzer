const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Immediate logging at startup
console.log('Application starting...');
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Hello from Cloud Run!');
});

// Add more endpoints to help debug
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Listen with proper error handling
try {
  const server = app.listen(PORT, () => {
    console.log(`Server successfully listening on port ${PORT}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error occurred:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
