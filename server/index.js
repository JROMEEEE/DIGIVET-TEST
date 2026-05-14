require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware — allow configured CLIENT_URL, localhost, and any onrender.com domain
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow onrender.com domains (any subdomain)
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    // Allow configured origins
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Root
app.get('/', (req, res) => {
  res.json({ name: 'DIGIVET Online API', status: 'running', version: '1.0.0' });
});

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/status', require('./routes/status'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vetdata', require('./routes/vetdata'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/sync', require('./routes/sync'));



// app.use('/api/animals', require('./routes/animals'));
// app.use('/api/clients', require('./routes/clients'));
// app.use('/api/appointments', require('./routes/appointments'));

const { router: credRouter, runFullProvision } = require('./routes/credentials');
app.use('/api/credentials', credRouter);


app.listen(PORT, () => {
  console.log(`DIGIVET server running on port ${PORT}`);

  const TEN_MINUTES = 10 * 60 * 1000;

  const poll = () => {
    runFullProvision()
      .then(r => {
        if (r.staged > 0) console.log(`[credentials] Staged ${r.staged} new owner(s)`);
        if (r.sent > 0)   console.log(`[credentials] Sent credentials to ${r.sent} owner(s)`);
      })
      .catch(e => console.error('[credentials] Error:', e.message));
  };

  poll();
  setInterval(poll, TEN_MINUTES);
});
