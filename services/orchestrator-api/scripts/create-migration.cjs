const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm migrate:create <name>');
  process.exit(1);
}

// Run node-pg-migrate create
const cmd = 'node-pg-migrate';
const pgArgs = ['create', '-m', 'migrations', '-j', 'js', ...args];
const result = spawnSync(cmd, pgArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status);

// Rename newest .js migration to .cjs
const { renameLatest } = require('./rename-latest-migration.cjs');
renameLatest();
console.log('[migrate] done');