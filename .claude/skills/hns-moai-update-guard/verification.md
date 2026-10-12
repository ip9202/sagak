---
name: hns-moai-update-guard
description: Verify that moai update did not modify project custom files (.gitignore and CLAUDE.md) to prevent lesson #33 recurrence. Triggered after moai update completes.
allowed-tools: Bash, Read, Write, Edit
triggers:
  - moai update
  - template sync
  - .gitignore modification
  - CLAUDE.md modification
  - lesson #33
---

# moai-update-guard Verification Skill

## Purpose

Detect when `moai update` modifies project custom files (.gitignore and CLAUDE.md) and warn the user to prevent lesson #33 recurrence.

## When to Use

Invoke this skill automatically after `moai update` completes, or manually when:
- Verifying that template sync preserved local customizations
- Investigating unexpected changes to .gitignore or CLAUDE.md
- Reviewing moai update changes before committing

## Quick Start

```bash
# Automatic verification after moai update
/harness:moai-update-guard

# Manual verification
sha256sum .gitignore CLAUDE.md > before.txt
moai update "$@"
sha256sum .gitignore CLAUDE.md > after.txt
diff before.txt after.txt
```

## Verification Logic

### Step 1: Pre-flight Hash Capture

Capture SHA-256 hashes before moai update:

```bash
# Compute pre-update hashes
for file in .gitignore CLAUDE.md; do
  if [ -f "$file" ]; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    echo "(not found)"
  fi
done
```

Store these hashes for comparison.

### Step 2: Execute moai Update

Run moai update normally:

```bash
moai update "$@"
```

### Step 3: Post-flight Hash Comparison

Compare hashes after update:

```bash
for file in .gitignore CLAUDE.md; do
  if [ -f "$file" ]; then
    POST_HASH=$(shasum -a 256 "$file" | awk '{print $1}')
    if [ "$POST_HASH" != "$PRE_HASH" ]; then
      echo "⚠️  $file was modified"
    fi
  fi
done
```

### Step 4: Report and Suggest Recovery

If hashes differ, print warning:

```
⚠️ moai update가 프로젝트 커스텀 파일을 수정했습니다.

변경된 파일: .gitignore, CLAUDE.md
복구 방법: git checkout -- .gitignore CLAUDE.md

또는 --dry-run 또는 --diff를 사용하여 사전에 확인하세요:
  moai update --dry-run
  moai update --diff
```

Show git diff for review:

```bash
git diff .gitignore CLAUDE.md
```

## Edge Cases

### File Not Found

**Situation**: File doesn't exist before moai update
**Action**: Skip verification for that file
**Rationale**: Normal for new projects or clean checkouts

```bash
if [ ! -f "$file" ]; then
  echo "ℹ️  $file not found (normal for new projects)"
  continue
fi
```

### File Deleted

**Situation**: File exists before update but not after
**Action**: Warn and suggest recovery
**Rationale**: Unexpected deletion needs investigation

```bash
if [ -f "$file" ] && [ ! -f "$file.after" ]; then
  echo "⚠️  $file was deleted unexpectedly"
  git checkout HEAD -- "$file"
fi
```

### Permission Denied

**Situation**: Cannot read file for hash computation
**Action**: Error and exit (verification impossible)
**Rationale**: Cannot verify without read access

```bash
if [ ! -r "$file" ]; then
  echo "❌ Permission denied accessing $file"
  echo "Verification impossible. Exiting."
  exit 1
fi
```

### Working Tree Dirty

**Situation**: Git working tree has uncommitted changes
**Action**: Verify anyway (hash-based comparison)
**Rationale**: Hash comparison works independently of git state

```bash
# Hash-based verification works even with dirty working tree
# No need for git diff clean state
```

## Prevention Best Practices

### Before Running moai update

1. **Use dry-run mode** to preview changes:
   ```bash
   moai update --dry-run
   ```

2. **Use diff mode** to see template vs local:
   ```bash
   moai update --diff
   ```

3. **Stash custom changes** if you want to preserve them:
   ```bash
   cp .gitignore .gitignore.local
   cp CLAUDE.md CLAUDE.md.local
   moai update
   # Review and merge customizations back
   ```

### After Running moai update

1. **Run this verification automatically**:
   ```bash
   /harness:moai-update-guard
   ```

2. **Review changes** if warning is shown:
   ```bash
   git diff .gitignore CLAUDE.md
   ```

3. **Recover if needed**:
   ```bash
   git checkout -- .gitignore CLAUDE.md
   ```

4. **Commit verification result** to maintain history:
   ```bash
   git add .moai/harnesses/moai-update-guard/verification.log
   git commit -m "harness: moai-update-guard verification log"
   ```

## Implementation Notes

### Hash Computation

Use SHA-256 for deterministic comparison:

```bash
# POSIX-compliant hash computation
shasum -a 256 "$file" | awk '{print $1}'
```

On systems without `shasum`, use:

```bash
# Alternative: sha256sum (Linux)
sha256sum "$file" | awk '{print $1}'

# Alternative: openssl (macOS)
openssl dgst -sha256 "$file" | awk '{print $2}'
```

### Non-Blocking Design

This harness **does not block** moai update:
- Exit code 0 (success) even when modifications detected
- Warning message only, no failure
- User decides whether to accept or reject changes

Rationale: Template sync should not fail the workflow; blocking would be too disruptive for a simple check.

### Recovery Options

**Option 1: Git checkout** (preferred)
```bash
git checkout -- .gitignore CLAUDE.md
```

**Option 2: Manual merge**
```bash
# Review changes
git diff .gitignore CLAUDE.md

# Apply desired customizations manually
```

**Option 3: Re-run with --dry-run**
```bash
# See what will change
moai update --dry-run

# Then decide whether to proceed
```

## Verification Log

For audit trail, log verification results:

```bash
# Log location
MOAI_LOG_DIR=".moai/harnesses/moai-update-guard/logs"
mkdir -p "$MOAI_LOG_DIR"

# Log entry format
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat >> "$MOAI_LOG_DIR/verification.log" <<EOF
timestamp: $TIMESTAMP
pre_hashes: .gitignore=$PRE_GITIGNORE, CLAUDE.md=$PRE_CLAUDE
post_hashes: .gitignore=$POST_GITIGNORE, CLAUDE.md=$POST_CLAUDE
changed: $CHANGED_FILES
status: $STATUS
EOF
```

## Integration with moai CLI

This harness integrates with the moai CLI via:

1. **Command hook**: PostToolUse hook on `moai update`
2. **Manual invocation**: `/harness:moai-update-guard`
3. **Wrapper script**: Wrap moai update command

Example hook configuration in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "pattern": "^moai update",
        "command": "node .claude/workflows/hns-moai-update-guard-run.js"
      }
    ]
  }
}
```

## Quality Assurance

### Test Cases

1. **Normal case**: No changes → No warning
2. **Git ignore changed**: Warning + diff
3. **CLAUDE.md changed**: Warning + diff
4. **Both changed**: Warning + diff for both
5. **File not found pre**: Skip + info message
6. **File not found post**: Warning + show deletion
7. **Permission denied**: Error + exit 1
8. **Dirty working tree**: Verify anyway

### Verification

Test the harness:

```bash
# 1. Create test files
echo "test" > .gitignore
echo "test" > CLAUDE.md

# 2. Capture hashes
BEFORE_GITIGNORE=$(shasum -a 256 .gitignore | awk '{print $1}')
BEFORE_CLAUDE=$(shasum -a 256 CLAUDE.md | awk '{print $1}')

# 3. Modify files
echo "modified" > .gitignore
echo "modified" > CLAUDE.md

# 4. Run verification
/harness:moai-update-guard

# 5. Should show warning
```

## References

- Lesson #33: `.moai/memory/lessons.md` entry #33
- moai update documentation: `moai update --help`
- Git checkout: `git checkout -- <file>`
- SHA-256 hashing: `shasum -a 256 <file>`

## See Also

- `.moai/harnesses/moai-update-guard/manifest.json` - Harness configuration
- `.claude/agents/harness/hns-moai-update-guard-specialist.md` - Specialist agent
- `.claude/workflows/hns-moai-update-guard-run.js` - Runner script
