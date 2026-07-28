import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAX_POLL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Polls the job status endpoint on a 2-second interval while the job is active.
 * Calls onUpdate(data) on every tick, and onComplete(jobId) when the job finishes.
 * Automatically times out after MAX_POLL_MS and reports an error.
 *
 * @param {string|null} jobId
 * @param {string} jobStatus
 * @param {(data: object) => void} onUpdate
 * @param {(id: string) => void} onComplete
 */
export function useJobPoller(jobId, jobStatus, onUpdate, onComplete) {
  // Refs so callbacks are always current without re-triggering the effect
  const onUpdateRef = useRef(onUpdate);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onUpdateRef.current = onUpdate; });
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (jobStatus !== 'queued' && jobStatus !== 'running') return;

    const startTime = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_MS) {
        clearInterval(interval);
        onUpdateRef.current({ status: 'error', error: 'Analysis timed out after 10 minutes.' });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
        const data = await res.json();

        if (res.ok) {
          onUpdateRef.current(data);
          if (data.status === 'complete') {
            onCompleteRef.current(jobId);
          }
        } else {
          onUpdateRef.current({ status: 'error', error: data.error || 'Failed to fetch job status.' });
        }
      } catch {
        // Network error — keep polling silently
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]); // Only restart the interval when job identity or phase changes
}
