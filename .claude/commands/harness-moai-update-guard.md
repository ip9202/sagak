---
name: harness-moai-update-guard
description: Verify that moai update did not modify project custom files (.gitignore and CLAUDE.md) to prevent lesson #33 recurrence
allowed-tools: Bash, Read, Write, Edit
argument-hint: [no arguments - automatic verification after moai update]
---

# Harness: moai-update-guard

## Purpose

Detect when `moai update` modifies project custom files (.gitignore and CLAUDE.md) and warn the user to prevent lesson #33 recurrence.

## Usage

This command is automatically invoked after `moai update` completes:

```bash
/harness:moai-update-guard
```

No arguments required - verification is automatic.

## Verification Logic

1. Capture SHA-256 hashes of .gitignore and CLAUDE.md (pre-flight)
2. Execute moai update
3. Recapture hashes (post-flight)
4. Compare: if hashes differ, print warning with diff output

## Warning Message

```
⚠️ moai update가 프로젝트 커스텀 파일을 수정했습니다.

변경된 파일: <files>
복구 방법: git checkout -- .gitignore CLAUDE.md
```

## Edge Cases

- **File not found**: Skip with warning (normal for new projects)
- **Permission denied**: Error and exit (verification impossible)
- **Working tree dirty**: Still verify (file-based comparison, git diff independent)

## Integration

This harness is integrated into the moai update workflow via the runner script at `.claude/workflows/hns-moai-update-guard-run.js`.
