/**
 * N2-2 Realtime broadcast RLS 게이트 runtime smoke (SPEC-NOTIF-002 acceptance §3.2)
 *
 * [목적 / WHY]
 * 단위 테스트는 클라이언트 목(mock)으로 "수신하지 않은 이벤트를 화면에 표시하지 않는다"까지만
 * 검증할 수 있고, 서버측 Realtime 브로드캐스트 단계에서 *실제로* RLS 가 이벤트를 차단하는지는
 * 증명하지 못한다 (acceptance.md §3.2 가 지적한 갭). 본 스크립트는 로컬 Supabase 스택에서
 * 두 실제 인증 세션(A/B)과 postgres_changes 구독을 띄워 서버측 RLS 게이트를 종단간 검증한다.
 *
 * [설계 — 왜 client-side filter 를 빼는가]
 * 앱 훅(useNotificationsRealtime)은 `filter: user_id=eq.${userId}` 로 클라이언트 필터를 건다.
 * 그러나 *이 필터를 켜면* "A 가 B 의 이벤트를 수신하지 않는다"는 결과가 RLS 게이트 때문인지
 * 단순히 클라이언트 필터 매스킹 때문인지 구분할 수 없다 (§3.2 가 경고하는 정확한 한계).
 * 따라서 A 의 구독은 user_id 필터 없이 모든 INSERT 를 수신하도록 구성하고, 서버가 A 에게
 * B 의 행을 브로드캐스트하지 *않는다*는 것으로 RLS 게이트를 직접 증명한다.
 *
 * [왜 admin API 가 아닌 docker exec 로 사용자를 시드하는가]
 * 본 앱은 kakao/naver/google OAuth 전용이며 public.users.provider CHECK 가 이들만 허용한다.
 * GoTrue 의 admin createUser 는 email 가입 시 raw_app_meta_data.provider="email" 로 *덮어쓰기*하여
 * 이 CHECK 를 위배한다 (실측: SQLSTATE 23514). 따라서 이메일/패스워드 테스트 사용자는 admin API
 * 가 아닌 로컬 DB 직접 시드로만 provider=kakao 메타데이터와 함께 만들 수 있다. 시드 행은
 * GoTue 가 password-grant 스캔 시 NULL 을 허용하지 않는 토큰 컬럼(confirmation_token 등)을
 * 모두 ''로 채운다. 이 제약은 로컬 smoke 전용이며 서비스 롤(Service Role)로는 INSERT/구독에
 * 사용하지 않는다.
 *
 * [검증 절차]
 *  1. 로컬 docker postgres 로 사용자 A/B 시드(provider=kakao + bcrypt 패스워드, idempotent).
 *  2. A 로 signInWithPassword → access_token 획득 (Realtime 이 A 의 JWT 로 RLS 평가).
 *  3. A 의 클라이언트에서 notifications INSERT 구독(user_id 필터 없음). SUBSCRIBED 대기.
 *  4. service_role 로 B 의 알림 INSERT → [4s 창] A 수신 이벤트 중 B 행이 없어야 한다 (RLS 게이트).
 *  5. positive control: service_role 로 A 의 알림 INSERT → [4s 창] A 가 *수신해야* 한다
 *     (브로드캐스트 기계가 정상임을 입증 → RLS 만이 변수로 고립됨).
 *
 * [판정 로직]
 *  - positive control 실패(A 자기 알림 미수신) → INCONCLUSIVE: 브로드캐스트 자체 불량.
 *  - positive control 통과 + B→A 차단 → PASS: RLS 게이트 종단간 확인 (N2-2 충족).
 *  - positive control 통과 + B→A *수신* → FAIL: Realtime 이 SELECT RLS 를 브로드캐스트에
 *    적용하지 않음. 별도 broadcast RLS 정책 필요 → blocker (스크립트 exit 1).
 *
 * [환경 변수 — 비밀 키는 커밋 금지, 런타임에만 주입]
 *   SUPABASE_URL                — 로컬 API URL (예: http://127.0.0.1:54321)
 *   SUPABASE_ANON_KEY           — publishable/anon 키
 *   SUPABASE_SERVICE_ROLE_KEY   — service_role/secret 키 (알림 INSERT 전용, 절대 커밋 금지)
 *   DB_CONTAINER                — 로컬 postgres 컨테이너명 (기본: supabase_db_sagak; 사용자 시드용)
 *
 * 실행 예:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<secret> \
 *   node scripts/realtime-smoke/n2-2-broadcast-rls.mjs
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// --- 환경 변수 검증 ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_CONTAINER = process.env.DB_CONTAINER || 'supabase_db_sagak';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (missing.length > 0) {
  console.error(`[N2-2] FATAL: 누락된 환경 변수: ${missing.join(', ')}`);
  console.error('        자세한 변수명은 스크립트 상단 헤더 주석 참고.');
  process.exit(2);
}

// --- 상수 ---
// 고정 UUID 로 시드/정리를 멱등하게 유지 (auth.uid() 가 곧 RLS 판정 키).
const USER_A = { id: 'aaaaaa00-0000-0000-0000-0000000000a1', email: 'n22-smoke-a@test.local' };
const USER_B = { id: 'aaaaaa00-0000-0000-0000-0000000000b2', email: 'n22-smoke-b@test.local' };
const PASSWORD = 'N22-Smoke-Test-123!';
const SUBSCRIBE_TIMEOUT_MS = 10_000;
const EVENT_WINDOW_MS = 4_000;
const CHANNEL_NAME = 'n22-smoke-broadcast-rls';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 클라이언트 ---
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// A 의 클라이언트: anon 키 + signIn 로 세션 확립 → Realtime 이 A 의 JWT 로 RLS 평가
const clientA = createClient(SUPABASE_URL, ANON_KEY);

/**
 * 로컬 docker postgres 로 SQL 실행(stdin 파이프). service_role HTTP 가 아닌
 * OS 수준 postgres 롤을 사용해 auth.users/public.users 직접 조작한다.
 */
function runSql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A'],
    { input: sql, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
}

/** A/B 사용자 시드(idempotent). provider=kakao + bcrypt + GoTue 스캔 호환 토큰 컬럼. */
function seedUsers() {
  const sql = `
DELETE FROM notifications WHERE user_id IN ('${USER_A.id}','${USER_B.id}');
DELETE FROM public.users  WHERE id IN ('${USER_A.id}','${USER_B.id}');
DELETE FROM auth.users     WHERE id IN ('${USER_A.id}','${USER_B.id}');
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at, last_sign_in_at
)
SELECT
  uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
  crypt('${PASSWORD}', gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"kakao"}'::jsonb, '{}'::jsonb, false, false, now(), now(), now()
FROM (VALUES
  ('${USER_A.id}'::uuid, '${USER_A.email}'),
  ('${USER_B.id}'::uuid, '${USER_B.email}')
) AS t(uid, email);
`;
  runSql(sql);
}

/** 시드 정리(notifications → public.users → auth.users, FK 역순). */
function cleanupUsers() {
  runSql(`
DELETE FROM notifications WHERE user_id IN ('${USER_A.id}','${USER_B.id}');
DELETE FROM public.users  WHERE id IN ('${USER_A.id}','${USER_B.id}');
DELETE FROM auth.users     WHERE id IN ('${USER_A.id}','${USER_B.id}');
`);
}

/**
 * 채널 SUBSCRIBED 를 제한 시간 내 대기. 그 외 상태는 reject.
 */
function waitForSubscribed(channel, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`구독 타임아웃(${timeoutMs}ms 내 SUBSCRIBED 미달)`));
    }, timeoutMs);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve(status);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`구독 실패(status=${status}): ${err?.message ?? '알 수 없음'}`));
      }
    });
  });
}

/** 결과 한 줄 출력 */
function line(ok, label, detail) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label} — ${detail}`);
}

// --- 메인 ---
let channel;
const createdNotifIds = [];

try {
  // 1) 사용자 시드(idempotent)
  seedUsers();
  console.log(`[N2-2] 사용자 시드 완료: A=${USER_A.id}  B=${USER_B.id} (docker postgres, provider=kakao)`);

  // 2) A 로그인 → 세션(=Realtime RLS 평가용 JWT) 확립
  const { data: signInData, error: signInErr } = await clientA.auth.signInWithPassword({
    email: USER_A.email,
    password: PASSWORD,
  });
  if (signInErr || !signInData?.session?.access_token) {
    throw new Error(`A signIn 실패: ${signInErr?.message ?? '세션/access_token 없음'}`);
  }
  console.log('[N2-2] A 로그인 완료 (access_token 확보 — Realtime RLS 평가용)');

  // 3) 구독(user_id 필터 없음 — 서버측 RLS 게이트 직접 검증)
  const received = [];
  channel = clientA.channel(CHANNEL_NAME);
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    (payload) => {
      const row = payload?.new;
      received.push({ id: row?.id, user_id: row?.user_id, title: row?.title });
    },
  );
  await waitForSubscribed(channel, SUBSCRIBE_TIMEOUT_MS);
  console.log('[N2-2] A 구독 SUBSCRIBED (user_id 필터 없음 → RLS 게이트 직접 검증 모드)');

  // 4) B 의 알림 INSERT(service_role) → A 는 수신하면 안 됨(RLS 게이트)
  const { data: bNotif, error: bErr } = await admin
    .from('notifications')
    .insert({ user_id: USER_B.id, type: 'completion', title: 'B-only', body: 'B row' })
    .select()
    .single();
  if (bErr || !bNotif) throw new Error(`B notifications INSERT 실패: ${bErr?.message}`);
  createdNotifIds.push(bNotif.id);
  await sleep(EVENT_WINDOW_MS);
  const bLeakedToA = received.some((e) => e.id === bNotif.id);

  // 5) positive control: A 자기 알림 INSERT(service_role) → A 는 수신해야 함
  const { data: aNotif, error: aErr } = await admin
    .from('notifications')
    .insert({ user_id: USER_A.id, type: 'completion', title: 'A-own', body: 'A row' })
    .select()
    .single();
  if (aErr || !aNotif) throw new Error(`A notifications INSERT 실패: ${aErr?.message}`);
  createdNotifIds.push(aNotif.id);
  await sleep(EVENT_WINDOW_MS);
  const aReceivedOwn = received.some((e) => e.id === aNotif.id);

  // --- 판정 ---
  console.log('[N2-2] 검증 결과:');
  console.log(`  (수신 이벤트 총 ${received.length}건: ${JSON.stringify(received)})`);
  line(!bLeakedToA, 'B→A 브로드캐스트 차단', bLeakedToA
    ? `FAIL — A 가 B 의 행(id=${bNotif.id})을 수신 → RLS 미적용`
    : `PASS — A 는 B 의 행(id=${bNotif.id})을 수신하지 않음 (RLS 게이트)`);
  line(aReceivedOwn, 'A 자기 알림 수신(positive control)', aReceivedOwn
    ? `PASS — A 가 자기 행(id=${aNotif.id}) 수신 (브로드캐스트 정상)`
    : `FAIL — A 가 자기 행(id=${aNotif.id}) 미수신 → 브로드캐스트 불량`);

  let verdict;
  if (!aReceivedOwn) {
    verdict = 'INCONCLUSIVE';
    console.error('\n[N2-2] 판정: INCONCLUSIVE — positive control 실패. 브로드캐스트 기계 자체가 동작하지 않음.');
    console.error('       B→A 차단 결과와 무관하게 원인 진단 필요(Realtime 활성/구독/네트워크).');
  } else if (bLeakedToA) {
    verdict = 'FAIL';
    console.error('\n[N2-2] 판정: FAIL — Realtime 이 SELECT RLS 를 브로드캐스트에 적용하지 않음.');
    console.error('       acceptance §3.2 + migration 주석에 따라 별도 broadcast RLS 정책 추가 필요(blocker).');
    console.error('       진단: supabase/config.toml [realtime] 섹션의 RLS 토글 및 Supabase 버전 확인.');
  } else {
    verdict = 'PASS';
    console.log('\n[N2-2] 판정: PASS — 서버측 RLS 게이트가 타인 알림 브로드캐스트를 종단간 차단 (N2-2 충족).');
  }

  process.exitCode = verdict === 'PASS' ? 0 : 1;
} catch (err) {
  console.error(`\n[N2-2] 예외: ${err?.message ?? err}`);
  console.error('       판정: ERROR — 스크립트 실행 중 예외(인프라/설정 문제 가능성).');
  process.exitCode = 1;
} finally {
  // --- 정리(채널 + 시드 사용자/알림) ---
  try {
    if (channel) {
      channel.unsubscribe();
      clientA.removeChannel(channel);
    }
  } catch (_) { /* ignore cleanup error */ }
  try {
    await clientA.auth.signOut();
  } catch (_) { /* ignore */ }
  try {
    cleanupUsers();
  } catch (e) {
    console.error(`[N2-2] 정리 중 오류(무시 가능): ${e?.message ?? e}`);
  }
  // Realtime 웹소켓이 이벤트 루프를 붙잡아 프로세스가 지연 종료되므로 즉시 종료.
  // 정리(cleanup)는 위에서 완료했고, exitCode 는 판정 결과(PASS=0)를 반영한다.
  process.exit(process.exitCode ?? 0);
}
