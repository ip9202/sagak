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
 * 테스트는 RS256 키페어를 생성해 직접 서명하고, node:https 모듈을 가로채어
 * JWKS 엔드포인트 요청에 대해 테스트 키페어의 공개 JWK 를 반환한다.
 * (jose Node 빌드는 node:https.get 을 사용. jest.mock 은 파일 최상단에서
 * hoist 되어 jose 로드 시점에 mock 이 주입된다.)
 */
import {
  generateKeyPairSync,
  createSign,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { Readable } from 'node:stream';

// 키페어/응답 데이터는 모듈 스코프에서 setJwksResponse 로 주입 — jest.mock 팩토리에서
// 클로저로 접근 불가(jest.mock 은 파일 최상단 hoist)하므로 mutable holder 사용.
const state: { publicJwk: unknown | null } = { publicJwk: null };

// node:https 를 가로채 JWKS_URL 요청에 고정 응답. jose 가 require('node:https') 시 주입.
jest.mock('node:https', () => {
  const actual = jest.requireActual('node:https');
  return {
    ...actual,
    get(_url: unknown, _optsOrCb: unknown, maybeCb: unknown) {
      // jose Node 빌드는 get(url, {agent,timeout,headers}) 2-arg 형태로 호출 후
      // once(req, 'response') 로 응답을 기다린다. 콜백은 사용하지 않는다.
      const { Readable: R } = jest.requireActual('node:stream');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req: any = new R({ read() {} });
      req.destroy = () => {};
      req.setTimeout = () => {};
      setImmediate(() => {
        const body = JSON.stringify({ keys: [state.publicJwk] });
        const res = R.from([Buffer.from(body)]);
        res.statusCode = 200;
        res.statusMessage = 'OK';
        res.headers = { 'content-type': 'application/json' };
        // jose 가 once(req,'response') 로 대기하므로 req 에서 emit.
        req.emit('response', res);
      });
      return req;
    },
  };
});

// jose 와 logic 은 https mock 주입 후 로드되도록 동적 require (테스트 내부).
import { SignJWT, exportJWK } from 'jose';

const SUPABASE_URL = 'https://test-supabase.supabase.co';
const ISSUER = SUPABASE_URL;
const AUDIENCE = 'authenticated';

interface TestKeypair {
  privateKey: KeyObject;
  kid: string;
  publicJwk: { kty: 'RSA'; kid: string; n: string; e: string; alg: 'RS256' };
}

function makeKeypair(): TestKeypair {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey,
    kid: randomBytes(8).toString('hex'),
    publicJwk: undefined as unknown as TestKeypair['publicJwk'],
  };
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('SPEC-SECURITY-001 verifyAndExtractJwtSub (jose RS256 서명 검증)', () => {
  let keypair: TestKeypair;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { verifyAndExtractJwtSub: verify } = require('../logic');

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
    state.publicJwk = keypair.publicJwk;
    // logic.ts 가 Deno.env.get('SUPABASE_URL') 호출 — Node 런타임 스텁.
    // @ts-expect-error — 테스트 전용 글로벌 스텔스 주입
    globalThis.Deno = { env: { get: (n: string) => process.env[n] } };
  });

  afterAll(() => {
    // @ts-expect-error — 스텁 정리
    delete globalThis.Deno;
  });

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
  });

  it('REQ-SEC-060: 유효한 RS256 서명 토큰은 { sub } 를 반환한다', async () => {
    const token = await new SignJWT({ sub: 'user-uuid-1234' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verify(`Bearer ${token}`);
    expect(result).toBe('user-uuid-1234');
  });

  it('REQ-SEC-061: 서명 변조 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: 'user-uuid-1234' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const parts = token.split('.');
    const sig = parts[2];
    const flipped = sig.endsWith('A') ? sig.slice(0, -1) + 'B' : sig.slice(0, -1) + 'A';
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;

    const result = await verify(`Bearer ${tampered}`);
    expect(result).toBeNull();
  });

  it('REQ-SEC-062: HS256 알고리즘 혼동 토큰은 null 을 반환한다 (RS256 고정)', async () => {
    const header = b64url(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: keypair.kid })),
    );
    const payload = b64url(
      Buffer.from(
        JSON.stringify({
          sub: 'user-uuid-1234',
          iss: ISSUER,
          aud: AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    );
    const signingInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const fakeSig = signer.sign(keypair.privateKey);
    const fakeToken = `${signingInput}.${b64url(fakeSig)}`;

    const result = await verify(`Bearer ${fakeToken}`);
    expect(result).toBeNull();
  });

  it('REQ-SEC-063: 만료된 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: 'user-uuid-1234' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('0s')
      .sign(keypair.privateKey);

    await new Promise((r) => setTimeout(r, 50));
    const result = await verify(`Bearer ${token}`);
    expect(result).toBeNull();
  });

  it('인증 헤더 누락/잘못된 형식은 null 을 반환한다 (https 미호출)', async () => {
    expect(await verify(null)).toBeNull();
    expect(await verify('')).toBeNull();
    expect(await verify('Basic abc')).toBeNull();
    expect(await verify('Bearer')).toBeNull();
    expect(await verify('Bearer ')).toBeNull();
  });

  it('잘못된 발행자(issuer) 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: 'user-uuid-1234' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer('https://evil.example.com')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verify(`Bearer ${token}`);
    expect(result).toBeNull();
  });

  it('잘못된 청중(audience) 토큰은 null 을 반환한다', async () => {
    const token = await new SignJWT({ sub: 'user-uuid-1234' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid, typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience('service_role')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keypair.privateKey);

    const result = await verify(`Bearer ${token}`);
    expect(result).toBeNull();
  });
});
