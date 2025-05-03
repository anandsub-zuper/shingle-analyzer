const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Hello from Cloud Run!');
});

// Important: bind to 0.0.0.0
console.log('Starting server...');
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
