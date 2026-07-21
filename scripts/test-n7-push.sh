#!/bin/bash
# @MX:NOTE: [AUTO] N7 포그라운드 수신 검증용 푸시 발송 스크립트 (SPEC-NOTIF-001)
#   - send-notification Edge Function 호출 (service_role 내부 처리, 게이트웨이는 anon key 통과)
#   - push_token 등록 사용자 조회 보조 명령 포함
#
# 사용법:
#   ./scripts/test-n7-push.sh list                       — push_token 등록 사용자 조회
#   ./scripts/test-n7-push.sh <user_id> [type] [ref_id]  — 푸시 발송 (기본 type=reading_reminder)
#
# 예:
#   ./scripts/test-n7-push.sh list
#   ./scripts/test-n7-push.sh 550e8400-e29b-41d4-a716-446655440000 reading_reminder

set -euo pipefail

SUPABASE_URL="https://lqltwbpocbgoxvhlmjdo.supabase.co"
ANON_KEY="$(grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env | cut -d= -f2-)"

if [ -z "${ANON_KEY:-}" ]; then
  echo "ERROR: .env에서 EXPO_PUBLIC_SUPABASE_ANON_KEY를 찾을 수 없습니다." >&2
  exit 1
fi

CMD="${1:-}"

if [ "$CMD" = "list" ]; then
  echo "=== push_token 등록 사용자 (최근 10명) ==="
  supabase db query --linked \
    "SELECT id, email, (push_token IS NOT NULL) AS has_token, updated_at
     FROM users ORDER BY updated_at DESC LIMIT 10;" 2>&1
  exit 0
fi

USER_ID="${1:?사용자 ID 필요 — 'list'로 조회 후 user_id((uuid)를 첫 인자로 전달}"
TYPE="${2:-reading_reminder}"
REF_ID="${3:-}"

BODY="{\"user_id\": \"$USER_ID\", \"type\": \"$TYPE\""
if [ -n "$REF_ID" ]; then
  BODY="$BODY, \"ref_id\": \"$REF_ID\""
fi
BODY="$BODY}"

echo "=== send-notification 호출 ==="
echo "user_id : $USER_ID"
echo "type    : $TYPE"
[ -n "$REF_ID" ] && echo "ref_id  : $REF_ID"
echo "---"

curl -sS -X POST "$SUPABASE_URL/functions/v1/send-notification" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  -w "\n---\nHTTP %{http_code}\n"
