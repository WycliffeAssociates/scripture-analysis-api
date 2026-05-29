import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  GripVertical,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { AnalysisBar } from '@scripture-analysis/components';
import { useProjectSummary } from '@scripture-analysis/components';
import { useBookSummary } from '@scripture-analysis/components';
import { useChapterDetail } from '@scripture-analysis/components';
import { useUsfm } from '@scripture-analysis/components';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

// ── Markdown renderer ─────────────────────────────────────────────────────────

const md = {
  ul:         ({...p}) => <ul         className="list-disc pl-5 mb-2 space-y-1" {...p} />,
  ol:         ({...p}) => <ol         className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
  li:         ({...p}) => <li         className="pl-1" {...p} />,
  h1:         ({...p}) => <h1         className="text-lg font-bold text-gray-900 mt-4 mb-2" {...p} />,
  h2:         ({...p}) => <h2         className="text-base font-bold text-gray-900 mt-3 mb-2" {...p} />,
  h3:         ({...p}) => <h3         className="text-sm font-bold text-gray-900 mt-2 mb-1" {...p} />,
  p:          ({...p}) => <p          className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  strong:     ({...p}) => <strong     className="font-bold text-gray-900" {...p} />,
  em:         ({...p}) => <em         className="italic text-gray-800" {...p} />,
  blockquote: ({...p}) => <blockquote className="border-l-4 border-gray-200 pl-4 italic text-gray-600 my-2" {...p} />,
  code:       ({...p}) => <code       className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-gray-800" {...p} />,
};

// ── Observation renderers ─────────────────────────────────────────────────────

function InterPresureSuggestions({ obs }) {
  return (
    <div className="space-y-4">
      {obs.strengths?.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">Strengths</h4>
          <ul className="space-y-1">
            {obs.strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <ReactMarkdown components={md}>{s}</ReactMarkdown>
              </li>
            ))}
          </ul>
        </section>
      )}
      {obs.weaknesses?.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-1">Weaknesses</h4>
          <ul className="space-y-1">
            {obs.weaknesses.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                <ReactMarkdown components={md}>{s}</ReactMarkdown>
              </li>
            ))}
          </ul>
        </section>
      )}
      {obs.suggestions?.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">Suggestions</h4>
          <ul className="space-y-1">
            {obs.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                <ReactMarkdown components={md}>{s}</ReactMarkdown>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function GenericObservation({ obs }) {
  return (
    <pre className="text-xs bg-gray-50 rounded border border-gray-200 p-3 overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(obs, null, 2)}
    </pre>
  );
}

function ObservationCard({ item }) {
  const [open, setOpen] = useState(true);
  const obs = item.observation;
  const isChapter = item.anchor_level === 'chapter';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isChapter ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {isChapter ? 'chapter' : item.anchor}
          </span>
          <span className="text-sm font-medium text-gray-700">{item.type}</span>
          <span className="text-xs text-gray-400">v{item.version}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="p-4 border-t border-gray-100">
          {item.type === 'interpresure_suggestions'
            ? <InterPresureSuggestions obs={obs} />
            : <GenericObservation obs={obs} />}
        </div>
      )}
    </div>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-indigo-500 ${className}`} />;
}

function EmptyPane({ icon: Icon = Layers, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
      <div className="bg-white p-6 rounded-full shadow-sm mb-4">
        <Icon size={40} className="opacity-20 text-indigo-500" />
      </div>
      <h3 className="text-base font-medium text-gray-600">{title}</h3>
      {body && <p className="text-sm mt-2 max-w-xs leading-relaxed">{body}</p>}
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────

export default function AnalysisViewer() {
  // AnalysisBar selection
  const [sel, setSel] = useState({
    org: null, repoId: null, commitSha: null, analysisType: null, analysisId: null,
  });

  // Navigator state
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerse, setSelectedVerse] = useState(null);

  // Reset downstream when repo/commit changes
  useEffect(() => {
    setSelectedBook(null);
    setSelectedChapter(null);
    setSelectedVerse(null);
  }, [sel.repoId, sel.commitSha]);

  useEffect(() => {
    setSelectedChapter(null);
    setSelectedVerse(null);
  }, [selectedBook]);

  useEffect(() => {
    setSelectedVerse(null);
  }, [selectedChapter]);

  // Data hooks
  const { summary: projectSummary, loading: projectLoading } = useProjectSummary(
    API_URL, sel.repoId, sel.commitSha,
  );

  const { summary: bookSummary, loading: bookLoading } = useBookSummary(
    API_URL, sel.repoId, selectedBook, sel.commitSha,
  );

  const { detail: chapterDetail, loading: chapterLoading } = useChapterDetail(
    API_URL, sel.repoId, selectedBook, selectedChapter, sel.commitSha,
  );

  // Git URL for USFM
  const gitUrl = projectSummary?.git_url ?? null;

  const { usfm, loading: usfmLoading } = useUsfm(gitUrl, sel.commitSha, selectedBook);

  // Derived: sorted books and chapters
  const books = useMemo(
    () => (projectSummary?.books ?? []).slice().sort((a, b) => a.book.localeCompare(b.book)),
    [projectSummary],
  );

  const chapters = useMemo(
    () =>
      (bookSummary?.chapters ?? [])
        .filter((c) => c.chapter != null)
        .slice()
        .sort((a, b) => (a.chapter ?? 0) - (b.chapter ?? 0)),
    [bookSummary],
  );

  // USFM verses for selected chapter
  const verses = useMemo(() => {
    if (!usfm || selectedChapter == null) return [];
    const chData = usfm[selectedChapter] ?? {};
    return Object.keys(chData)
      .map(Number)
      .sort((a, b) => a - b)
      .map((v) => ({ vNum: v, text: chData[v] ?? '' }));
  }, [usfm, selectedChapter]);

  // Analysis items grouped by verse number (anchor "BOOK C:V" or chapter-level)
  const itemsByVerse = useMemo(() => {
    const map = new Map(); // verse number (or 0 for chapter-level) → items[]
    for (const item of chapterDetail?.items ?? []) {
      if (item.anchor_level === 'chapter') {
        const arr = map.get(0) ?? [];
        arr.push(item);
        map.set(0, arr);
      } else {
        // anchor like "PSA 145:3" — extract verse number
        const m = item.anchor.match(/:(\d+)$/);
        const v = m ? parseInt(m[1], 10) : 0;
        const arr = map.get(v) ?? [];
        arr.push(item);
        map.set(v, arr);
      }
    }
    return map;
  }, [chapterDetail]);

  // Items shown in detail panel
  const detailItems = useMemo(() => {
    if (selectedVerse == null) {
      // Show chapter-level items when no verse selected
      return itemsByVerse.get(0) ?? [];
    }
    return [
      ...(itemsByVerse.get(0) ?? []),       // chapter-level always visible
      ...(itemsByVerse.get(selectedVerse) ?? []),
    ];
  }, [itemsByVerse, selectedVerse]);

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(260);
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
    if (w > 180 && w < window.innerWidth - 400) setSidebarWidth(w);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [onMouseMove, stopResizing]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasSelection = sel.repoId != null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
            <BookOpen size={18} />
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Scripture Analysis Viewer</h1>
        </div>
        <AnalysisBar apiUrl={API_URL} onSelectionChange={setSel} />
      </header>

      {!hasSelection ? (
        <EmptyPane
          icon={BookOpen}
          title="Select a repository"
          body="Use the bar above to choose an organisation, repository, and commit."
        />
      ) : (
        <div className="flex flex-1 overflow-hidden" onMouseUp={stopResizing}>

          {/* ── Left sidebar: book + chapter nav ── */}
          <div
            className="flex flex-col min-w-[180px] border-r border-gray-200 bg-white flex-shrink-0"
            style={{ width: sidebarWidth }}
          >
            {/* Book selector */}
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Book</label>
              {projectLoading ? (
                <div className="flex items-center gap-2 py-1">
                  <Spinner size={14} />
                  <span className="text-xs text-gray-400">Loading…</span>
                </div>
              ) : books.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-1">No analyses yet</p>
              ) : (
                <select
                  value={selectedBook ?? ''}
                  onChange={(e) => setSelectedBook(e.target.value || null)}
                  className="w-full text-sm bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select book…</option>
                  {books.map((b) => (
                    <option key={b.book} value={b.book}>{b.book}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Chapter list */}
            {selectedBook && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Chapters</span>
                  {bookLoading && <Spinner size={12} className="ml-2 inline" />}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {chapters.map((ch) => {
                    const active = selectedChapter === ch.chapter;
                    return (
                      <button
                        key={ch.chapter}
                        onClick={() => setSelectedChapter(ch.chapter)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        <span className="font-medium">Chapter {ch.chapter}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {ch.item_count}
                        </span>
                      </button>
                    );
                  })}
                  {!bookLoading && chapters.length === 0 && (
                    <p className="text-xs text-gray-400 italic px-3 py-2">No chapters found</p>
                  )}
                </div>
              </div>
            )}

            {!selectedBook && !projectLoading && books.length > 0 && (
              <EmptyPane title="Select a book" body={null} />
            )}
          </div>

          {/* Resize handle */}
          <div
            className="w-1 bg-gray-200 hover:bg-indigo-400 cursor-col-resize flex items-center justify-center transition-colors z-20 flex-shrink-0"
            onMouseDown={startResizing}
          >
            <GripVertical size={12} className="text-gray-400" />
          </div>

          {/* ── Main content area ── */}
          {!selectedChapter ? (
            <div className="flex-1">
              <EmptyPane
                icon={Layers}
                title={selectedBook ? 'Select a chapter' : 'Select a book and chapter'}
                body="Only books and chapters that have analyses are shown."
              />
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">

              {/* Verse list */}
              <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-600">{selectedBook} {selectedChapter}</span>
                    {(usfmLoading || chapterLoading) && <Spinner size={14} />}
                  </div>
                  <span className="text-xs text-gray-400">{verses.length} verses</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {/* Chapter-level items indicator */}
                  {(itemsByVerse.get(0) ?? []).length > 0 && (
                    <button
                      onClick={() => setSelectedVerse(null)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left ${selectedVerse === null ? 'bg-indigo-50 border-indigo-300' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                    >
                      <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold ${selectedVerse === null ? 'bg-indigo-200 text-indigo-700' : 'bg-indigo-100 text-indigo-500'}`}>
                        ch
                      </span>
                      <span className="text-xs text-gray-600 italic">Chapter-level items</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                        {(itemsByVerse.get(0) ?? []).length}
                      </span>
                    </button>
                  )}

                  {verses.length === 0 && !usfmLoading && (
                    <p className="text-xs text-gray-400 italic px-2 py-2">
                      USFM not available for this commit.
                    </p>
                  )}

                  {verses.map(({ vNum, text }) => {
                    const items = itemsByVerse.get(vNum) ?? [];
                    const active = selectedVerse === vNum;
                    return (
                      <button
                        key={vNum}
                        onClick={() => setSelectedVerse(vNum)}
                        className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${active ? 'bg-indigo-50 border-indigo-300' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                      >
                        <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold mt-0.5 ${active ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                          {vNum}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 leading-snug line-clamp-3">{text}</p>
                        </div>
                        {items.length > 0 && (
                          <span className="flex-shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                            {items.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detail panel */}
              <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
                {selectedVerse != null || (itemsByVerse.get(0) ?? []).length > 0 ? (
                  <>
                    {/* Header */}
                    <div className="px-6 py-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span className="font-medium text-gray-700">{selectedBook}</span>
                        <ChevronRight size={12} />
                        <span>Chapter {selectedChapter}</span>
                        {selectedVerse != null && (
                          <>
                            <ChevronRight size={12} />
                            <span>Verse {selectedVerse}</span>
                          </>
                        )}
                      </div>
                      {selectedVerse != null && verses.find(v => v.vNum === selectedVerse) && (
                        <p className="text-base text-gray-800 leading-relaxed mt-1 italic">
                          "{verses.find(v => v.vNum === selectedVerse)?.text}"
                        </p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-6">
                      {chapterLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Spinner size={24} />
                        </div>
                      ) : detailItems.length === 0 ? (
                        <EmptyPane
                          title="No analysis items"
                          body="No analysis items found for this selection."
                        />
                      ) : (
                        <div className="space-y-4 max-w-3xl">
                          {detailItems.map((item) => (
                            <ObservationCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyPane
                    title="Select a verse"
                    body="Click a verse to see its analysis items."
                  />
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
