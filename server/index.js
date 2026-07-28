const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const jobStore = require('./services/jobStore');
const { closeBrowser } = require('./engine/crawler');

const app = express();
const port = process.env.PORT || 3001;

// Scope CORS to the known frontend origin
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
}));

app.use(express.json());

// Rate limiting: max 10 job submissions per IP per 15 minutes
const jobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' }
});
app.use('/api/jobs', jobLimiter);

app.use('/api', apiRoutes);

// Health check for deployment platforms (Render, etc.)
app.get('/health', (req, res) => {
  console.log(`[health] ping from ${req.ip} at ${new Date().toISOString()}`);
  res.json({ status: 'ok' });
});

// Evict stale jobs from memory every 30 minutes
const evictionInterval = setInterval(() => jobStore.evict(), 30 * 60 * 1000);

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Graceful shutdown — close the browser and drain connections before exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  clearInterval(evictionInterval);
  await closeBrowser();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
