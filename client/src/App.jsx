import { useState, useEffect } from 'react';
import './index.css';

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
          const res = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
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
      const res = await fetch(`http://localhost:3001/api/jobs/${jobId}/results`);
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
      const res = await fetch('http://localhost:3001/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains })
      });
      const data = await res.json();
      
      if (res.ok) {
        setJobId(data.jobId);
        setJobStatus('queued');
        setJobProgress(0);
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
    link.setAttribute('download', 'language_finder_summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-container">
      <h1>Language Finder</h1>
      <p className="subtitle">Discover published languages across your domains instantly.</p>
      
      {errorMsg && (
        <div style={{ color: 'var(--error)', marginBottom: '1rem', textAlign: 'center', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
          {errorMsg}
        </div>
      )}

      {jobStatus === 'idle' && (
        <div className="state-ready">
          <textarea 
            placeholder="Paste domains here... (one per line)&#10;example.com&#10;gymshark.com"
            value={domainsInput}
            onChange={(e) => setDomainsInput(e.target.value)}
          />
          <button className="btn" onClick={handleStartAnalysis}>Run Analysis</button>
        </div>
      )}

      {(jobStatus === 'queued' || jobStatus === 'running') && (
        <div className="loader-container">
          <div className="spinner"></div>
          <h2 style={{ marginBottom: '1rem' }}>Analysis Running</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Please keep this page open. Processing domain {jobCurrent} of {jobTotal}...</p>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${jobProgress}%` }}></div>
          </div>
        </div>
      )}

      {jobStatus === 'complete' && (
        <div className="state-complete">
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
          <button className="btn" onClick={downloadCSV}>Download CSV</button>
          <button className="btn btn-secondary" onClick={handleReset}>Analyze New Domains</button>
        </div>
      )}
    </div>
  );
}

export default App;
