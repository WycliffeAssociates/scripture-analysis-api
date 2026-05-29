import { useState, useEffect, useMemo } from 'react';
import { NavSelect } from './NavSelect';
import { useRepos, orgFromGitUrl } from '../../hooks/useRepos';
import { useAnalysisTypes } from '../../hooks/useAnalysisTypes';
import { useAnalyses, analysisLabel, commitsFromAnalyses } from '../../hooks/useAnalyses';
import { useCommitDates } from '../../hooks/useCommitDates';
import type { AnalysisBarSelection } from '../../types';

export interface AnalysisBarProps {
  /** Base URL of the Scripture Analysis API, e.g. "http://localhost:8787" */
  apiUrl: string;
  /** Called whenever any picker changes */
  onSelectionChange?: (selection: AnalysisBarSelection) => void;
  /** Seed the bar with an initial selection */
  defaultSelection?: Partial<AnalysisBarSelection>;
  className?: string;
}

export function AnalysisBar({
  apiUrl,
  onSelectionChange,
  defaultSelection = {},
  className = '',
}: AnalysisBarProps) {
  const { repos, loading: reposLoading } = useRepos(apiUrl);
  const { analysisTypes, loading: typesLoading } = useAnalysisTypes(apiUrl);

  const [selectedOrg, setSelectedOrg] = useState<string>(defaultSelection.org ?? '');
  const [selectedRepoId, setSelectedRepoId] = useState<string>(defaultSelection.repoId ?? '');
  const [selectedCommit, setSelectedCommit] = useState<string>(defaultSelection.commitSha ?? '');
  const [selectedType, setSelectedType] = useState<string>(defaultSelection.analysisType ?? '');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(
    defaultSelection.analysisId ?? '',
  );

  const { analyses, loading: analysesLoading } = useAnalyses(apiUrl, selectedRepoId || null);

  // Find the git_url for the currently selected repo
  const selectedRepoGitUrl = useMemo(
    () => repos.find((r) => r.repo_id === selectedRepoId)?.git_url ?? null,
    [repos, selectedRepoId],
  );

  // Distinct commit SHAs for the selected repo
  const commitShas = useMemo(
    () => [...new Set(analyses.map((a) => a.commit_sha))],
    [analyses],
  );

  const commitDates = useCommitDates(selectedRepoGitUrl, commitShas);

  // ── Derived options ────────────────────────────────────────────────────────

  const orgs = useMemo(() => {
    const seen = new Set<string>();
    return repos
      .map((r) => orgFromGitUrl(r.git_url))
      .filter((org) => {
        if (seen.has(org)) return false;
        seen.add(org);
        return true;
      })
      .sort()
      .map((org) => ({ value: org, label: org }));
  }, [repos]);

  const repoOptions = useMemo(() => {
    const filtered = selectedOrg
      ? repos.filter((r) => orgFromGitUrl(r.git_url) === selectedOrg)
      : repos;
    return filtered.map((r) => ({ value: r.repo_id, label: r.name }));
  }, [repos, selectedOrg]);

  const commitOptions = useMemo(
    () => commitsFromAnalyses(analyses, commitDates),
    [analyses, commitDates],
  );

  const typeOptions = useMemo(
    () => analysisTypes.map((t) => ({ value: t.type, label: t.type })),
    [analysisTypes],
  );

  const analysisOptions = useMemo(() => {
    const filtered = selectedCommit
      ? analyses.filter((a) => a.commit_sha === selectedCommit)
      : analyses;
    return filtered.map((a) => ({ value: a.analysis_id, label: analysisLabel(a) }));
  }, [analyses, selectedCommit]);

  // ── Cascade resets ─────────────────────────────────────────────────────────

  function handleOrgChange(org: string) {
    setSelectedOrg(org);
    setSelectedRepoId('');
    setSelectedCommit('');
    setSelectedType('');
    setSelectedAnalysisId('');
  }

  function handleRepoChange(repoId: string) {
    setSelectedRepoId(repoId);
    setSelectedCommit('');
    setSelectedType('');
    setSelectedAnalysisId('');
  }

  function handleCommitChange(commit: string) {
    setSelectedCommit(commit);
    setSelectedType('');
    setSelectedAnalysisId('');
  }

  function handleTypeChange(type: string) {
    setSelectedType(type);
    setSelectedAnalysisId('');
  }

  function handleAnalysisChange(analysisId: string) {
    setSelectedAnalysisId(analysisId);
  }

  // ── Notify parent ──────────────────────────────────────────────────────────

  useEffect(() => {
    onSelectionChange?.({
      org: selectedOrg || null,
      repoId: selectedRepoId || null,
      commitSha: selectedCommit || null,
      analysisType: selectedType || null,
      analysisId: selectedAnalysisId || null,
    });
  }, [selectedOrg, selectedRepoId, selectedCommit, selectedType, selectedAnalysisId, onSelectionChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={[
        'flex items-end gap-3 px-4 py-3',
        'bg-white border-b border-gray-200 shadow-sm',
        className,
      ].join(' ')}
    >
      <NavSelect
        label="Organization"
        value={selectedOrg}
        onChange={handleOrgChange}
        options={orgs}
        loading={reposLoading}
        placeholder="All orgs"
      />

      <Chevron />

      <NavSelect
        label="Repository"
        value={selectedRepoId}
        onChange={handleRepoChange}
        options={repoOptions}
        loading={reposLoading}
        placeholder="Select repo…"
      />

      <Chevron />

      <NavSelect
        label="Commit"
        value={selectedCommit}
        onChange={handleCommitChange}
        options={commitOptions}
        loading={analysesLoading}
        disabled={!selectedRepoId}
        placeholder="Select commit…"
      />

      <Chevron />

      <NavSelect
        label="Analysis Type"
        value={selectedType}
        onChange={handleTypeChange}
        options={typeOptions}
        loading={typesLoading}
        disabled={!selectedRepoId}
        placeholder="Select type…"
      />

      <Chevron />

      <NavSelect
        label="Run"
        value={selectedAnalysisId}
        onChange={handleAnalysisChange}
        options={analysisOptions}
        loading={analysesLoading}
        disabled={!selectedRepoId}
        placeholder="Select run…"
      />
    </div>
  );
}

function Chevron() {
  return (
    <span className="pb-1.5 text-gray-300 text-lg select-none" aria-hidden>›</span>
  );
}
