# Git Flow × MoAI Workflow 치트 시트

> sagak 프로젝트의 분기 정책 결정 가이드.
> SPEC 구현 flow는 현행 유지, hotfix / 부분 수정 경로를 명확히 정리.

작성일: 2026-07-23

---

## 0. 핵심 원칙 (sagak 특이점 3가지)

1. **모든 변경 = PR.** 크기 무관. `develop` direct push가 룰셋으로 차단되어 있어 부분 수정도 PR입니다. 직접 커밋은 없습니다.
2. **hotfix는 dual merge.** `main` + tag만 하고 `develop`을 안 넣는 순간 다음 release에서 재발 — 글로벌 Git Flow HARD 위반.
3. **버전 범프 타이밍.** PATCH(`X.Y.Z+1`)는 핫픽스 경로에서만 main에 tag. develop 단의 부분 수정은 다음 `release/vX.Y.Z` 묶음에서 SemVer 범프합니다 (개별 커밋에 tag 안 찍음).

> sagak은 MoAI 순정 Hybrid Trunk(main-direct push)를 **PROHIBITED** 하고 Git Flow를 HARD로 채택한 프로젝트. Tier S/M이어도 `feature/* → PR → develop` 강제.

---

## 1. SPEC 구현 flow (현행 = 정답, 유지)

```
develop (pull) → feature/SPEC-XXX-desc → TDD/DDD 구현 → 단계별 커밋
  → PR to develop → /moai review → /moai fix(필요시) → squash merge → /moai sync
```

- Phase 1 (`/moai run`): develop pull → feature 브랜치 → 구현 → 단계별 커밋 → PR 생성
- Phase 2 (Post-PR): `/moai review` → `/moai fix` (필요시) → squash merge → 브랜치 삭제 → `/moai sync` (필요시)

---

## 2. 결정 트리 — 수정 발생 시

```
수정 발생
  │
  ├─ prod(main/tagged)에서 발견된 크리티컬 버그?
  │     └─ YES → 【경로 A: hotfix flow】
  │
  └─ develop 단계 / 작업 중 / 아직 release 안 된 것
        │
        ├─ 동작 변경 or 새 기능 → 【경로 B: feature (SPEC 기반)】
        ├─ 단순 버그/회귀       → 【경로 B: feature (reproduction 테스트)】
        └─ 문서/설정/chore      → 【경로 B: feature (경량 PR)】
```

---

## 3. 경로 A — hotfix (prod 크리티컬)

글로벌 Hard 규칙. **dual merge 필수.**

```
1. main에서 hotfix/vX.Y.(Z+1)-이슈명 브랜치
2. 최소 수정만 + 회귀 테스트 추가          ← Reproduction-First (글로벌 §7 Rule 4)
3. hotfix/* → main 머지 + tag vX.Y.(Z+1)
4. hotfix/* → develop 머지 (DUAL MERGE — 절대 스킵 금지)
5. 핫픽스 작업 자체는 /moai fix (reproduction-first) 또는 manager-develop autofix
```

> 주의: develop 동기화를 빠뜨리면 다음 release 때 재발합니다.

---

## 4. 경로 B — 부분 수정 / 작은 개선 (develop 단계)

"부분 수정"도 feature 브랜치 + PR 경로. SPEC을 새로 팔지 말지가 포인트.

| 변경 성격 | 브랜치명 | SPEC 필요? | MoAI 명령 |
|-----------|----------|------------|-----------|
| 동작 변경 / 작은 신기능 | `feature/SPEC-XXX-desc` | **있음** (작은 SPEC도) | `/moai plan` → `/moai run` |
| 단순 버그 / 회귀 | `feature/fix-이슈명` | 없음 (대신 **reproduction 테스트 필수**) | `/moai fix` |
| 문서 / 설정 / chore | `feature/chore-설명` | 없음 | 직접 수정 후 PR |

공통 절차:
```
develop (pull) → feature/* 브랜치 → 수정 + 테스트 → PR to develop
  → squash merge → (API/컴포넌트 변경 시) /moai sync
```

> **SPEC 분기 기준**: 동작이 바뀌면(사용자/호출자가 관찰 가능하면) SPEC을 판다. 내부 구현만 고치고 겉보기 동작이 같으면 reproduction 테스트로 충분. "SPEC이 너무 무거워서"라고 피하면 추적이 끊김.

---

## 5. 실전 치트 시트

| 상황 | 브랜치 | 머지 대상 | tag |
|------|--------|-----------|-----|
| 신규 기능 (SPEC) | `feature/SPEC-XXX-desc` ← develop | develop (PR) | 다음 release에서 |
| 작은 개선 (동작 변경) | `feature/SPEC-XXX-desc` ← develop | develop (PR) | 다음 release에서 |
| 버그 수정 (develop 단) | `feature/fix-이슈명` ← develop | develop (PR) | 다음 release에서 |
| prod 크리티컬 핫픽스 | `hotfix/vX.Y.(Z+1)-이름` ← **main** | **main + tag + develop** (dual) | 즉시 `vX.Y.(Z+1)` |
| 문서/설정 | `feature/chore-설명` ← develop | develop (PR) | — |

---

## 6. SemVer 요약

- **MAJOR (X.0.0)**: breaking change (DB 스키마, 프레임워크 마이그레이션)
- **MINOR (X.Y.0)**: 하위호환 신규 기능 (새 SPEC 머지 후 release 시)
- **PATCH (X.Y.Z)**: 버그 수정, 핫픽스 → 핫픽스 flow에서만 main에 tag

---

## 7. 관련 정책 파일

- 글로벌 Git Flow: `~/.claude/CLAUDE.md` § Git Branch Strategy
- sagak HARD 정책: `CLAUDE.md` § Core Identity (Hybrid Trunk PROHIBITED)
- 메모리 `project-git-flow-policy.md`: develop 룰셋 direct push 차단 → 항상 PR (PR #148)
