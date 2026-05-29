#!/usr/bin/env node
import { Command } from 'commander';
import { uploadRunDirectory } from './commands/upload.js';
import { createAnalysis, patchAnalysis } from './commands/analysis.js';
import type { ClientConfig } from './client.js';

function getConfig(opts: { url?: string; key?: string }): ClientConfig {
  const baseUrl = opts.url ?? process.env['SCRIPTURE_API_URL'];
  const apiKey = opts.key ?? process.env['SCRIPTURE_API_KEY'];

  if (!baseUrl) {
    console.error('Error: API URL required. Set SCRIPTURE_API_URL or pass --url');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Error: API key required. Set SCRIPTURE_API_KEY or pass --key');
    process.exit(1);
  }
  return { baseUrl, apiKey };
}

const program = new Command();

program
  .name('scripture')
  .description('Upload scripture analysis reports to the Scripture Analysis API')
  .version('0.1.0')
  .option('--url <url>', 'API base URL (overrides SCRIPTURE_API_URL)')
  .option('--key <key>', 'API key (overrides SCRIPTURE_API_KEY)');

// ── upload ────────────────────────────────────────────────────────────────
program
  .command('upload <dir>')
  .description(
    'Upload a run directory to the API.\n\n' +
    'The directory must contain:\n' +
    '  repo.json       — repo metadata (created if absent)\n' +
    '  run.json        — analysis metadata (commit SHA, optional final status)\n' +
    '  scopes/         — one .json file per scope (book or chapter)\n\n' +
    'Environment variables:\n' +
    '  SCRIPTURE_API_URL   Base URL of the API\n' +
    '  SCRIPTURE_API_KEY   Bearer token'
  )
  .option('--dry-run', 'Validate files without uploading anything')
  .option('--status <status>', 'Final status to set on the analysis after upload (default: completed)', 'completed')
  .action(async (dir: string, cmdOpts: { dryRun?: boolean; status?: string }, cmd: Command) => {
    const parentOpts = cmd.parent?.opts<{ url?: string; key?: string }>() ?? {};
    // Skip credential validation for dry runs — no network calls will be made
    const config = cmdOpts.dryRun
      ? { baseUrl: 'http://localhost', apiKey: 'dry-run' }
      : getConfig(parentOpts);
    try {
      await uploadRunDirectory(dir, config, { dryRun: cmdOpts.dryRun, status: cmdOpts.status });
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── analysis ──────────────────────────────────────────────────────────────
const analysisCmd = program.command('analysis').description('Manage analyses');

analysisCmd
  .command('create <repo_id> <commit_sha>')
  .description('Create a new analysis and print its analysis_id')
  .action(async (repoId: string, commitSha: string, _opts: unknown, cmd: Command) => {
    const parentOpts = cmd.parent?.parent?.opts<{ url?: string; key?: string }>() ?? {};
    try {
      await createAnalysis(repoId, commitSha, getConfig(parentOpts));
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

analysisCmd
  .command('patch <analysis_id> <status>')
  .description('Update the status of an existing analysis')
  .action(async (analysisId: string, status: string, _opts: unknown, cmd: Command) => {
    const parentOpts = cmd.parent?.parent?.opts<{ url?: string; key?: string }>() ?? {};
    try {
      await patchAnalysis(analysisId, status, getConfig(parentOpts));
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
