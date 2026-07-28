/**
 * Domain input form shown in the idle state.
 * Accepts serverStatus ('checking' | 'warming' | 'ready') to gate submission
 * while the Render backend is cold-starting.
 */
export default function DomainInput({ value, onChange, onSubmit, serverStatus }) {
  const isReady = serverStatus === 'ready';
  const isWarming = serverStatus === 'warming';

  return (
    <div className="state-ready">
      <h3>Enter Domains</h3>
      <p className="text-muted">Provide one fully qualified domain per line.</p>
      <textarea
        aria-label="Domain list"
        placeholder={"water.org\nstanford.edu\nfifa.com"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {isWarming && (
        <div className="warmup-banner" role="status" aria-live="polite">
          <span className="warmup-dot" aria-hidden="true" />
          <span>
            The server is waking up — this can take up to 60 seconds on first visit.
            Analysis will be available shortly.
          </span>
        </div>
      )}

      <button
        className="btn"
        onClick={onSubmit}
        disabled={!isReady}
        aria-disabled={!isReady}
        title={!isReady ? 'Waiting for the server to start…' : undefined}
      >
        {isReady ? 'Start Analysis' : 'Connecting…'}
      </button>

      <p className="disclaimer">
        Analyses are not saved when you leave or refresh the page.{' '}
        <strong className="text-primary">Click &quot;Export to CSV&quot;</strong> to save your results.
      </p>
    </div>
  );
}
