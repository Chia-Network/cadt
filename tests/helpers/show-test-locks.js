#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCK_DIR = path.resolve(__dirname, '..', 'test-locks');

function formatAge(startedAt) {
  if (!startedAt) {
    return 'unknown age';
  }

  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) {
    return 'unknown age';
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function getLockFiles() {
  try {
    const entries = await fs.readdir(LOCK_DIR);
    return entries
      .filter(name => name.endsWith('.lock'))
      .sort()
      .map(name => path.join(LOCK_DIR, name));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readLock(lockPath) {
  const filename = path.basename(lockPath);
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      filename,
      pid: parsed.pid ?? 'unknown',
      test: parsed.fullTitle || parsed.title || 'unknown test',
      file: parsed.file || 'unknown file',
      age: formatAge(parsed.startedAt),
    };
  } catch {
    return {
      filename,
      pid: 'unknown',
      test: 'unreadable lock file',
      file: 'unknown file',
      age: 'unknown age',
    };
  }
}

async function main() {
  const lockFiles = await getLockFiles();
  if (lockFiles.length === 0) {
    console.log('No active test locks found.');
    return;
  }

  console.log(`Active test locks: ${lockFiles.length}`);
  for (const lockPath of lockFiles) {
    const lock = await readLock(lockPath);
    console.log(`- ${lock.test}`);
    console.log(`  file: ${lock.file}`);
    console.log(`  pid: ${lock.pid} | running: ${lock.age}`);
    console.log(`  lock: ${lock.filename}`);
  }
}

main().catch(error => {
  console.error(`Failed to read test locks: ${error.message}`);
  process.exit(1);
});
