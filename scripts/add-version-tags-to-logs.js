#!/usr/bin/env node

/**
 * Script to add [v1] and [v2] prefixes to logger calls
 *
 * Usage: node scripts/add-version-tags-to-logs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Patterns to match logger calls
const loggerPattern = /logger\.(info|debug|error|warn|verbose|silly)\(/g;

// V2 file patterns
const v2Patterns = [
  /src\/models\/v2\//,
  /src\/controllers\/v2\//,
  /src\/tasks\/.*-v2\.js$/,
  /src\/database\/v2\//,
  /src\/utils\/v2-.*\.js$/,
  /src\/routes\/v2\//,
  /src\/validations\/v2\//,
];

// V1 file patterns (exclude v2 directories)
const v1Patterns = [
  /src\/models\/(?!v2)/,
  /src\/controllers\/(?!v2)/,
  /src\/tasks\/(?!.*-v2\.js$)/,
  /src\/database\/(?!v2)/,
  /src\/utils\/(?!v2-)/,
  /src\/routes\/(?!v2)/,
];

function isV2File(filePath) {
  return v2Patterns.some(pattern => pattern.test(filePath));
}

function isV1File(filePath) {
  const relativePath = path.relative(projectRoot, filePath);
  // Exclude v2 directories
  if (relativePath.includes('/v2/') || relativePath.includes('-v2.')) {
    return false;
  }
  return v1Patterns.some(pattern => pattern.test(relativePath));
}

function addVersionTag(content, version) {
  const tag = `[${version}]: `;

  // Replace logger calls that don't already have a version tag
  return content.replace(
    /logger\.(info|debug|error|warn|verbose|silly)\((`[^`]*`)/g,
    (match, level, message) => {
      // Skip if already has version tag
      if (message.includes('[v1]:') || message.includes('[v2]:')) {
        return match;
      }
      // Add version tag
      return `logger.${level}(${message.slice(0, 1)}${tag}${message.slice(1)}`;
    }
  );
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  if (isV2File(filePath)) {
    newContent = addVersionTag(content, 'v2');
    modified = newContent !== content;
  } else if (isV1File(filePath)) {
    newContent = addVersionTag(content, 'v1');
    modified = newContent !== content;
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${path.relative(projectRoot, filePath)}`);
    return true;
  }

  return false;
}

function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
        findJsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') && !file.endsWith('.spec.js')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main execution
const srcDir = path.join(projectRoot, 'src');
const files = findJsFiles(srcDir);

let updatedCount = 0;
files.forEach(file => {
  if (processFile(file)) {
    updatedCount++;
  }
});

console.log(`\nUpdated ${updatedCount} files.`);

