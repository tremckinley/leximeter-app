const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jobStore = require('../services/jobStore');
const { processDomains } = require('../engine/crawler');

const router = express.Router();

const MAX_DOMAINS = 50;

router.post('/jobs', (req, res) => {
  const { domains } = req.body;

  if (!domains || !Array.isArray(domains)) {
    return res.status(400).json({ error: 'Request body must include a "domains" array.' });
  }
  if (domains.length === 0) {
    return res.status(400).json({ error: 'At least one domain is required.' });
  }
  if (domains.length > MAX_DOMAINS) {
    return res.status(400).json({ error: `Maximum ${MAX_DOMAINS} domains per request.` });
  }

  const jobId = uuidv4();
  
  jobStore.set(jobId, {
    id: jobId,
    status: 'queued',
    domains,
    progress: 0,
    results: []
  });

  // Start processing asynchronously
  processDomains(jobId, domains).catch(console.error);

  res.json({ jobId, status: 'queued' });
});

router.get('/jobs/:id', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  res.json({
    status: job.status,
    progress: job.progress,
    current: job.current || 0,
    total: job.total || 0
  });
});

router.get('/jobs/:id/results', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  if (job.status !== 'complete') {
    return res.status(400).json({ error: 'Job is not yet complete.' });
  }
  res.json(job.results);
});

module.exports = router;
