const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Hello from Cloud Run!');
});

// Enhanced logging
console.log('Starting server initialization...');
console.log(`PORT environment variable: ${process.env.PORT}`);

try {
  // Only listen once!
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully listening on 0.0.0.0:${PORT}`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
}
