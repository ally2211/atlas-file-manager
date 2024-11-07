const express = require('express');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 5000;

// Load routes
app.use('/', routes);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
