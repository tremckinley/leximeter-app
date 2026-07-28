import { useState, useCallback, useEffect } from 'react';
import { useJobPoller } from './hooks/useJobPoller';
import DomainInput from './components/DomainInput';
import ProgressView from './components/ProgressView';
import ResultsTable from './components/ResultsTable';
import SidePanel from './components/SidePanel';

// Empty string = same-origin (relies on Vite proxy in dev, real domain in prod)
const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  const [domainsInput, setDomainsInput] = useState('');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle'); // idle | queued | running | complete | error
  const [jobProgress, setJobProgress] = useState(0);
  const [jobCurrent, setJobCurrent] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  // 'checking' = initial ping, 'warming' = cold-start in progress, 'ready' = server up
  const [serverStatus, setServerStatus] = useState('checking');

  // Ping /health on mount and retry until the server responds.
  // Render's free tier can take up to 60 seconds to cold-start.
  useEffect(() => {
    let retryTimer;
    let hasShownWarming = false;

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
          setServerStatus('ready');
          return;
        }
      } catch {
        // Timed out or connection refused — server is still warming up
      }

      if (!hasShownWarming) {
        hasShownWarming = true;
        setServerStatus('warming');
      }
      retryTimer = setTimeout(checkHealth, 4000);
    };

    checkHealth();
    return () => clearTimeout(retryTimer);
  }, []);

  // Fetches final results once the poller signals completion.
  // Wrapped in useCallback so its reference is stable for the hook's ref pattern.
  const fetchResults = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${id}/results`);
      const data = await res.json();
      if (res.ok) {
        setResults(data);
      } else {
        setJobStatus('error');
        setErrorMsg('Failed to fetch results.');
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handlePollUpdate = useCallback((data) => {
    if (data.status === 'error') {
      setJobStatus('error');
      setErrorMsg(data.error || 'An error occurred during analysis.');
      return;
    }
    setJobStatus(data.status);
    setJobProgress(data.progress || 0);
    setJobCurrent(data.current || 0);
    setJobTotal(data.total || 0);
  }, []);

  useJobPoller(jobId, jobStatus, handlePollUpdate, fetchResults);

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
        setErrorMsg(data.error || 'Failed to start job.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to connect to server.');
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
    URL.revokeObjectURL(url); // Release the object URL to free memory
  };

  return (
    <div className="app-layout">
      <main className="main-panel">
        <div className="heading-row">
          <h1>Leximeter</h1>
        </div>
        <p className="subtitle">Discover the languages a domain contains</p>

        {errorMsg && (
          <div className="error-banner" role="alert">{errorMsg}</div>
        )}

        {jobStatus === 'idle' && (
          <DomainInput
            value={domainsInput}
            onChange={setDomainsInput}
            onSubmit={handleStartAnalysis}
            serverStatus={serverStatus}
          />
        )}

        {(jobStatus === 'queued' || jobStatus === 'running') && (
          <ProgressView
            current={jobCurrent}
            total={jobTotal}
            progress={jobProgress}
          />
        )}

        {jobStatus === 'complete' && (
          <ResultsTable
            results={results}
            onExport={downloadCSV}
            onReset={handleReset}
          />
        )}
      </main>

      <SidePanel />
    </div>
  );
}

export default App;
