import { useState, useEffect } from 'react';
import { fetchAnalysisTypes } from '../api';
import type { AnalysisType } from '../types';

export function useAnalysisTypes(apiUrl: string) {
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAnalysisTypes(apiUrl)
      .then((data) => setAnalysisTypes(data.analysis_types))
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  return { analysisTypes, loading, error };
}
