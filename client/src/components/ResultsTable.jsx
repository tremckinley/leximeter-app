/**
 * Results table and export controls shown after a job completes.
 */
export default function ResultsTable({ results, onExport, onReset }) {
  return (
    <div className="state-complete">
      <h2>Assessment Results</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Domain Name</th>
              <th>Status</th>
              <th>Language Count</th>
              <th>Languages</th>
              <th>Review Recommended</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.domain}>
                <td>{row.domain}</td>
                <td>{row.status}</td>
                <td>{row.languageCount}</td>
                <td>{row.languages}</td>
                <td>
                  <span className={`badge ${row.reviewRecommended === 'Yes' ? 'badge-warning' : 'badge-success'}`}>
                    {row.reviewRecommended}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" onClick={onExport}>Export to CSV</button>
      <button className="btn btn-secondary" onClick={onReset}>New Analysis</button>
      <p className="disclaimer">
        Analyses are not saved when you leave or refresh the page.{' '}
        <strong className="text-primary">Click &quot;Export to CSV&quot;</strong> to save your results.
      </p>
    </div>
  );
}
