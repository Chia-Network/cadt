/**
 * Pure helpers for OS-level diagnostics: CPU, RAM, disk.
 * No I/O beyond stdlib calls; safe to use from any context.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';

import { getChiaRoot } from './chia-root.js';
import { logger } from '../config/logger.js';

const getCpuInfo = () => {
  try {
    const cpus = os.cpus() || [];
    const model = cpus[0]?.model?.trim() || null;
    return {
      model,
      cores: cpus.length,
    };
  } catch (error) {
    logger.debug(`[diagnostics]: failed to read CPU info: ${error.message}`);
    return { model: null, cores: null, error: error.message };
  }
};

const getMemoryInfo = () => {
  try {
    return {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
    };
  } catch (error) {
    logger.debug(`[diagnostics]: failed to read memory info: ${error.message}`);
    return { totalBytes: null, freeBytes: null, error: error.message };
  }
};

/**
 * Free/total disk bytes for the partition containing `targetPath`.
 * Walks up the path until it finds an existing ancestor (so callers can pass
 * a not-yet-created CADT directory and still get useful numbers for the
 * mountpoint above it). Uses Node's native `fs.statfs` (Node >=18.15).
 */
const getDiskInfo = async (targetPath) => {
  try {
    let resolvedPath = path.resolve(targetPath);
    while (resolvedPath && !fs.existsSync(resolvedPath)) {
      const parent = path.dirname(resolvedPath);
      if (parent === resolvedPath) break;
      resolvedPath = parent;
    }

    if (typeof fs.promises.statfs !== 'function') {
      return {
        path: resolvedPath,
        totalBytes: null,
        freeBytes: null,
        error: 'fs.promises.statfs is not available in this Node runtime',
      };
    }

    const stats = await fs.promises.statfs(resolvedPath);
    return {
      path: resolvedPath,
      totalBytes: stats.blocks * stats.bsize,
      freeBytes: stats.bavail * stats.bsize,
    };
  } catch (error) {
    logger.debug(`[diagnostics]: failed to stat disk for ${targetPath}: ${error.message}`);
    return {
      path: targetPath,
      totalBytes: null,
      freeBytes: null,
      error: error.message,
    };
  }
};

/**
 * Build the `system` section of the /diagnostics response.
 * Disk is reported for the partition that holds CADT's data (the chia root).
 */
export const getSystemInfo = async () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: await getDiskInfo(getChiaRoot()),
  };
};

export const __test = { getCpuInfo, getMemoryInfo, getDiskInfo };
