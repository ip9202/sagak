/**
 * SPEC-SECURITY-001 REQ-SEC-021: extractJwtSub 호출부 잔존 금지 CI 가드 단위 테스트
 *
 * scripts/verify-no-extractjwtsub.sh 는 supabase/functions/process-join-request 하위
 * 프로덕션 .ts 파일에서 extractJwtSub( 호출부를 정적 검사한다. 본 테스트는 임시 디렉토리에
 * fixture .ts 파일을 생성해 스크립트를 실행하고 종료 코드로 검증한다.
 *
 * 예외 (가드 제외 — REQ-SEC-020 호환성):
 *   - 함수 정의 라인 (function extractJwtSub / export function extractJwtSub)
 *   - 주석 라인 (선행 공백 제거 후 // 로 시작)
 *   - __tests__/ 디렉토리 하위 파일 (레거시 함수 자체의 단위 테스트 허용)
 *
 * 본 가드의 목적은 "미검증 경로(extractJwtSub)의 프로덕션 호출부 재도입 방지"이다.
 * 현재 프로덕션 호출부는 0건이며, 이 가드는 future regression 을 차단한다.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '..', 'verify-no-extractjwtsub.sh');

/**
 * TARGET_DIR 환경변수로 스크립트를 실행한다.
 * 스크립트는 기본값으로 supabase/functions/process-join-request 를 검사하지만,
 * 테스트는 격리된 fixture 디렉토리를 가리키도록 TARGET_DIR 을 오버라이드한다.
 */
async function runScript(
  targetDir: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile(
      'bash',
      [SCRIPT_PATH],
      { env: { ...process.env, TARGET_DIR: targetDir } },
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

/**
 * fixture 디렉토리를 생성하고 주어진 상대경로에 .ts 파일을 작성한다.
 * 반환값은 스크립트에 전달할 TARGET_DIR (fixture 루트 디렉토리).
 */
function writeFixture(parts: string[], content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'extractjwtsub-guard-'));
  const filePath = join(dir, ...parts);
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return dir;
}

/** 프로덕션 코드 — extractJwtSub 호출부 없음 (정상 상태). */
const CLEAN_PROD = `import { verifyAndExtractJwtSub } from './logic';

export async function handler(): Promise<string | null> {
  const sub = await verifyAndExtractJwtSub('Bearer xxx');
  return sub;
}
`;

/** 프로덕션 코드 — extractJwtSub( 호출부 존재 (회귀 결함 — 가드가 차단해야 함). */
const PROD_WITH_CALL = `import { extractJwtSub } from './logic';

export async function handler(): Promise<string | null> {
  const sub = extractJwtSub('Bearer xxx');
  return sub;
}
`;

/**
 * 함수 정의만 포함 (레거시 호환성 유지 — 정의 자체는 허용).
 * console.warn 디프리케이션 로그도 정의 본문의 일부로 간주해 본문 내 'extractJwtSub' 텍스트는
 * 호출부로 간주하지 않는다 (정규식이 'extractJwtSub(' 만 매칭하므로).
 */
const DEFINITION_ONLY = `export function extractJwtSub(authHeader: string | null): string | null {
  console.warn('[SPEC-SECURITY-001] extractJwtSub is deprecated — use verifyAndExtractJwtSub');
  return null;
}
`;

/** 주석에만 extractJwtSub( 가 등장 (주석 라인은 면제). */
const COMMENT_ONLY = `// SPEC-SECURITY-001: extractJwtSub(payload 디코딩 only) → verifyAndExtractJwtSub 교체.
// see also: extractJwtSub() is deprecated.
export async function handler(): Promise<null> {
  return null;
}
`;

/** __tests__/ 하위 파일 — 호출부 포함 (레거시 함수 자체의 단위 테스트는 허용). */
const TEST_WITH_CALL = `import { extractJwtSub } from '../logic';

describe('extractJwtSub', () => {
  it('returns sub', () => {
    expect(extractJwtSub('Bearer xxx')).toBe('user-uuid');
  });
});
`;

describe('SPEC-SECURITY-001 REQ-SEC-021: extractJwtSub 호출부 잔존 금지 가드', () => {
  it('프로덕션 .ts 파일에 extractJwtSub 호출부가 없으면 종료코드 0', async () => {
    const dir = writeFixture(['handler.ts'], CLEAN_PROD);
    const result = await runScript(dir);
    expect(result.code).toBe(0);
  });

  it('프로덕션 .ts 파일에 extractJwtSub( 호출부가 있으면 비-제로 종료 + 함수명/파일명 메시지 (REQ-SEC-021)', async () => {
    const dir = writeFixture(['handler.ts'], PROD_WITH_CALL);
    const result = await runScript(dir);
    expect(result.code).not.toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('extractJwtSub');
    expect(combined).toContain('handler.ts');
  });

  it('함수 정의(export function extractJwtSub) 라인은 면제 — 종료코드 0 (REQ-SEC-020 호환성)', async () => {
    const dir = writeFixture(['logic.ts'], DEFINITION_ONLY);
    const result = await runScript(dir);
    expect(result.code).toBe(0);
  });

  it('주석 라인(// 로 시작)의 extractJwtSub( 는 면제 — 종료코드 0', async () => {
    const dir = writeFixture(['index.ts'], COMMENT_ONLY);
    const result = await runScript(dir);
    expect(result.code).toBe(0);
  });

  it('__tests__/ 하위 .ts 파일의 호출부는 면제 — 종료코드 0 (레거시 함수 자체의 단위 테스트 허용)', async () => {
    const dir = writeFixture(['__tests__', 'logic.test.ts'], TEST_WITH_CALL);
    const result = await runScript(dir);
    expect(result.code).toBe(0);
  });

  it('스크립트 파일이 존재한다 (실수 방지)', () => {
    // 스크립트 경로 오타 방지용 가드 — readdirSync 로 디렉토리 확인.
    const dir = resolve(__dirname, '..'); // scripts/
    const files = readdirSync(dir);
    expect(files).toContain('verify-no-extractjwtsub.sh');
  });
});
