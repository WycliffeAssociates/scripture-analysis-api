import { useState, useEffect } from 'react';
import { fetchBookSummary } from '../api';
import type { BookSummary } from '../types';

export function useBookSummary(
  apiUrl: string,
  repoId: string | null,
  book: string | null,
  commit?: string | null,
) {
  const [summary, setSummary] = useState<BookSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId || !book) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchBookSummary(apiUrl, repoId, book, commit)
      .then(setSummary)
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl, repoId, book, commit]);

  return { summary, loading, error };
}
