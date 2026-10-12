#!/usr/bin/env node

/**
 * moai-update-guard runner
 *
 * Detects when moai update modifies project custom files (.gitignore and CLAUDE.md)
 * and warns the user to prevent lesson #33 recurrence.
 *
 * Verification logic:
 * 1. Capture SHA-256 hashes of .gitignore and CLAUDE.md (pre-flight)
 * 2. Execute moai update
 * 3. Recapture hashes (post-flight)
 * 4. Compare: if hashes differ, print warning with diff output
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const FILES_TO_VERIFY = ['.gitignore', 'CLAUDE.md'];
const PROJECT_ROOT = process.cwd();

/**
 * Compute SHA-256 hash of a file
 * @param {string} filePath - Absolute path to file
 * @returns {string|null} - SHA-256 hash or null if file doesn't exist
 */
function computeSha256(filePath) {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return execSync(`shasum -a 256 << 'EOF'\n${content}\nEOF`, { encoding: 'utf-8' })
      .split(' ')[0]
      .trim();
  } catch (error) {
    // Permission denied or other error
    console.error(`Error computing hash for ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * Capture hashes of all verification files
 * @returns {Object} - Map of filename -> hash (or null if not found)
 */
function captureHashes() {
  const hashes = {};
  for (const file of FILES_TO_VERIFY) {
    const filePath = resolve(PROJECT_ROOT, file);
    try {
      hashes[file] = computeSha256(filePath);
    } catch (error) {
      // Permission denied - fail verification
      console.error(`❌ Permission denied accessing ${file}. Verification impossible.`);
      process.exit(1);
    }
  }
  return hashes;
}

/**
 * Compare pre and post hashes
 * @param {Object} preHashes - Hashes before moai update
 * @param {Object} postHashes - Hashes after moai update
 * @returns {string[]} - List of files that changed
 */
function compareHashes(preHashes, postHashes) {
  const changed = [];
  for (const file of FILES_TO_VERIFY) {
    const pre = preHashes[file];
    const post = postHashes[file];

    if (pre === null && post === null) {
      // Both didn't exist - no issue
      continue;
    }
    if (pre === null && post !== null) {
      // File created - not a violation (expected for new projects)
      console.log(`ℹ️  ${file} created (normal for new projects)`);
      continue;
    }
    if (pre !== null && post === null) {
      // File deleted - potential issue
      changed.push(file);
      continue;
    }
    if (pre !== post) {
      // File modified - VIOLATION
      changed.push(file);
    }
  }
  return changed;
}

/**
 * Show git diff for changed files
 * @param {string[]} changedFiles - List of files that changed
 */
function showDiff(changedFiles) {
  for (const file of changedFiles) {
    try {
      console.log(`\n📄 Diff for ${file}:`);
      console.log('─'.repeat(60));
      const diff = execSync(`git diff --no-index /dev/null ${file} 2>/dev/null || git diff ${file}`, {
        encoding: 'utf-8',
        cwd: PROJECT_ROOT
      });
      console.log(diff || '(no diff available)');
    } catch (error) {
      console.log('(diff command failed)');
    }
  }
}

/**
 * Main verification workflow
 */
function main() {
  console.log('🔍 moai-update-guard: Starting verification...\n');

  // Step 1: Capture pre-flight hashes
  console.log('Step 1: Capturing pre-flight hashes...');
  const preHashes = captureHashes();
  for (const [file, hash] of Object.entries(preHashes)) {
    if (hash === null) {
      console.log(`  ${file}: (not found)`);
    } else {
      console.log(`  ${file}: ${hash.substring(0, 16)}...`);
    }
  }

  // Step 2: Execute moai update
  console.log('\nStep 2: Executing moai update...');
  try {
    execSync('moai update', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ moai update failed:', error.message);
    process.exit(1);
  }

  // Step 3: Capture post-flight hashes
  console.log('\nStep 2: Capturing post-flight hashes...');
  const postHashes = captureHashes();
  for (const [file, hash] of Object.entries(postHashes)) {
    if (hash === null) {
      console.log(`  ${file}: (not found)`);
    } else {
      console.log(`  ${file}: ${hash.substring(0, 16)}...`);
    }
  }

  // Step 4: Compare and report
  console.log('\nStep 3: Comparing hashes...');
  const changed = compareHashes(preHashes, postHashes);

  if (changed.length > 0) {
    console.log('\n⚠️  moai update가 프로젝트 커스텀 파일을 수정했습니다.');
    console.log(`\n변경된 파일: ${changed.join(', ')}`);
    console.log('\n복구 방법:');
    console.log('  git checkout -- .gitignore CLAUDE.md');
    console.log('\n또는 --dry-run 또는 --diff를 사용하여 사전에 확인하세요:');
    console.log('  moai update --dry-run');
    console.log('  moai update --diff');

    showDiff(changed);

    console.log('\n⚠️  이 경고는 차단하지 않습니다. 파일을 검토한 후 필요한 조치를 취하세요.\n');
    process.exit(0); // Do NOT block - just warn
  } else {
    console.log('\n✅ No project custom files were modified by moai update.\n');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { computeSha256, captureHashes, compareHashes };
