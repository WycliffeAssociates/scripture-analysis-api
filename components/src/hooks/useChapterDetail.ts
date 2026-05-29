import { useState, useEffect } from 'react';
import { fetchChapterDetail } from '../api';
import type { ChapterDetail } from '../types';

export function useChapterDetail(
  apiUrl: string,
  repoId: string | null,
  book: string | null,
  chapter: number | null,
  commit?: string | null,
) {
  const [detail, setDetail] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId || !book || chapter == null) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchChapterDetail(apiUrl, repoId, book, chapter, commit)
      .then(setDetail)
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl, repoId, book, chapter, commit]);

  return { detail, loading, error };
}
