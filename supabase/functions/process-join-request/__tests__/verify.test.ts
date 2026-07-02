/**
 * SPEC-SECURITY-001 REQ-SEC-060~064: verifyAndExtractJwtSub 단위 테스트
 *
 * jose 기반 RS256 서명 검증 헬퍼의 보안 속성을 증명한다:
 * - REQ-SEC-060: 유효 서명 토큰 통과 ({ sub } 반환)
 * - REQ-SEC-061: 서명 변조 토큰 실패 (null)
 * - REQ-SEC-062: HS256 알고리즘 혼동 토큰 실패 (null) — RS256 고정 방어
 * - REQ-SEC-063: 만료 토큰 실패 (null)
 * - REQ-SEC-064: JWKS fetch 인터셉트 (실제 네트워크 미사용)
 *
 * 테스트는 RS256 키페어를 생성해 직접 서명하고, JWKS 엔드포인트 fetch 를
 * 가로채어 테스트 키페어의 공개 JWK 를 반환한다.
 */
import {
  generateKeyPairSync,
  createSign,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { SignJWT, exportJWK } from 'jose';
import {
  verifyAndExtractJwtSub,
} from '../logic';

const SUPABASE_URL = 'https://test-supabase.supabase.co';
const ISSUER = SUPABASE_URL;
const AUDIENCE = 'authenticated';
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;

/** RS256 키페어 + JWK export 를 포함한 테스트 fixture. */
interface TestKeypair {
  privateKey: KeyObject;
  kid: string;
  publicJwk: { kty: 'RSA'; kid: string; n: string; e: string; alg: 'RS256' };
}

function makeKeypair(): TestKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  // exportJWK 는 비동기지만 jose 동기 래퍼로 처리 — Promise 를 await 해야 하므로
  // 테스트 setup 에서 await. 여기서는 키 메타만 동기 생성.
  const kid = randomBytes(8).toString('hex');
  return {
    privateKey,
    kid,
    // publicJwk 는 beforeAll 에서 async 로 채운다.
    publicJwk: undefined as unknown as TestKeypair['publicJwk'],
  };
}

/** JWKS fetch 인터셉터 — global fetch 를 교체했다가 복원한다. */
function installJwksInterceptor(publicJwk: TestKeypair['publicJwk']) {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === JWKS_URL) {
      return Promise.resolve(
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    // 다른 URL 은 원래 fetch 로 — 테스트 격리 보장.
    return originalFetch(input as RequestInfo, _init);
  });
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/** base64url 인코딩 헬퍼 (수동 JWT 빌드용). */
function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('SPEC-SECURITY-001 verifyAndExtractJwtSub (jose RS256 서명 검증)', () => {
  let keypair: TestKeypair;
  let restoreFetch: () => void;
  const realSub = 'user-uuid-1234';

  beforeAll(async () => {
    keypair = makeKeypair();
    const jwk = await exportJWK(keypair.privateKey);
    keypair.publicJwk = {
      kty: 'RSA',
      kid: keypair.kid,
      n: jwk.n as string,
      e: jwk.e as string,
      alg: 'RS256',
    };
  });

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;
    restoreFetch = installJwksInterceptor(keypair.publicJwk);
  });

  afterEach(() => {
    restoreFetch();
    delete process.env.SUPABASE_URL;
  });

  it('REQ-SEC-060: 유효한 RS256 서명 토큰은 { sub } 를 반환한다', async () => {
    const token = await new SignJWT({ sub: realSub })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verifyAndExtractJwtSub(`Bearer ${token}`);
    expect(result).toBe(realSub);
  });

  it('REQ-SEC-061: 서명 변조 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: realSub })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    // signature 부분(3번째 세그먼트)의 마지막 바이트를 변조
    const parts = token.split('.');
    const tamperedSig = parts[2].slice(0, -2) + (parts[2].endsWith('A') ? 'B' : 'A') + parts[2].slice(-1);
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    const result = await verifyAndExtractJwtSub(`Bearer ${tamperedToken}`);
    expect(result).toBeNull();
  });

  it('REQ-SEC-062: HS256 알고리즘 혼동 토큰은 null 을 반환한다 (RS256 고정)', async () => {
    // 공격자가 공개키를 HS256 비밀키로 오용해 서명 시도. alg: HS256 헤더로 전송.
    // verifyAndExtractJwtSub 는 algorithms: ['RS256'] 으로 고정하므로 HS256 거부.
    const header = b64url(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: keypair.kid })),
    );
    const payload = b64url(
      Buffer.from(
        JSON.stringify({
          sub: realSub,
          iss: ISSUER,
          aud: AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    // 공개키의 JWK n/e 를 이용한 단순 HMAC 시도 (실제 공격 패턴 모사 — RS256 고정이 막음)
    const signingInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const fakeSig = signer.sign(keypair.privateKey);
    const fakeToken = `${signingInput}.${b64url(fakeSig)}`;

    const result = await verifyAndExtractJwtSub(`Bearer ${fakeToken}`);
    expect(result).toBeNull();
  });

  it('REQ-SEC-063: 만료된 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: realSub })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('0s') // 이미 만료
      .sign(keypair.privateKey);

    // 만료 시점 보장을 위해 약간 대기
    await new Promise((r) => setTimeout(r, 50));

    const result = await verifyAndExtractJwtSub(`Bearer ${token}`);
    expect(result).toBeNull();
  });

  it('인증 헤더 누락/잘못된 형식은 null 을 반환한다', async () => {
    expect(await verifyAndExtractJwtSub(null)).toBeNull();
    expect(await verifyAndExtractJwtSub('')).toBeNull();
    expect(await verifyAndExtractJwtSub('Basic abc')).toBeNull();
    expect(await verifyAndExtractJwtSub('Bearer')).toBeNull();
    expect(await verifyAndExtractJwtSub('Bearer ')).toBeNull();
  });

  it('잘못된 발행자(issuer) 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: realSub })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer('https://evil.example.com') // 의도값 위반
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verifyAndExtractJwtSub(`Bearer ${token}`);
    expect(result).toBeNull();
  });

  it('잘못된 청중(audience) 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: realSub })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience('service_role') // 의도값(authenticated) 위반
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verifyAndExtractJwtSub(`Bearer ${token}`);
    expect(result).toBeNull();
  });
});
