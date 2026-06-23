// Repository hygiene test: store credential safety (REQ-DEPLOY-008)
// SPEC-DEPLOY-001 M4
//
// REQ-DEPLOY-008: Apple App Store Connect API key, Google Play service account
// JSON, and real environment files MUST NOT be committed to the repository.
// This test locks the .gitignore patterns so a future contributor cannot
// accidentally stage a credential file.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const GITIGNORE_PATH = join(REPO_ROOT, '.gitignore');

function readGitignore(): string {
  if (!existsSync(GITIGNORE_PATH)) {
    throw new Error('.gitignore not found at repo root');
  }
  return readFileSync(GITIGNORE_PATH, 'utf-8');
}

describe('Credential repository hygiene (SPEC-DEPLOY-001 M4, REQ-DEPLOY-008)', () => {
  const gitignore = readGitignore();

  describe('Apple App Store Connect 크리덴셜', () => {
    it('AuthKey_*.p8 (App Store Connect API Key) 가 ignore 된다', () => {
      // Apple API Key 파일명 패턴: AuthKey_<KEYID>.p8
      expect(gitignore).toMatch(/\.p8\b/);
    });

    it('*.p12 인증서 파일이 ignore 된다', () => {
      expect(gitignore).toMatch(/\.p12\b/);
    });
  });

  describe('Google Play Console 크리덴셜', () => {
    it('service-account JSON 이 ignore 된다 (REQ-DEPLOY-008)', () => {
      // service-account-key.json, google-service-account.json 등 변형 모두 커버
      expect(gitignore.toLowerCase()).toMatch(/service.account/);
    });
  });

  describe('실제 환경 변수 파일 (.env)', () => {
    it('.env 파일이 ignore 된다 (단 .env.example/.env.staging 템플릿은 예외)', () => {
      // .env.example, .env.staging(placeholder), .env.production(placeholder) 는 커밋 허용
      expect(gitignore).toMatch(/^\.env$/m);
    });
  });

  describe('Supabase 크리덴셜', () => {
    it('SUPABASE_ACCESS_TOKEN 등 민감 키를 담은 파일이 ignore 된다', () => {
      // supabase 시크릿을 담을 수 있는 패턴 보장
      expect(gitignore).toMatch(/supabase.*token|\.env/i);
    });
  });
});
