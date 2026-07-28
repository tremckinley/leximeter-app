// In-memory job store with TTL eviction to prevent unbounded memory growth
const jobs = new Map();
const TTL_MS = 60 * 60 * 1000; // Expire jobs after 1 hour of inactivity

const jobStore = {
  get: (id) => jobs.get(id),

  set: (id, job) => jobs.set(id, { ...job, _updatedAt: Date.now() }),

  /** Delete jobs that haven't been updated in over TTL_MS. Call on a recurring interval. */
  evict: () => {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, job] of jobs) {
      if (job._updatedAt < cutoff) jobs.delete(id);
    }
  }
};

module.exports = jobStore;
