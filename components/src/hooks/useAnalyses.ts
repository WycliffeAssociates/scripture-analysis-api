import { useState, useEffect } from 'react';
import { fetchAnalyses } from '../api';
import type { Analysis } from '../types';

export function useAnalyses(apiUrl: string, repoId: string | null) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) {
      setAnalyses([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAnalyses(apiUrl, repoId)
      .then((data) => setAnalyses(data.analyses))
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl, repoId]);

  return { analyses, loading, error };
}

/** Format an analysis option label: short SHA + date */
export function analysisLabel(analysis: Analysis): string {
  const sha = analysis.commit_sha.slice(0, 7);
  const date = new Date(analysis.triggered_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${sha} — ${date}`;
}

/** Distinct commits from an analyses list, most recent first.
 *  If a dates map is provided (sha → ISO date string), the commit date is
 *  appended to the label; otherwise just the short SHA is shown. */
export function commitsFromAnalyses(
  analyses: Analysis[],
  dates: Record<string, string> = {},
): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  return analyses
    .filter((a) => {
      if (seen.has(a.commit_sha)) return false;
      seen.add(a.commit_sha);
      return true;
    })
    .map((a) => {
      const shortSha = a.commit_sha.slice(0, 7);
      const isoDate = dates[a.commit_sha];
      const dateStr = isoDate
        ? new Date(isoDate).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
          })
        : null;
      return {
        value: a.commit_sha,
        label: dateStr ? `${shortSha} — ${dateStr}` : shortSha,
      };
    });
}
