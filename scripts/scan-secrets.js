#!/usr/bin/env node
/**
 * MilestoneShield AI — Pre-Commit and CI Secret Scanner
 * Scans git history, staged diffs, and tracked/untracked workspace files for exposed secrets.
 * Ensures secret values are NEVER printed to stdout/stderr.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Regex signatures for high-entropy secrets and credential formats
const SECRET_RULES = [
  {
    name: 'Anthropic API Key',
    regex: /sk-ant-api[0-9]{2}-[a-zA-Z0-9_\-]{30,}/i,
  },
  {
    name: 'OpenAI API Key',
    regex: /sk-(?:live|proj)?[a-zA-Z0-9_\-]{32,}/i,
  },
  {
    name: 'Supabase Service Role JWT',
    // Matches live JWT with payload containing role: service_role
    regex: /eyJ[a-zA-Z0-9_\-]{20,}\.eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/,
    filter: (match, content) => {
      // Allow well-known test tokens with mock claims
      return !content.includes('mock-') && !content.includes('test-');
    },
  },
  {
    name: 'Private Key (PEM/OpenSSH)',
    regex: /-----BEGIN (?:RSA|EC|PGP|OPENSSH|DSA|ENCRYPTED|PRIVATE) KEY-----/,
  },
  {
    name: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  },
  {
    name: 'Slack API Token',
    regex: /\bxox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}\b/,
  },
  {
    name: 'PayPal Live / Production Access Token',
    regex: /access_token\$live\$[0-9a-zA-Z_\-]{20,}/i,
  },
  {
    name: 'Generic High-Entropy Secret / Password',
    regex: /(?:secret|password|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.@#$%^&*!]{16,})['"]/i,
    filter: (match) => {
      const lower = match.toLowerCase();
      // Ignore placeholders, templates, example docs, and tests
      const isPlaceholder = [
        'your-', 'example', 'placeholder', 'dummy', 'test', 'mock',
        'localhost', 'sample', 'change-me', 'secret-key-at-least',
        'https://', 'http://', 'none'
      ].some(p => lower.includes(p));
      return !isPlaceholder;
    },
  },
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.vitest',
  'package-lock.json',
  'scripts/scan-secrets.js', // scanner file itself
];

function isIgnored(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return IGNORED_PATHS.some(ign => norm.includes(`/${ign}/`) || norm.startsWith(`${ign}/`) || norm === ign);
}

function scanContent(content, locationDesc) {
  const findings = [];
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    for (const rule of SECRET_RULES) {
      const match = line.match(rule.regex);
      if (match) {
        if (!rule.filter || rule.filter(match[0], line)) {
          findings.push({
            rule: rule.name,
            location: `${locationDesc}:${lineIdx + 1}`,
          });
        }
      }
    }
  });

  return findings;
}

function runScan() {
  const mode = process.argv[2] || 'all'; // 'staged', 'history', 'working-tree', 'all'
  console.log(`[Secret Scanner] Running scan in mode: "${mode}"...`);

  let allFindings = [];

  // 1. Scan Staged Diffs if mode is 'staged' or 'all'
  if (mode === 'staged') {
    try {
      const stagedDiff = execSync('git diff --cached -U0', { cwd: ROOT_DIR, encoding: 'utf8' });
      const stagedFindings = scanContent(stagedDiff, 'STAGED_DIFF');
      allFindings.push(...stagedFindings);
    } catch (err) {
      console.warn('[Secret Scanner] Warning: Could not retrieve staged git diff.');
    }
  }

  // 2. Scan Git History if mode is 'history' or 'all'
  if (mode === 'history' || mode === 'all') {
    try {
      const historyLog = execSync('git log -p --all -n 100', { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
      const historyFindings = scanContent(historyLog, 'GIT_COMMIT_HISTORY');
      allFindings.push(...historyFindings);
    } catch (err) {
      console.warn('[Secret Scanner] Warning: Could not read git commit log.');
    }
  }

  // 3. Scan Files in Working Tree
  if (mode === 'working-tree' || mode === 'all') {
    try {
      const filesOutput = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT_DIR, encoding: 'utf8' });
      const files = filesOutput.split('\n').map(f => f.trim()).filter(Boolean);

      for (const relPath of files) {
        if (isIgnored(relPath)) continue;
        const absPath = path.join(ROOT_DIR, relPath);
        if (!fs.existsSync(absPath)) continue;
        const stat = fs.statSync(absPath);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue; // skip files > 2MB

        try {
          const content = fs.readFileSync(absPath, 'utf8');
          const fileFindings = scanContent(content, relPath);
          allFindings.push(...fileFindings);
        } catch {
          // ignore binary read errors
        }
      }
    } catch (err) {
      console.warn('[Secret Scanner] Warning: Could not enumerate workspace files.');
    }
  }

  // Report results
  if (allFindings.length === 0) {
    console.log('[Secret Scanner] SUCCESS: Zero exposed secrets found across all inspected targets.');
    process.exit(0);
  } else {
    console.error(`\n[Secret Scanner] ❌ ALERT: ${allFindings.length} potential secret(s) detected!`);
    console.error('Note: Actual secret values are REDACTED below for confidentiality.\n');
    allFindings.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.rule}] at ${f.location}`);
    });
    console.error('\nCommit aborted. Please remove all credentials before proceeding.\n');
    process.exit(1);
  }
}

runScan();
