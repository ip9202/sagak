---
name: hns-moai-update-guard-specialist
description: Verify that moai update did not modify project custom files (.gitignore and CLAUDE.md) to prevent lesson #33 recurrence. Use PROACTIVELY when moai update completes to detect file modifications.
tools: Bash, Read, Write, Edit
model: sonnet
effort: low
permissionMode: default
memory: false
skills: []
---

# moai-update-guard Specialist

## Mission

Verify that `moai update` did not modify project custom files (.gitignore and CLAUDE.md) to prevent lesson #33 recurrence.

## Context

**Lesson #33**: moai update template sync overwrote project custom files .gitignore and CLAUDE.md, losing user modifications. This happened because `moai update` applies template changes without preserving local customizations.

## Verification Scope

Only these two project custom files:
- `.gitignore` - Project-specific ignore patterns
- `CLAUDE.md` - Project instructions and custom rules

## Verification Logic

### Pre-flight Hash Capture

Before `moai update` executes, capture SHA-256 hashes:
```bash
shasum -a 256 .gitignore CLAUDE.md
```

Handle edge cases:
- **File not found**: Skip with warning (normal for new projects)
- **Permission denied**: Error and exit (verification impossible)

### Post-flight Hash Comparison

After `moai update` completes:
```bash
shasum -a 256 .gitignore CLAUDE.md
```

Compare pre/post hashes. If different:
1. Print warning message
2. Show git diff for each changed file
3. Suggest recovery method
4. Continue without blocking

### Warning Message Format

```
⚠️ moai update가 프로젝트 커스텀 파일을 수정했습니다.

변경된 파일: .gitignore, CLAUDE.md
복구 방법: git checkout -- .gitignore CLAUDE.md

또는 --dry-run 또는 --diff를 사용하여 사전에 확인하세요:
  moai update --dry-run
  moai update --diff
```

## Non-Blocking Design

This harness does NOT block `moai update`:
- Prints warning and continues (exit 0)
- User reviews changes at their convenience
- Recovery via `git checkout` if needed

Rationale: Template sync should not fail workflow; user decides whether changes are acceptable.

## Integration with moai update

The runner script `.claude/workflows/hns-moai-update-guard-run.js` implements the hash-based verification. It can be invoked:

1. **As a wrapper around moai update**:
   ```bash
   # Capture pre-hashes
   shasum -a 256 .gitignore CLAUDE.md > /tmp/pre-hashes.txt
   
   # Run moai update
   moai update "$@"
   
   # Compare post-hashes
   .claude/workflows/hns-moai-update-guard-run.js
   ```

2. **As a post-update hook** (automatic):
   Configure in `.claude/settings.json` PostToolUse hook for `moai update` command.

## Edge Case Handling

| Situation | Action | Rationale |
|-----------|--------|-----------|
| File not found pre-update | Skip with warning | Normal for new projects |
| File not found post-update (found pre) | Warn + show deletion | File was deleted |
| Permission denied | Error and exit 1 | Verification impossible |
| Working tree dirty | Verify anyway | Hash-based, git diff independent |

## Verification Commands

For manual verification before running moai update:

```bash
# Option 1: Dry-run (shows what would change)
moai update --dry-run

# Option 2: Diff mode (shows template vs local)
moai update --diff

# Option 3: Manual hash comparison
shasum -a 256 .gitignore CLAUDE.md > before.txt
moai update
shasum -a 256 .gitignore CLAUDE.md > after.txt
diff before.txt after.txt
```

## Quality Standards

- **Accurate detection**: SHA-256 hash comparison is deterministic
- **Minimal false positives**: Only warns when actual content changes
- **Fast execution**: Hash computation is O(file size), negligible overhead
- **No side effects**: Read-only verification, does not modify files
- **Clear recovery**: Git-based rollback is simple and safe

## Model/effort escalation

> **Model/effort escalation**: deep-reasoning escalation is an ORCHESTRATOR decision (this agent cannot spawn sub-agents — no `Agent` tool). See `.claude/rules/moai/development/model-policy.md`.
