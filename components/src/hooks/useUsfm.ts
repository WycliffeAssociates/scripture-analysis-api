import { useState, useEffect } from 'react';
import { parseGiteaUrl, fetchGiteaRootContents, fetchGiteaFileContent } from '../api';

/** Parsed USFM: chapter → verse → verse text */
export type ParsedUsfm = Record<number, Record<number, string>>;

/**
 * Module-level cache so the same commit+book is only fetched once per
 * browser session even if the hook mounts multiple times.
 * Key: "owner/repo/sha/BOOKCODE"
 */
const usfmCache = new Map<string, Promise<string | null>>();

/** Minimal USFM parser — strips footnotes, cross-refs, and most markers. */
export function parseUsfm(text: string): ParsedUsfm {
  const book: ParsedUsfm = {};
  const cleanText = text
    .replace(/\\f\s.+?\\f\*/g, '')
    .replace(/\\x\s.+?\\x\*/g, '')
    .replace(/\\w\s.+?\\w\*/g, '')
    .replace(/\\r/g, '')
    .replace(/\\s\d/g, '')
    .replace(/\\p/g, '')
    .replace(/\\q\d?/g, '')
    .replace(/\\b/g, '')
    .replace(/\\m/g, '')
    .replace(/\\nb/g, '');

  const chapters = cleanText.split(/\\c\s+(\d+)/);
  for (let i = 1; i < chapters.length; i += 2) {
    const chapterNum = parseInt(chapters[i] ?? '', 10);
    const content = chapters[i + 1] ?? '';
    book[chapterNum] = {};

    const verses = content.split(/\\v\s+(\d+)/);
    for (let j = 1; j < verses.length; j += 2) {
      const verseNum = parseInt(verses[j] ?? '', 10);
      let verseText = verses[j + 1] ?? '';
      verseText = verseText.replace(/\\[a-z0-9]+\s?/g, ' ').replace(/\s+/g, ' ').trim();
      if (verseText) book[chapterNum]![verseNum] = verseText;
    }
  }
  return book;
}

/**
 * Fetches and parses a USFM file from a Gitea repo.
 * Uses module-level promise cache to avoid duplicate requests.
 *
 * @param gitUrl  - The git_url from the Repo record (e.g. "https://gitea.example.com/org/repo.git")
 * @param sha     - Commit SHA to pin the fetch to
 * @param book    - USFM book code, e.g. "PSA", "GEN"
 */
export function useUsfm(
  gitUrl: string | null,
  sha: string | null,
  book: string | null,
): { usfm: ParsedUsfm | null; loading: boolean } {
  const [usfm, setUsfm] = useState<ParsedUsfm | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gitUrl || !sha || !book) {
      setUsfm(null);
      return;
    }

    const info = parseGiteaUrl(gitUrl);
    if (!info) {
      setUsfm(null);
      return;
    }

    const cacheKey = `${info.owner}/${info.repo}/${sha}/${book.toUpperCase()}`;

    let pending = usfmCache.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        const entries = await fetchGiteaRootContents(info.apiBase, info.owner, info.repo, sha);
        if (!entries) return null;

        // Find the .usfm file whose name contains the book code (case-insensitive)
        const bookUpper = book.toUpperCase();
        const entry = entries.find(
          (e) =>
            e.type === 'file' &&
            e.name.toUpperCase().endsWith('.USFM') &&
            e.name.toUpperCase().includes(bookUpper),
        );
        if (!entry) return null;

        // Use the Gitea contents API (CORS-safe) rather than the raw download
        // URL, which is served without CORS headers by most Gitea instances.
        return fetchGiteaFileContent(info.apiBase, info.owner, info.repo, entry.path, sha);
      })();
      usfmCache.set(cacheKey, pending);
    }

    let cancelled = false;
    setLoading(true);
    pending
      .then((raw) => {
        if (cancelled) return;
        setUsfm(raw ? parseUsfm(raw) : null);
      })
      .catch(() => {
        if (!cancelled) setUsfm(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [gitUrl, sha, book]);

  return { usfm, loading };
}
