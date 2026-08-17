import { useState, useEffect } from 'react';
import { parseGiteaUrl, fetchGiteaRootContents, fetchGiteaFileContent } from '../api';
import initWasm, { parse as parseSegments } from '../vendor/treeless-usfm-wasm/treeless_usfm_wasm.js';

/** Parsed USFM: chapter → verse → verse text */
export type ParsedUsfm = Record<number, Record<number, string>>;

/**
 * Module-level cache so the same commit+book is only fetched once per
 * browser session even if the hook mounts multiple times.
 * Key: "owner/repo/sha/BOOKCODE"
 */
const usfmCache = new Map<string, Promise<string | null>>();

/** One text run plus the marker state it was emitted under (treeless-usfm). */
interface Segment {
  text: string;
  state: {
    book?: string;
    chapter?: number;
    /** Raw verse token — may be a bridge ("2-3") or letter-suffixed ("3b"). */
    verse?: string;
    paragraph?: { marker: string; level?: number };
    character_stack: { marker: string; level?: number }[];
    note?: { kind: string; caller: string };
  };
}

/**
 * Block markers that are not scripture body text. Levels are already stripped
 * by the parser, so `\s1` arrives as `s` and `\toc1` as `toc`. Everything here
 * is skipped: headings and titles sit *between* verses, and the parser keeps
 * the previous `\v` in scope, so without this they would be appended to the
 * preceding verse.
 */
const NON_BODY_BLOCKS = new Set([
  'id', 'ide', 'usfm', 'h', 'toc', 'toca', 'rem', 'sts', 'c',
  'mt', 'mte', 'ms', 'mr', 's', 'sr', 'r', 'sp', 'sd', 'cl', 'cp',
  'imt', 'imte', 'is', 'ip', 'ipi', 'im', 'imi', 'ipq', 'imq', 'ipr',
  'ib', 'ili', 'iot', 'io', 'iex', 'ie', 'periph',
]);

/** Promise for the one-time wasm instantiation; `null` until first use. */
let wasmReady: Promise<unknown> | null = null;

/**
 * Loads the treeless-usfm wasm module. Idempotent — repeated calls share the
 * same promise. Callers may await this early (e.g. on app boot) to warm the
 * parser; `parseUsfm` awaits it anyway.
 */
export function initUsfmParser(): Promise<unknown> {
  if (!wasmReady) wasmReady = initWasm();
  return wasmReady;
}

/**
 * Strip USFM attribute syntax (`|lemma="…"`) from a text run inside a
 * character span, where `|` is reserved for attributes. Mirrors the
 * treeless-usfm `Dict` behaviour.
 */
function stripAttrSyntax(text: string, inChar: boolean): string {
  if (!inChar) return text;
  const idx = text.lastIndexOf('|');
  return idx === -1 ? text : text.slice(0, idx);
}

/** If `verse` is a bridge like "2-3" (or "2a-3b"), return every number it covers. */
function bridgeRange(verse: string): number[] | null {
  const dash = verse.indexOf('-');
  if (dash === -1) return null;
  const start = parseInt(verse.slice(0, dash), 10);
  const end = parseInt(verse.slice(dash + 1), 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  const out: number[] = [];
  for (let v = start; v <= end; v++) out.push(v);
  return out;
}

/**
 * Parse USFM into chapter → verse → text using the treeless-usfm wasm parser.
 *
 * Footnotes, cross-references, headings, and front matter are excluded; verse
 * bridges (`\v 2-3`) are expanded so each verse in the range returns the
 * bridged text. Async because the wasm module is instantiated on first use.
 */
export async function parseUsfm(text: string): Promise<ParsedUsfm> {
  await initUsfmParser();
  const segments = parseSegments(text) as Segment[];

  // Accumulate raw text runs per "chapter:verseToken", in document order, so
  // spacing at character-style boundaries survives until the final normalise.
  const parts = new Map<string, { chapter: number; verse: string; texts: string[] }>();

  for (const seg of segments) {
    const { chapter, verse, note, paragraph, character_stack } = seg.state;
    if (chapter === undefined || verse === undefined) continue;
    if (note) continue;
    if (paragraph && NON_BODY_BLOCKS.has(paragraph.marker)) continue;

    const txt = stripAttrSyntax(seg.text, character_stack.length > 0);
    if (!txt) continue;

    const key = `${chapter}:${verse}`;
    let entry = parts.get(key);
    if (!entry) {
      entry = { chapter, verse, texts: [] };
      parts.set(key, entry);
    }
    entry.texts.push(txt);
  }

  const book: ParsedUsfm = {};
  for (const { chapter, verse, texts } of parts.values()) {
    const full = texts.join('').split(/\s+/).filter(Boolean).join(' ');
    if (!full) continue;

    // "2-3" covers verses 2 and 3; "3b" and a bare "3" both land on verse 3.
    const targets = bridgeRange(verse) ?? [parseInt(verse, 10)];
    const chapterVerses = (book[chapter] ??= {});
    for (const num of targets) {
      if (!Number.isFinite(num)) continue;
      const existing = chapterVerses[num];
      chapterVerses[num] = existing ? `${existing} ${full}` : full;
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
      .then((raw) => (raw ? parseUsfm(raw) : null))
      .then((parsed) => {
        if (!cancelled) setUsfm(parsed);
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
