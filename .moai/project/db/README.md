# .moai/project/db/

`/moai db init` 완료 (2026-06-14). 감정 공유 독서 모임 앱(사각)의 DB 메타데이터 공식 출처이다.

| 항목 | 값 |
|------|-----|
| Engine | Supabase (관리형 PostgreSQL + PostgREST + Realtime + Storage) |
| ORM / 쿼리 계층 | Supabase JS Client (PostgREST 직접 호출) |
| 멀티테넌시 | 단일 스키마 + RLS (행 단위 사용자 데이터 격리) |
| 마이그레이션 도구 | Supabase CLI (`supabase/migrations/*.sql`) |

---

## Purpose

This directory is the **authoritative source** for database schema documentation, migration history,
access-control policies, query patterns, and seed data strategy for this project.

Files are maintained in two ways:
1. **Auto-sync**: The `moai-domain-db-docs` PostToolUse hook detects migration file changes and
   regenerates schema documentation automatically (10-second debounce).
2. **Manual edit**: Any file in this directory can be edited directly. Re-running `/moai db init`
   will **preserve** your edits and only warn — it will not overwrite user-modified files
   (see Auto-sync Policy below and SPEC-DB-CMD-001 for enforcement details).

---

## Auto-sync Policy

| Trigger | Action |
|---------|--------|
| Migration file saved (matches `migration_patterns` in `db.yaml`) | `moai-domain-db-docs` regenerates `schema.md` and `erd.mmd` |
| Files in `.moai/project/db/**` saved | **Excluded** — no recursive trigger |
| Files in `.moai/cache/**` saved | Excluded |
| `**/*.lock` files saved | Excluded |

Debounce: 10 seconds (configurable via `db.auto_sync.debounce_seconds` in `db.yaml`).
User approval required before applying auto-generated changes (`require_user_approval: true`).

이 프로젝트에서 매칭되는 마이그레이션 패턴: `supabase/migrations/**/*.sql` (Supabase CLI 규칙).

---

## Update Workflow

```
1. Edit migration file (e.g., supabase/migrations/20260614000001_create_profiles.sql)
2. PostToolUse hook fires → moai-domain-db-docs analyzes changes
3. Proposed updates presented via AskUserQuestion
4. On approval: schema.md and erd.mmd are updated
5. Manual review: rls-policies.md, queries.md, seed-data.md (not auto-updated)
```

For conflicts (e.g., you edited `schema.md` manually and a migration also changed the schema),
MoAI calls `AskUserQuestion` to resolve the conflict before writing.

---

## File Responsibilities

| File | Purpose | Auto-updated? |
|------|---------|---------------|
| `schema.md` | Tables/collections, relationships, indexes, constraints | Yes (via hook) |
| `erd.mmd` | Mermaid ER diagram — visual representation of schema | Yes (via hook) |
| `migrations.md` | Applied and pending migration history, rollback notes | Partial (applied list) |
| `rls-policies.md` | Row-level security policies, access control matrix | No — edit manually |
| `queries.md` | Common queries, aggregations, reports | No — edit manually |
| `seed-data.md` | Seed strategy, fixture locations, dev vs prod data | No — edit manually |

> 현재 상태: `schema.md`·`erd.mmd`는 도메인 기반 시작 스켈레톤으로 채워져 있으나,
> 실제 마이그레이션이 아직 없다. 첫 마이그레이션 작성 시 자동 동기화가 본격 가동된다.
> `rls-policies.md`는 단일 스키마 + RLS 전략의 핵심 산출물이므로 비즈니스 결정 대기
> 사항(모임 가입 승인, 공개 범위 등)을 해소하며 지속 보완한다.

---

## Excluded Patterns

The following paths are excluded from auto-sync triggering (see `db.yaml`):

```
.moai/project/db/**    # This directory — prevents recursive hook loops
.moai/cache/**         # Cache files
**/*.lock              # Lock files (package-lock.json, yarn.lock, etc.)
```

---

## Configuration

Database documentation behavior is controlled by `.moai/config/sections/db.yaml`.

Current settings:
- `db.enabled` = `true` — auto-sync 활성화 (init에서 설정됨)
- `db.engine` = `supabase` — Supabase 관리형 PostgreSQL
- `db.orm` = `supabase-js` — Supabase JS Client
- `db.multi_tenant` = `single-schema-rls` — 단일 스키마 + RLS 격리
- `db.migration_tool` = `supabase-cli` — Supabase CLI 마이그레이션

---

_Last reviewed: 2026-06-14_
_Populated by: `/moai db init` interview (2026-06-14) — Supabase + supabase-js + single-schema-rls + supabase-cli_
