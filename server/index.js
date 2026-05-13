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
