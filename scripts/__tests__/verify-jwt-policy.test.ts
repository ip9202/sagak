/**
 * SPEC-SECURITY-001 REQ-SEC-001~003: A1 verify_jwt CI 가드 단위 테스트
 *
 * scripts/verify-jwt-policy.sh 는 supabase/config.toml 의 [functions.<name>] 블록에서
 * verify_jwt 값을 파싱해 의도값 매트릭스와 비교한다. 본 테스트는 임시 fixture config.toml
 * 을 생성해 스크립트를 실행하고 종료 코드로 검증한다.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '..', 'verify-jwt-policy.sh');

/**
 * 유효한 config.toml — 모든 함수가 의도값 매트릭스와 일치.
 * 본 repo 의 실제 config.toml 상태(process-join-request=true, naver-userinfo-proxy=false,
 * send-notification/kakao-book-search 는 블록 없음)를 충실하게 반영.
 */
const VALID_CONFIG = `# sample valid config.toml for A1 guard test
project_id = "test"

[functions.naver-userinfo-proxy]
verify_jwt = false

[functions.process-join-request]
verify_jwt = true
`;

/** 드리프트 config — process-join-request 가 의도값(true) 과 다르게 false. */
const DRIFT_CONFIG = `# drifted config.toml — process-join-request 가 false 로 드리프트
project_id = "test"

[functions.process-join-request]
verify_jwt = false
`;

/** config.toml 에 존재하지만 매트릭스에 없는 함수 (REQ-SEC-003 신규 함수 누락). */
const UNKNOWN_FUNCTION_CONFIG = `# config.toml — 매트릭스에 없는 신규 함수
project_id = "test"

[functions.process-join-request]
verify_jwt = true

[functions.brand-new-fn]
verify_jwt = true
`;

async function runScript(
  configPath: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  // ENV 가 export 되어 있지 않으면 스크립트가 config.toml 위치를 알 수 없다.
  // 스크립트는 CONFIG_TOML 환경변수(기본 supabase/config.toml)를 읽는다.
  return new Promise((resolvePromise) => {
    execFile(
      'bash',
      [SCRIPT_PATH],
      { env: { ...process.env, CONFIG_TOML: configPath } },
      (err, stdout, stderr) => {
        const codeErr = err as (Error & { code?: number }) | null;
        resolvePromise({
          code: codeErr ? codeErr.code ?? 1 : 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );
  });
}

function writeFixture(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'a1-guard-'));
  const path = join(dir, 'config.toml');
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('SPEC-SECURITY-001 A1: verify_jwt per-function CI 가드', () => {
  it('유효한 config.toml 은 종료코드 0 (REQ-SEC-001)', async () => {
    const path = writeFixture(VALID_CONFIG);
    const result = await runScript(path);
    expect(result.code).toBe(0);
  });

  it('의도값 매트릭스 불일치 시 비-제로 종료 + 함수명/기대값/실제값 메시지 (REQ-SEC-002)', async () => {
    const path = writeFixture(DRIFT_CONFIG);
    const result = await runScript(path);
    expect(result.code).not.toBe(0);
    // stderr 또는 stdout 에 함수명, 기대값, 실제값 이 포함되어야 한다.
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('process-join-request');
    expect(combined.toLowerCase()).toContain('true'); // 기대값
    expect(combined.toLowerCase()).toContain('false'); // 실제값
  });

  it('매트릭스에 없는 신규 함수 감지 시 비-제로 종료 (REQ-SEC-003)', async () => {
    const path = writeFixture(UNKNOWN_FUNCTION_CONFIG);
    const result = await runScript(path);
    expect(result.code).not.toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('brand-new-fn');
  });

  it('스크립트 파일이 존재한다 (실수 방지)', () => {
    // 스크립트 경로 오타 방지용 가드 — readdirSync 로 디렉토리 확인.
    const dir = resolve(__dirname, '..'); // scripts/
    const files = readdirSync(dir);
    expect(files).toContain('verify-jwt-policy.sh');
  });
});
