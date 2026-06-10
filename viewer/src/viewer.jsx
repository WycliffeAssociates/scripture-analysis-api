import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen, ChevronLeft, ChevronDown, ChevronUp, ChevronRight,
  Loader2, GripVertical,
} from 'lucide-react';

import { useRepos, orgFromGitUrl } from '@scripture-analysis/components';
import { useAnalyses } from '@scripture-analysis/components';
import { useProjectSummary } from '@scripture-analysis/components';
import { useBookSummary } from '@scripture-analysis/components';
import { useChapterDetail } from '@scripture-analysis/components';
import { useUsfm } from '@scripture-analysis/components';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

// ── Markdown ──────────────────────────────────────────────────────────────────

const md = {
  ul:         (p) => <ul         className="list-disc pl-5 mb-2 space-y-1" {...p} />,
  ol:         (p) => <ol         className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
  li:         (p) => <li         className="pl-1" {...p} />,
  h3:         (p) => <h3         className="text-sm font-bold text-gray-900 mt-2 mb-1" {...p} />,
  p:          (p) => <p          className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  strong:     (p) => <strong     className="font-bold text-gray-900" {...p} />,
  em:         (p) => <em         className="italic text-gray-800" {...p} />,
  code:       (p) => <code       className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono" {...p} />,
};

// ── Severity helpers ──────────────────────────────────────────────────────────

/** Given a list of items for a specific verse + type, return a severity descriptor. */
function calcSeverity(items, type) {
  if (!items || items.length === 0) return null;
  if (type === 'interpresure_qa') {
    const failing = items.filter((i) => i.observation.result !== 'pass');
    if (failing.length === 0) return { kind: 'pass', value: 0 };
    const max = Math.max(...failing.map((i) => i.observation.severity ?? 0));
    return { kind: 'severity', value: max };
  }
  if (type === 'interpresure_suggestions') {
    // Show the lowest (worst) score across all items — draws attention to weak verses.
    const scores = items.map((i) => i.observation.score).filter((s) => s != null);
    if (scores.length === 0) return { kind: 'count', value: items.length };
    return { kind: 'score', value: Math.min(...scores) };
  }
  return { kind: 'count', value: items.length };
}

function SeverityDot({ sev, size = 'md' }) {
  const sm = size === 'sm';
  if (!sev) return <span className={`inline-block rounded-full bg-gray-200 ${sm ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />;
  if (sev.kind === 'pass')
    return <span className={`inline-block rounded-full bg-green-400 ${sm ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />;
  if (sev.kind === 'severity') {
    // Severity: higher = worse → red
    const v = sev.value;
    const col = v >= 7 ? 'bg-red-500' : v >= 4 ? 'bg-amber-400' : 'bg-yellow-300';
    return (
      <span className={`inline-flex items-center justify-center rounded-full font-bold text-white text-[9px] ${col} ${sm ? 'w-4 h-4' : 'w-5 h-5'}`}>
        {v}
      </span>
    );
  }
  if (sev.kind === 'score') {
    // Score: higher = better → green; lower = worse → red
    const v = sev.value;
    const col = v >= 8 ? 'bg-green-500 text-white' : v >= 6 ? 'bg-yellow-400 text-gray-800' : v >= 4 ? 'bg-amber-400 text-gray-800' : 'bg-red-500 text-white';
    return (
      <span className={`inline-flex items-center justify-center rounded-full font-bold text-[9px] ${col} ${sm ? 'w-4 h-4' : 'w-5 h-5'}`}>
        {v}
      </span>
    );
  }
  // count
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold text-indigo-700 bg-indigo-100 text-[9px] ${sm ? 'w-4 h-4' : 'w-5 h-5'}`}>
      {sev.value}
    </span>
  );
}

function ScoreBar({ score, max = 10 }) {
  const pct = Math.min(Math.max((score / max) * 100, 0), 100);
  const color = score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-400' : score >= 4 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-600 w-5 text-right">{score}</span>
    </div>
  );
}

// ── Chapter heat-map cell ─────────────────────────────────────────────────────

function chapterCellColor(itemCount) {
  if (!itemCount) return 'bg-gray-100 text-gray-400 hover:bg-gray-200';
  if (itemCount <= 3)  return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200';
  if (itemCount <= 8)  return 'bg-indigo-300 text-indigo-900 hover:bg-indigo-400';
  return 'bg-indigo-500 text-white hover:bg-indigo-600';
}

// ── Observation renderers ─────────────────────────────────────────────────────

function InterPresureQA({ obs }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const badge = { pass: 'bg-green-50 text-green-700 border-green-200', fail: 'bg-red-50 text-red-700 border-red-200', na: 'bg-amber-50 text-amber-700 border-amber-200' }[obs.result] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const label = { pass: 'Pass', fail: 'Fail', na: 'Needs Review' }[obs.result] ?? obs.result;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-800 leading-relaxed italic">"{obs.question}"</p>
      <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
        <ReactMarkdown components={md}>{obs.answer}</ReactMarkdown>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge}`}>{label}</span>
        {obs.result !== 'pass' && (
          <span className="text-xs text-gray-500">Severity <span className={`font-bold ${obs.severity >= 7 ? 'text-red-600' : obs.severity >= 4 ? 'text-amber-600' : 'text-gray-600'}`}>{obs.severity}/10</span></span>
        )}
        <span className="text-xs text-gray-500">Confidence <span className="font-bold text-gray-600">{obs.confidence}%</span></span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{obs.model}</span>
      </div>
      {obs.result !== 'pass' && <ScoreBar score={obs.severity} />}
      {obs.reasoning && (
        <div>
          <button onClick={() => setShowReasoning((v) => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {showReasoning ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
          </button>
          {showReasoning && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 prose prose-sm max-w-none">
              <ReactMarkdown components={md}>{obs.reasoning}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InterPresureSuggestions({ obs }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = obs.reasoning || obs.score != null || obs.confidence != null
    || obs.cross_references?.length > 0 || obs.verses_to_review?.length > 0 || obs.resources?.length > 0;
  return (
    <div className="space-y-3">
      {obs.strengths?.length > 0 && (
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-green-700 mb-1">Strengths</h4>
          <ul className="space-y-1">{obs.strengths.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-green-500 flex-shrink-0">✓</span><span><ReactMarkdown components={md}>{s}</ReactMarkdown></span></li>
          ))}</ul>
        </section>
      )}
      {obs.weaknesses?.length > 0 && (
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1">Weaknesses</h4>
          <ul className="space-y-1">{obs.weaknesses.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-red-400 flex-shrink-0">✗</span><span><ReactMarkdown components={md}>{s}</ReactMarkdown></span></li>
          ))}</ul>
        </section>
      )}
      {obs.suggestions?.length > 0 && (
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Suggestions</h4>
          <ul className="space-y-1">{obs.suggestions.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-blue-400 flex-shrink-0">→</span><span><ReactMarkdown components={md}>{s}</ReactMarkdown></span></li>
          ))}</ul>
        </section>
      )}
      {hasDetails && (
        <div>
          <button onClick={() => setShowDetails((v) => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
              {obs.score != null && <ScoreBar score={obs.score} />}
              {obs.confidence != null && <p className="text-xs text-gray-500">Confidence: <span className="font-bold">{obs.confidence}%</span></p>}
              {obs.model && <p className="text-[10px] text-gray-400">{obs.model}</p>}
              {obs.reasoning && <div className="text-sm text-gray-700 prose prose-sm max-w-none"><ReactMarkdown components={md}>{obs.reasoning}</ReactMarkdown></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GenericObservation({ obs }) {
  return <pre className="text-xs bg-gray-50 rounded border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(obs, null, 2)}</pre>;
}

function ObservationCard({ item }) {
  const [open, setOpen] = useState(true);
  const obs = item.observation;
  const resultBadge = obs.result != null ? ({ pass: 'bg-green-50 text-green-700 border-green-200', fail: 'bg-red-50 text-red-700 border-red-200', na: 'bg-amber-50 text-amber-700 border-amber-200' }[obs.result] ?? 'bg-gray-100 text-gray-600 border-gray-200') : null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-2 flex-wrap">
          {resultBadge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${resultBadge}`}>{{ pass: 'Pass', fail: 'Fail', na: 'N/A' }[obs.result]}</span>}
          <span className="text-xs font-medium text-gray-600">{item.type} <span className="text-gray-400">v{item.version}</span></span>
          {obs.score != null && <span className="text-[10px] text-gray-400">{obs.score}/10</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4 border-t border-gray-100">
          {item.type === 'interpresure_qa' ? <InterPresureQA obs={obs} />
            : item.type === 'interpresure_suggestions' ? <InterPresureSuggestions obs={obs} />
            : <GenericObservation obs={obs} />}
        </div>
      )}
    </div>
  );
}

// ── Small UI atoms ─────────────────────────────────────────────────────────────

function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-indigo-400 ${className}`} />;
}

function StaleBanner({ message }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
      <span className="font-bold">⚠</span> {message}
    </div>
  );
}

// ── Type tabs ─────────────────────────────────────────────────────────────────

/** Contextual type tabs — only renders when there are types to show. */
function TypeTabs({ types, selectedType, onSelect }) {
  if (!types || types.length === 0) return null;
  return (
    <div className="flex items-stretch border-b border-gray-200 bg-white overflow-x-auto flex-shrink-0">
      {types.map((t) => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${selectedType === t ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Run picker ────────────────────────────────────────────────────────────────

/** Inline run selector — only renders when there are 2+ runs to choose from. */
function RunPicker({ analyses, selectedAnalysisId, onSelect, className = '' }) {
  if (!analyses || analyses.length <= 1) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none">Run</span>
      <select
        value={selectedAnalysisId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 cursor-pointer"
      >
        <option value="">Latest</option>
        {analyses.map((a) => {
          const sha = a.commit_sha?.slice(0, 7) ?? '???';
          const when = new Date(a.triggered_at);
          const dateStr = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const timeStr = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          const status = a.status !== 'completed' ? ` · ${a.status}` : '';
          return (
            <option key={a.analysis_id} value={a.analysis_id}>
              {sha} — {dateStr} {timeStr}{status}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────

export default function AnalysisViewer() {

  // ── Selection state ──────────────────────────────────
  const [selectedOrg, setSelectedOrg]         = useState(null);
  const [repoId, setRepoId]                   = useState(null);
  const [selectedType, setSelectedType]       = useState(null);
  // Per-type run selection: { [type]: analysis_id | null }  (null = latest)
  const [runByType, setRunByType]             = useState({});
  const [selectedBook, setSelectedBook]       = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerse, setSelectedVerse]     = useState(null); // null = chapter-level items

  // ── Data ─────────────────────────────────────────────
  const { repos, loading: reposLoading } = useRepos(API_URL);

  // Full list (type-only filter) — used to derive commit SHA for pinned run
  const { analyses: allTypeAnalyses } = useAnalyses(API_URL, repoId, selectedType);
  // Context-filtered list — used for the run picker dropdown; scoped to current book + chapter
  const { analyses: contextAnalyses } = useAnalyses(
    API_URL, repoId, selectedType,
    selectedBook, selectedChapter,
  );

  // ── Derived org + repo lists ──────────────────────────
  const orgs = useMemo(() => {
    const seen = new Set();
    return repos
      .map((r) => orgFromGitUrl(r.git_url))
      .filter((o) => { if (seen.has(o)) return false; seen.add(o); return true; })
      .sort();
  }, [repos]);

  const repoOptions = useMemo(
    () => (selectedOrg ? repos.filter((r) => orgFromGitUrl(r.git_url) === selectedOrg) : repos),
    [repos, selectedOrg],
  );

  const selectedRepo = useMemo(() => repos.find((r) => r.repo_id === repoId) ?? null, [repos, repoId]);

  // Per-type derived values
  const selectedAnalysisId = selectedType ? (runByType[selectedType] ?? null) : null;
  const selectedAnalysis = useMemo(
    () => allTypeAnalyses.find((a) => a.analysis_id === selectedAnalysisId) ?? null,
    [allTypeAnalyses, selectedAnalysisId],
  );

  // Commit: use pinned analysis commit, else let API return latest
  const commit = selectedAnalysis?.commit_sha ?? null;

  const { summary: project, loading: projectLoading } = useProjectSummary(API_URL, repoId, commit);
  const { summary: bookSummary, loading: bookLoading } = useBookSummary(API_URL, repoId, selectedBook, commit);
  const { detail: chapterDetail, loading: chapterLoading } = useChapterDetail(API_URL, repoId, selectedBook, selectedChapter, commit);

  // USFM: need a concrete commit SHA — derive from project summary if not pinned
  const usfmCommit = commit ?? project?.most_recent_analysis?.commit_sha ?? null;
  const { usfm, loading: usfmLoading } = useUsfm(selectedRepo?.git_url ?? null, usfmCommit, selectedBook);

  // ── Staleness ─────────────────────────────────────────
  const latestCommit = project?.most_recent_analysis?.commit_sha ?? null;
  const isStale = commit && latestCommit && commit !== latestCommit;

  // ── Available types for the current navigation context ──
  // At book level: aggregate types from all chapters in the book summary.
  // At chapter level: unique types from the loaded chapter items.
  // D1 returns json_group_array as a JSON string, so parse defensively.
  const parseTypes = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
    return [];
  };

  const bookTypes = useMemo(() => {
    if (!bookSummary) return [];
    const seen = new Set();
    const result = [];
    for (const ch of bookSummary.chapters ?? []) {
      for (const t of parseTypes(ch.types)) {
        if (!seen.has(t)) { seen.add(t); result.push(t); }
      }
    }
    return result;
  }, [bookSummary]);

  const chapterTypes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const item of chapterDetail?.items ?? []) {
      if (!seen.has(item.type)) { seen.add(item.type); result.push(item.type); }
    }
    return result;
  }, [chapterDetail]);

  const availableTypes = selectedChapter != null ? chapterTypes : (selectedBook ? bookTypes : []);

  // ── Auto-select: pick first available type when context changes ──
  // Uses functional setState so selectedType isn't a dep (avoids loop).
  useEffect(() => {
    if (availableTypes.length === 0) return;
    setSelectedType((prev) => (!prev || !availableTypes.includes(prev) ? availableTypes[0] : prev));
  }, [availableTypes]);

  // ── Cascade resets ────────────────────────────────────
  useEffect(() => { setRunByType({}); setSelectedType(null); setSelectedBook(null); setSelectedChapter(null); setSelectedVerse(null); }, [repoId]);
  // Type and run changes do NOT reset navigation — tabs are contextual, runs are in-place.
  useEffect(() => { setSelectedChapter(null); setSelectedVerse(null); }, [selectedBook]);
  useEffect(() => { setSelectedVerse(null); }, [selectedChapter]);

  // ── Run selection (no nav reset) ─────────────────────
  const handleRunSelect = useCallback((analysisId) => {
    if (!selectedType) return;
    setRunByType((prev) => ({ ...prev, [selectedType]: analysisId }));
  }, [selectedType]);

  // ── Items filtered by type ────────────────────────────
  const itemsForType = useMemo(
    () => selectedType
      ? (chapterDetail?.items ?? []).filter((i) => i.type === selectedType)
      : (chapterDetail?.items ?? []),
    [chapterDetail, selectedType],
  );

  const chapterItems = useMemo(
    () => itemsForType.filter((i) => i.anchor_level === 'chapter'),
    [itemsForType],
  );

  const itemsByVerse = useMemo(() => {
    const map = new Map();
    for (const item of itemsForType) {
      if (item.anchor_level !== 'chapter') {
        const m = item.anchor.match(/:(\d+)$/);
        const v = m ? parseInt(m[1], 10) : 0;
        const arr = map.get(v) ?? [];
        arr.push(item);
        map.set(v, arr);
      }
    }
    return map;
  }, [itemsForType]);

  // ── USFM verses ──────────────────────────────────────
  const verses = useMemo(() => {
    if (!usfm || selectedChapter == null) return [];
    const chData = usfm[selectedChapter] ?? {};
    return Object.keys(chData).map(Number).sort((a, b) => a - b)
      .map((v) => ({ vNum: v, text: chData[v] ?? '' }));
  }, [usfm, selectedChapter]);

  // Detail items for the selected verse
  const detailItems = useMemo(
    () => selectedVerse == null ? chapterItems : (itemsByVerse.get(selectedVerse) ?? []),
    [chapterItems, itemsByVerse, selectedVerse],
  );

  // ── Resizable sidebar ─────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const isResizing = useRef(false);
  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);
  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);
  const onMouseMove = useCallback((e) => {
    if (!isResizing.current) return;
    const w = e.clientX;
    if (w > 200 && w < window.innerWidth - 400) setSidebarWidth(w);
  }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResizing);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', stopResizing); };
  }, [onMouseMove, stopResizing]);

  // ── Derived: sorted chapters ──────────────────────────
  const chapters = useMemo(
    () => (bookSummary?.chapters ?? []).filter((c) => c.chapter != null).slice().sort((a, b) => a.chapter - b.chapter),
    [bookSummary],
  );

  // ── Derived: books sorted ─────────────────────────────
  const books = useMemo(
    () => (project?.books ?? []).slice().sort((a, b) => a.book.localeCompare(b.book)),
    [project],
  );

  const inChapterView = selectedChapter != null;

  // ── Render ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden" onMouseUp={stopResizing}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-10 px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white"><BookOpen size={16} /></div>
          <span className="text-sm font-bold text-gray-800 hidden sm:block">Analysis Viewer</span>
        </div>

        {/* Org picker */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Org</label>
          {reposLoading ? <Spinner size={14} /> : (
            <select
              value={selectedOrg ?? ''}
              onChange={(e) => {
                setSelectedOrg(e.target.value || null);
                setRepoId(null);
              }}
              className="text-sm bg-white border border-gray-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All orgs</option>
              {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>

        {/* Repo picker */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Repo</label>
          <select
            value={repoId ?? ''}
            onChange={(e) => setRepoId(e.target.value || null)}
            className="text-sm bg-white border border-gray-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={reposLoading}
          >
            <option value="">Select repo…</option>
            {repoOptions.map((r) => <option key={r.repo_id} value={r.repo_id}>{r.name}</option>)}
          </select>
        </div>

        {/* Breadcrumb when in book/chapter view */}
        {repoId && (selectedBook || selectedChapter) && (
          <div className="flex items-center gap-1 text-sm text-gray-500 ml-2">
            <button onClick={() => { setSelectedBook(null); setSelectedChapter(null); }} className="hover:text-indigo-600 transition-colors">{selectedRepo?.name}</button>
            {selectedBook && <><ChevronRight size={14} /><button onClick={() => setSelectedChapter(null)} className={`hover:text-indigo-600 transition-colors ${!selectedChapter ? 'text-gray-800 font-medium' : ''}`}>{selectedBook}</button></>}
            {selectedChapter && <><ChevronRight size={14} /><span className="text-gray-800 font-medium">Ch. {selectedChapter}</span></>}
          </div>
        )}
      </header>

      {/* Staleness banner */}
      {isStale && (
        <StaleBanner message={`Viewing run from ${new Date(selectedAnalysis.triggered_at).toLocaleDateString()} (commit ${commit.slice(0,7)}) — a newer run exists for this repo.`} />
      )}

      {/* ── Body ── */}
      {!repoId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <BookOpen size={40} className="mx-auto mb-3 opacity-20 text-indigo-400" />
            <p className="text-sm">Select a repository to begin.</p>
          </div>
        </div>

      ) : !inChapterView ? (
        /* ── Overview: book list + chapter heat map ── */
        <div className="flex flex-1 overflow-hidden">

          {/* Book sidebar */}
          <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Books</span>
              {projectLoading && <Spinner size={12} className="ml-2 inline" />}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {books.map((b) => {
                const total = Object.values(b.item_counts).reduce((s, n) => s + n, 0);
                const active = selectedBook === b.book;
                return (
                  <button
                    key={b.book}
                    onClick={() => setSelectedBook(b.book)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <span className="font-medium">{b.book}</span>
                    {total > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{total}</span>
                    )}
                  </button>
                );
              })}
              {!projectLoading && books.length === 0 && <p className="text-xs text-gray-400 italic px-3 py-2">No analyses yet</p>}
            </div>
          </div>

          {/* Chapter heat map */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedBook ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">Select a book to see its chapters.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-bold text-gray-800">{selectedBook}</h2>
                  {bookLoading && <Spinner size={16} />}
                  <div className="ml-auto">
                    <RunPicker
                      analyses={contextAnalyses}
                      selectedAnalysisId={selectedAnalysisId}
                      onSelect={handleRunSelect}
                    />
                  </div>
                </div>
                <TypeTabs
                  types={bookTypes}
                  selectedType={selectedType}
                  onSelect={setSelectedType}
                />
                <div className="flex flex-wrap gap-2 mt-4">
                  {chapters.map((ch) => (
                    <button
                      key={ch.chapter}
                      onClick={() => setSelectedChapter(ch.chapter)}
                      className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm border border-black/5 font-medium ${chapterCellColor(ch.item_count)}`}
                      title={`${ch.item_count} items`}
                    >
                      <span className="text-base font-bold">{ch.chapter}</span>
                      <span className="text-[10px] opacity-70">{ch.item_count}</span>
                    </button>
                  ))}
                  {!bookLoading && chapters.length === 0 && <p className="text-sm text-gray-400 italic">No chapters with analysis found.</p>}
                </div>
              </>
            )}
          </div>
        </div>

      ) : (
        /* ── Chapter view: verse sidebar + analysis panel ── */
        <div className="flex flex-1 overflow-hidden">

          {/* Verse sidebar */}
          <div className="flex flex-col border-r border-gray-200 bg-white flex-shrink-0" style={{ width: sidebarWidth }}>

            {/* Back button + chapter heading */}
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setSelectedChapter(null)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                <ChevronLeft size={14} /> {selectedBook}
              </button>
              <span className="text-gray-300">·</span>
              <span className="text-xs font-bold text-gray-600">Ch. {selectedChapter}</span>
              {(usfmLoading || chapterLoading) && <Spinner size={12} className="ml-auto" />}
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* Chapter-level items row */}
              {chapterItems.length > 0 && (
                <button
                  onClick={() => setSelectedVerse(null)}
                  className={`w-full flex items-start gap-3 px-3 py-3 border-b text-left transition-colors ${selectedVerse === null ? 'bg-indigo-50 border-indigo-200' : 'border-gray-100 hover:bg-gray-50'}`}
                >
                  <span className={`flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-bold ${selectedVerse === null ? 'bg-indigo-200 text-indigo-700' : 'bg-indigo-100 text-indigo-500'}`}>CH</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-600">Chapter-level</p>
                    <p className="text-xs text-gray-400">{chapterItems.length} item{chapterItems.length !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              )}

              {/* Verse rows */}
              {verses.map(({ vNum, text }) => {
                const sev = calcSeverity(itemsByVerse.get(vNum), selectedType);
                const active = selectedVerse === vNum;
                return (
                  <button
                    key={vNum}
                    onClick={() => setSelectedVerse(vNum)}
                    className={`w-full flex items-start gap-3 px-3 py-3 border-b text-left transition-colors ${active ? 'bg-indigo-50 border-indigo-200' : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    <span className={`flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                      {vNum}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{text}</p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <SeverityDot sev={sev} />
                    </div>
                  </button>
                );
              })}

              {verses.length === 0 && !usfmLoading && (
                <p className="text-xs text-gray-400 italic px-4 py-3">USFM not available for this commit.</p>
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div className="w-1 bg-gray-200 hover:bg-indigo-400 cursor-col-resize flex items-center justify-center transition-colors z-10 flex-shrink-0" onMouseDown={startResizing}>
            <GripVertical size={12} className="text-gray-400" />
          </div>

          {/* Analysis panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

            {/* Type tabs — contextual to what exists in this chapter */}
            <TypeTabs
              types={chapterTypes}
              selectedType={selectedType}
              onSelect={setSelectedType}
            />

            {/* Run picker bar — shown when multiple runs are available */}
            {contextAnalyses.length > 1 && (
              <div className="px-5 py-2 bg-white border-b border-gray-100 flex-shrink-0 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-400">
                  {selectedBook} {selectedChapter}
                  {selectedVerse != null ? <span className="text-gray-600 font-medium">:{selectedVerse}</span> : ''}
                </span>
                <RunPicker
                  analyses={contextAnalyses}
                  selectedAnalysisId={selectedAnalysisId}
                  onSelect={handleRunSelect}
                />
              </div>
            )}

            {/* Verse heading */}
            {selectedVerse != null && (
              <div className="px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <span>{selectedBook} {selectedChapter}</span><ChevronRight size={11} /><span className="text-gray-600 font-medium">Verse {selectedVerse}</span>
                </div>
                {verses.find((v) => v.vNum === selectedVerse) && (
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    "{verses.find((v) => v.vNum === selectedVerse)?.text}"
                  </p>
                )}
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5">
              {chapterLoading ? (
                <div className="flex justify-center py-12"><Spinner size={24} /></div>
              ) : detailItems.length > 0 ? (
                <div className="space-y-3 max-w-3xl">
                  {detailItems.map((item) => <ObservationCard key={item.id} item={item} />)}
                </div>
              ) : selectedVerse != null ? (
                <p className="text-sm text-gray-400 italic">No {selectedType} items for this verse.</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Select a verse, or click "CH" to see chapter-level items.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
