import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnalysisBar } from './components/AnalysisBar';
import type { AnalysisBarSelection } from './types';
import './styles.css';

const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:8787';

function App() {
  const [selection, setSelection] = useState<AnalysisBarSelection>({
    org: null,
    repoId: null,
    commitSha: null,
    analysisType: null,
    analysisId: null,
  });

  return (
    <div>
      <AnalysisBar apiUrl={API_URL} onSelectionChange={setSelection} />
      <div className="p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Current selection
        </h2>
        <pre className="text-sm bg-white rounded border border-gray-200 p-4 shadow-sm">
          {JSON.stringify(selection, null, 2)}
        </pre>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
