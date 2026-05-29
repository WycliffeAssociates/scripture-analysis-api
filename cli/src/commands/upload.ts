import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { api, ApiError, type ClientConfig } from '../client.js';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const repoSchema = require('../../schemas/repo.schema.json');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const runSchema = require('../../schemas/run.schema.json');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const analysisItemSchema = require('../../schemas/analysis_item.schema.json');

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const validateRepo: ValidateFunction = ajv.compile(repoSchema);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const validateRun: ValidateFunction = ajv.compile(runSchema);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const validateAnalysisItem: ValidateFunction = ajv.compile(analysisItemSchema);

interface RepoFile {
  repo_id: string;
  name: string;
  git_url: string;
}

interface RunFile {
  commit_sha: string;
}

interface AnalysisItem {
  book?: string | null;
  chapter?: number | null;
  anchor?: string | null;
  anchor_level: string;
  type: string;
  version: string;
  observation: Record<string, unknown>;
}

// A key uniquely identifying a scope (book + chapter pair)
type ScopeKey = string;

function scopeKey(book: string | null | undefined, chapter: number | null | undefined): ScopeKey {
  return JSON.stringify([book ?? null, chapter ?? null]);
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${(err as Error).message}`);
  }
}

function validateOrThrow(validate: ValidateFunction, data: unknown, label: string) {
  if (!validate(data)) {
    const errors = validate.errors
      ?.map((e) => `  ${e.instancePath || '(root)'} ${e.message}`)
      .join('\n');
    throw new Error(`Validation failed for ${label}:\n${errors}`);
  }
}

export async function uploadRunDirectory(
  dirPath: string,
  config: ClientConfig,
  opts: { dryRun?: boolean; status?: string } = {},
) {
  const absDir = path.resolve(dirPath);

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    throw new Error(`Not a directory: ${absDir}`);
  }

  // ── 1. Read and validate repo.json ────────────────────────────────────────
  const repoFilePath = path.join(absDir, 'repo.json');
  if (!fs.existsSync(repoFilePath)) throw new Error(`Missing repo.json in ${absDir}`);
  const repoData = readJson<RepoFile>(repoFilePath);
  validateOrThrow(validateRepo, repoData, 'repo.json');

  // ── 2. Read and validate run.json ─────────────────────────────────────────
  const runFilePath = path.join(absDir, 'run.json');
  if (!fs.existsSync(runFilePath)) throw new Error(`Missing run.json in ${absDir}`);
  const runData = readJson<RunFile>(runFilePath);
  validateOrThrow(validateRun, runData, 'run.json');

  // ── 3. Discover item files ─────────────────────────────────────────────────
  // Any .json file in the directory that is not repo.json or run.json is
  // treated as an array of analysis items.
  const reserved = new Set(['repo.json', 'run.json']);
  const itemFiles = fs
    .readdirSync(absDir)
    .filter((f) => f.endsWith('.json') && !reserved.has(f))
    .sort();

  if (itemFiles.length === 0) {
    console.warn('Warning: no analysis item files found (expected .json files other than repo.json/run.json)');
  }

  // ── 4. Read, validate, and collect all items ──────────────────────────────
  // Group items by (book, chapter) scope key for submission.
  const scopeMap = new Map<ScopeKey, { book: string | null; chapter: number | null; items: AnalysisItem[] }>();
  let totalItems = 0;

  for (const file of itemFiles) {
    const filePath = path.join(absDir, file);
    let raw: unknown;
    try {
      raw = readJson(filePath);
    } catch (err) {
      throw new Error(`Failed to read ${file}: ${(err as Error).message}`);
    }

    if (!Array.isArray(raw)) {
      console.warn(`Skipping ${file}: not a JSON array (looks like a source/config file)`);
      continue;
    }

    for (let i = 0; i < raw.length; i++) {
      validateOrThrow(validateAnalysisItem, raw[i], `${file}[${i}]`);
      const item = raw[i] as AnalysisItem;
      const book = item.book ?? null;
      const chapter = item.chapter ?? null;
      const key = scopeKey(book, chapter);

      if (!scopeMap.has(key)) {
        scopeMap.set(key, { book, chapter, items: [] });
      }
      scopeMap.get(key)!.items.push(item);
      totalItems++;
    }
  }

  const scopeCount = scopeMap.size;
  console.log(`✓ Validated: repo.json, run.json, ${itemFiles.length} item file(s) → ${totalItems} item(s) across ${scopeCount} scope(s)`);

  if (opts.dryRun) {
    for (const [, scope] of scopeMap) {
      const label = scope.chapter !== null
        ? `${scope.book} ${scope.chapter}`
        : scope.book ?? '(repo)';
      console.log(`  scope: ${label} — ${scope.items.length} item(s)`);
    }
    console.log('Dry run — no data uploaded.');
    return;
  }

  // ── 5. Upsert repo ────────────────────────────────────────────────────────
  console.log(`→ Upserting repo '${repoData.repo_id}'…`);
  await api.upsertRepo(config, repoData);
  console.log(`  ✓ Repo ready`);

  // ── 6. Create analysis ────────────────────────────────────────────────────
  console.log(`→ Creating analysis (commit ${runData.commit_sha})…`);
  const { analysis_id } = await api.createAnalysis(config, {
    repo_id: repoData.repo_id,
    commit_sha: runData.commit_sha,
  });
  console.log(`  ✓ analysis_id: ${analysis_id}`);

  // ── 7. Upload each scope ──────────────────────────────────────────────────
  let uploadedScopes = 0;
  for (const [, scope] of scopeMap) {
    const label = scope.chapter !== null
      ? `${scope.book} ${scope.chapter}`
      : scope.book ?? '(repo)';
    process.stdout.write(`→ Uploading scope ${label} (${scope.items.length} item(s))… `);
    try {
      const result = await api.putScope(config, analysis_id, scope.book, scope.chapter, scope.items);
      console.log(`✓ ${result.items_written} written`);
      uploadedScopes++;
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`✗ HTTP ${err.status}: ${err.message}`);
      } else {
        console.error(`✗ ${(err as Error).message}`);
      }
      console.error(
        `  Aborting — analysis ${analysis_id} left in 'in_progress' state. Patch manually if needed.`
      );
      process.exit(1);
    }
  }

  // ── 8. Finalize analysis ──────────────────────────────────────────────────
  const finalStatus = opts.status ?? 'completed';
  console.log(`→ Setting analysis status to '${finalStatus}'…`);
  await api.patchAnalysis(config, analysis_id, { status: finalStatus });
  console.log(`  ✓ Done. ${uploadedScopes} scope(s) uploaded.`);
  console.log(`\nanalysis_id: ${analysis_id}`);
}
