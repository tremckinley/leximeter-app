import { useState, useEffect } from 'react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [domainsInput, setDomainsInput] = useState('');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle'); // idle, queued, running, complete, error
  const [jobProgress, setJobProgress] = useState(0);
  const [jobCurrent, setJobCurrent] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Poll for job status
  useEffect(() => {
    let interval;
    if (jobStatus === 'queued' || jobStatus === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
          const data = await res.json();
          if (res.ok) {
            setJobStatus(data.status);
            setJobProgress(data.progress || 0);
            setJobCurrent(data.current || 0);
            setJobTotal(data.total || 0);
            
            if (data.status === 'complete') {
              fetchResults();
            }
          } else {
            setJobStatus('error');
            setErrorMsg(data.error || 'Failed to fetch status');
          }
        } catch (err) {
          console.error(err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobStatus, jobId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}/results`);
      const data = await res.json();
      if (res.ok) {
        setResults(data);
      } else {
        setJobStatus('error');
        setErrorMsg('Failed to fetch results');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartAnalysis = async () => {
    setErrorMsg('');
    const domains = domainsInput
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
      
    if (domains.length === 0) {
      setErrorMsg('Please enter at least one domain.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains })
      });
      const data = await res.json();
      
      if (res.ok) {
        setJobId(data.jobId);
        setJobStatus('queued');
        setJobProgress(0);
        setJobCurrent(0);
        setJobTotal(0);
        setResults([]);
      } else {
        setErrorMsg(data.error || 'Failed to start job');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to connect to server');
    }
  };

  const handleReset = () => {
    setJobId(null);
    setJobStatus('idle');
    setJobProgress(0);
    setJobCurrent(0);
    setJobTotal(0);
    setResults([]);
    setErrorMsg('');
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    
    const headers = ['Domain Name', 'Status', 'Language Count', 'Languages', 'Review Recommended'];
    const csvRows = [headers.join(',')];
    
    for (const r of results) {
      csvRows.push([
        r.domain,
        `"${r.status || '-'}"`,
        r.languageCount,
        `"${r.languages}"`,
        r.reviewRecommended
      ].join(','));
    }
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'leximeter_summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-layout">
      {/* Main Panel (Left 2/3) */}
      <main className="main-panel">
        <h1>Leximeter</h1>
        <p className="subtitle">Discover the languages a domain contains</p>
        
        {errorMsg && (
          <div className="error-banner">
            {errorMsg}
          </div>
        )}

        {jobStatus === 'idle' && (
          <div className="state-ready">
            <h3>Enter Domains</h3>
            <p style={{color: 'var(--text-muted)'}}>Provide one fully qualified domain per line.</p>
            <textarea 
              placeholder="water.org&#10;stanford.edu&#10;fifa.com"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
            />
            <button className="btn" onClick={handleStartAnalysis}>Start Analysis</button>
            <p style={{fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', marginTop: '1em', color: 'var(--text-muted)', fontStyle: 'italic'}}>Analyses are not saved when you leave or refresh the page. <strong style={{color: 'var(--primary)'}}>Click "Export to CSV"</strong> to save your results.</p>
          </div>
        )}

        {(jobStatus === 'queued' || jobStatus === 'running') && (
          <div className="loader-container">
            <div className="spinner"></div>
            <h2>Analysis in Progress</h2>
            <p>Please keep this page open. Processing domain {jobCurrent} of {jobTotal}...</p>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${jobProgress}%` }}></div>
            </div>
          </div>
        )}

        {jobStatus === 'complete' && (
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
                  {results.map((row, idx) => (
                    <tr key={idx}>
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
            <button className="btn" onClick={downloadCSV}>Export to CSV</button>
            <button className="btn btn-secondary" onClick={handleReset}>New Analysis</button>
            <p style={{fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', marginTop: '1em', color: 'var(--text-muted)', fontStyle: 'italic'}}>Analyses are not saved when you leave or refresh the page. <strong style={{color: 'var(--primary)'}}>Click "Export to CSV"</strong> to save your results.</p>
          </div>
        )}
      </main>

      {/* Side Panel (Right 1/3) */}
      <aside className="side-panel">
        <h2>About Leximeter</h2>
        <div className="side-panel-content">
          <p>
            Leximeter is a web diagnostic tool designed to determine the languages present across a given domain for SEO and Web Accessibility purposes.
          </p>
          
          <h3>Instructions</h3>
          <ul>
            <li>Paste or type a list of root domains into the input field.</li>
            <li>Do not include URL paths (e.g., use <code>water.org</code> instead of <code>water.org/es-us</code>).</li>
            <li>Click <strong>Start Analysis</strong> to begin the diagnostic crawl.</li>
          </ul>

          <h3>Methodology</h3>
          <p>
            Leximeter performs a breadth-first search of up to five pages per domain, waiting for framework hydration only when a Single Page Application (SPA) is detected. It identifies languages by extracting <code>html lang</code> attributes, <code>hreflang</code> declarations, and analyzing URL paths.<br/><br/><strong>Note</strong>: If a SPA is detected and returns 1 or fewer languages, the domain is automatically flagged for manual review.
          </p>

          <div className="copyright">
            Built and maintained by <a href="https://github.com/tremckinley" target="_blank" rel="noopener noreferrer">Tremaine McKinley</a>
          </div>
          
        </div>
      </aside>
    </div>
  );
}

export default App;
