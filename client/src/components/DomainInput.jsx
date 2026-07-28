/**
 * Domain input form shown in the idle state.
 */
export default function DomainInput({ value, onChange, onSubmit }) {
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
      <button className="btn" onClick={onSubmit}>Start Analysis</button>
      <p className="disclaimer">
        Analyses are not saved when you leave or refresh the page.{' '}
        <strong className="text-primary">Click &quot;Export to CSV&quot;</strong> to save your results.
      </p>
    </div>
  );
}
