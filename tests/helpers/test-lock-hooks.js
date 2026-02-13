import crypto from 'crypto';
import { rmSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_LOCK_DIR = path.resolve(__dirname, '..', 'test-locks');
const activeLocks = new Set();

function sanitizeFileSegment(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'unnamed-test';
}

function getLockPathForTest(test) {
  const title = test?.fullTitle?.() || test?.title || 'unknown-test';
  const testFile = test?.file || 'unknown-file';
  const idSource = `${testFile}::${title}`;
  const hash = crypto.createHash('sha1').update(idSource).digest('hex').slice(0, 12);
  const filePart = sanitizeFileSegment(path.basename(testFile, path.extname(testFile)));
  const testPart = sanitizeFileSegment(title);
  return path.join(TEST_LOCK_DIR, `${filePart}__${testPart}__${hash}.lock`);
}

async function writeLockFile(test, lockPath) {
  const payload = {
    pid: process.pid,
    hostname: process.env.HOSTNAME || null,
    startedAt: new Date().toISOString(),
    testRunId: process.env.TEST_RUN_ID || null,
    file: test?.file || null,
    title: test?.title || null,
    fullTitle: test?.fullTitle?.() || null
  };

  await fs.mkdir(TEST_LOCK_DIR, { recursive: true });
  await fs.writeFile(lockPath, JSON.stringify(payload, null, 2), 'utf8');
}

async function removeLockFile(lockPath) {
  try {
    await fs.rm(lockPath, { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

async function cleanupActiveLocks() {
  const pending = Array.from(activeLocks, lockPath => removeLockFile(lockPath));
  await Promise.all(pending);
  activeLocks.clear();
}

process.on('exit', () => {
  for (const lockPath of activeLocks) {
    try {
      // Synchronous cleanup in exit handler.
      rmSync(lockPath, { force: true });
    } catch {
      // Ignore exit cleanup errors.
    }
  }
});

process.on('SIGINT', async () => {
  await cleanupActiveLocks();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await cleanupActiveLocks();
  process.exit(143);
});

export const mochaHooks = {
  async beforeEach() {
    const currentTest = this.currentTest;
    if (!currentTest) {
      return;
    }

    try {
      const lockPath = getLockPathForTest(currentTest);
      currentTest.__lockPath = lockPath;
      activeLocks.add(lockPath);
      await writeLockFile(currentTest, lockPath);
    } catch (error) {
      console.warn(`[test-lock] failed to create lock file: ${error.message}`);
    }
  },

  async afterEach() {
    const currentTest = this.currentTest;
    const lockPath = currentTest?.__lockPath;
    if (!lockPath) {
      return;
    }

    await removeLockFile(lockPath);
    activeLocks.delete(lockPath);
  }
};
