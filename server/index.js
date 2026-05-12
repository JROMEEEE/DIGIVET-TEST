require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/health', require('./routes/health'));
// app.use('/api/animals', require('./routes/animals'));
// app.use('/api/clients', require('./routes/clients'));
// app.use('/api/appointments', require('./routes/appointments'));

app.listen(PORT, () => {
  console.log(`DIGIVET server running on port ${PORT}`);
});
