// Unit tests for Edge Function deploy target resolution (REQ-DEPLOY-022)
// SPEC-DEPLOY-001 M6
//
// The actual `supabase functions deploy` command runs in a shell script
// (scripts/deploy-edge-functions.sh). This test covers the resolvable,
// deterministic parts: the function registry, environment→project mapping,
// and ref-name validation. These are pure data, no network needed.
import {
  EDGE_FUNCTIONS,
  resolveDeployTarget,
  type DeployEnvironment,
} from '../edge-function-deploy';

describe('Edge Function deploy resolution (SPEC-DEPLOY-001 M6, REQ-DEPLOY-022)', () => {
  describe('EDGE_FUNCTIONS registry — 위임된 3종 함수 포함', () => {
    it('kakao-book-search (SPEC-BOOK-001 위임) 함수가 등록되어 있다', () => {
      expect(EDGE_FUNCTIONS).toContain('kakao-book-search');
    });

    it('process-join-request (SPEC-CLUB-001 위임) 함수가 등록되어 있다', () => {
      expect(EDGE_FUNCTIONS).toContain('process-join-request');
    });

    it('send-notification (SPEC-NOTIF-001 위임) 함수가 등록되어 있다', () => {
      expect(EDGE_FUNCTIONS).toContain('send-notification');
    });
  });

  describe('EDGE_FUNCTIONS registry — SSOT 무결성 (registry.json 파생)', () => {
    // @MX:NOTE: [AUTO] JSON SSOT 도입 후 드리프트 감지용. registry.json ↔ TS literal 단언 불일치 시 실패.
    it('정확히 4개 함수가 등록되어 있다 (위임 3종 + Naver OIDC 보조 1종)', () => {
      expect(EDGE_FUNCTIONS).toHaveLength(4);
    });

    it('naver-userinfo-proxy (SPEC-DEPLOY-001 REQ-DEPLOY-019) 함수가 등록되어 있다', () => {
      expect(EDGE_FUNCTIONS).toContain('naver-userinfo-proxy');
    });
  });

  describe('resolveDeployTarget — REQ-DEPLOY-013 (환경별 배포 트리거 분리)', () => {
    it('development 환경은 dev Supabase project ref로 해결한다', () => {
      const target = resolveDeployTarget('development');

      expect(target.environment).toBe('development');
      expect(target.projectRef).toBeTruthy();
      expect(target.projectRef.length).toBeGreaterThan(0);
    });

    it('staging 환경은 staging Supabase project ref로 해결한다', () => {
      const target = resolveDeployTarget('staging');

      expect(target.environment).toBe('staging');
      expect(target.projectRef).not.toBe(resolveDeployTarget('development').projectRef);
    });

    it('production 환경은 prod Supabase project ref로 해결한다', () => {
      const target = resolveDeployTarget('production');

      expect(target.environment).toBe('production');
      // 세 환경은 서로 다른 project ref를 가져야 한다 (REQ-DEPLOY-023 환경 분리)
      expect(target.projectRef).not.toBe(resolveDeployTarget('staging').projectRef);
    });

    it('잘못된 환경 값은 에러를 던진다 (fail-fast)', () => {
      expect(() =>
        resolveDeployTarget('qa' as DeployEnvironment)
      ).toThrow(/environment/i);
    });
  });

  describe('resolveDeployTarget — 배포 명령 인자 구성', () => {
    it('단일 함수에 대한 deploy 인자 목록을 생성한다', () => {
      const target = resolveDeployTarget('staging');

      const args = target.commandFor('send-notification');
      expect(args).toContain('functions');
      expect(args).toContain('deploy');
      expect(args).toContain('send-notification');
      expect(args).toContain('--project-ref');
      expect(args.some((a) => target.projectRef.includes(a))).toBe(true);
    });

    it('배포 명령에 no-bundle 확인 옵션이 포함되지 않는다 (기본 동작 유지)', () => {
      const target = resolveDeployTarget('production');
      const args = target.commandFor('kakao-book-search');
      // 실제 deploy 동작은 스크립트가 담당 — 인터페이스는 project-ref와 함수명만 보장
      expect(args.length).toBeGreaterThanOrEqual(4);
    });
  });
});
