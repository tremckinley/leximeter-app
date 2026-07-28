/**
 * Spinner and progress bar shown while a job is queued or running.
 * aria-live="polite" ensures screen readers announce status updates.
 */
export default function ProgressView({ current, total, progress }) {
  return (
    <div className="loader-container" aria-live="polite" aria-atomic="false">
      <div className="spinner" role="status" aria-label="Analysis in progress" />
      <h2>Analysis in Progress</h2>
      <p>Please keep this page open. Processing domain {current} of {total}...</p>
      <div
        className="progress-bar-bg"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress}% complete`}
      >
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
