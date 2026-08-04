const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');
const jobStore = require('./services/jobStore');
const { closeBrowser } = require('./engine/crawler');

const app = express();
const port = process.env.PORT || 3001;

// Trust Render's reverse proxy so req.ip reflects the real client IP
// (used by the rate limiter — without this all requests share one bucket)
app.set('trust proxy', 1);

// Health check must come BEFORE the restrictive CORS middleware so any origin
// (including the frontend) can read the response. It returns no sensitive data.
app.get('/health', cors(), (req, res) => {
  console.log(`[health] ping from ${req.ip} at ${new Date().toISOString()}`);
  res.json({ status: 'ok' });
});

// ALLOWED_ORIGIN may be a comma-separated list of origins, e.g.:
//   https://www.leximeter.app,https://leximeter.app
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

console.log(`[cors] allowed origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g. server-to-server, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    }
  }
}));

app.use(express.json());

// Rate limiting: max 200 job submissions per real client IP per hour.
// We key on the first entry in X-Forwarded-For (the original client IP)
// rather than req.ip, because on Render's free tier the reverse proxy
// collapses all traffic to a single IP, causing every user to share one bucket.
const jobLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return (forwarded ? forwarded.split(',')[0] : req.ip).trim();
  },
  message: { error: 'Too many requests. Please try again in a few minutes.' }
});
app.use('/api/jobs', jobLimiter);

app.use('/api', apiRoutes);

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
