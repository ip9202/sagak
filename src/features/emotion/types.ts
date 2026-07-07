/**
 * 감정 아카이브 도메인 타입 (SPEC-EMOTION-001 T-001)
 *
 * DB Row(emotion_records, sticker_reactions) 를 파생하되:
 * - visibility 를 'public' | 'club' 리터럴로 좁힘 (DB 는 text 컬럼)
 * - 작성자 조인(users.nickname, users.avatar_url) 과 스티커 집계(sticker_reactions GROUP BY) 를
 *   포함한 응답 확장 타입을 제공한다.
 * - StickerType 은 src/types 의 공용 리터럴을 재사용한다 (UI 컴포넌트와 공유).
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import type { Database } from '../../types/supabase';
import type { StickerType } from '../../types';

/** 감정 기록 공개 범위 (DB visibility text 컬럼을 도메인 리터럴로 좁힘) */
export type Visibility = 'public' | 'club';

/** emotion_records.Row (gen-types) — user_id 는 RLS 가 자동 주입하므로 클라이언트 입력에서는 제외 */
export type EmotionRecordRow = Database['public']['Tables']['emotion_records']['Row'];

/** sticker_reactions.Row (gen-types) */
export type StickerReactionRow = Database['public']['Tables']['sticker_reactions']['Row'];

/** DB sticker_type ENUM 리터럴 (StickerType 와 동일) */
export type StickerTypeValue = Database['public']['Enums']['sticker_type'];

/** 작성자 조인 결과 — PostgREST 1:1 조인 users(nickname, avatar_url) */
export interface EmotionRecordAuthor {
  // nickname은 users_nickname_nullable 마이그레이션(0003)으로 NULL 허용 — gen-types(linked) 반영
  nickname: string | null;
  avatar_url: string | null;
}

/**
 * 기록별 스티커 집계 1행 — PostgREST GROUP BY 산출 결과.
 * sticker_type 별 count. 반응이 없는 타입은 행이 나오지 않는다.
 */
export interface StickerAggregate {
  sticker_type: StickerType;
  count: number;
}

/**
 * 목록 조회 단일 항목 — Row + 작성자 조인 + 스티커 집계.
 * PostgREST 응답 형태:
 *   emotion_records(*, users(nickname,avatar_url), sticker_reactions(sticker_type))
 * 집계는 클라이언트에서 StickerAggregate[] 로 환산한다.
 */
export interface EmotionRecordWithAuthor extends EmotionRecordRow {
  users: EmotionRecordAuthor | null;
  sticker_reactions: StickerAggregate[];
}

/**
 * PostgREST 응답의 원시 sticker_reactions 행 (집계 전).
 * GROUP BY 대신 단순 join 결과로 type 만 수집한다.
 *
 * emotion.listEmotionRecords 와 feed.fetchClubFeedPage 가 동일 쿼리 형태를
 * 사용하므로 wire-shape 타입도 emotion 도메인이 단일 소스로 노출한다
 * (SPEC-EMOTION-001 / SPEC-FEED-001 DRY, 이슈 #27).
 */
export interface RawStickerRow {
  sticker_type: StickerType;
}

/**
 * PostgREST list 응답 원시 형태 — 클라이언트에서 EmotionRecordWithAuthor 로 환산한다.
 * emotion.listEmotionRecords 와 feed.fetchClubFeedPage 양쪽이 동일한 환산 대상으로 사용.
 */
export interface RawListRow extends EmotionRecordRow {
  users: { nickname: string | null; avatar_url: string | null } | null;
  sticker_reactions: RawStickerRow[];
}

/** 감정 기록 정렬 옵션 — time(created_at DESC) | page(page_number ASC, created_at ASC 2차) */
export type EmotionSortOption = 'time' | 'page';

/**
 * emotionApi.create 입력.
 * user_id 는 RLS(auth.uid()) 가 자동 주입하므로 클라이언트에서 전송하지 않는다.
 * visibility=club 시 clubId 가 필수 (DB CHECK 제약).
 */
export interface CreateEmotionInput {
  bookId: string;
  pageNumber: number | null;
  content: string;
  visibility: Visibility;
  /** visibility=club 일 때 필수. public 이면 null. */
  clubId: string | null;
}

/**
 * emotionApi.update patch.
 * page_number, user_id, book_id, id 는 고정(수정 불가) — 클라이언트 patch 에서 제외한다.
 */
export interface UpdateEmotionInput {
  content?: string;
  visibility?: Visibility;
  /** visibility=public 으로 전환 시 null 전달. */
  clubId?: string | null;
}

/** emotionApi.list 조회 옵션 */
export interface ListEmotionOptions {
  bookId: string;
  userId: string;
  /** 스포일러 기준 현재 페이지. page_number > currentPage 인 행은 spoiler 로 분류 */
  currentPage: number;
  /** 정렬 옵션. 기본 'time' */
  sort?: EmotionSortOption;
}

/** emotionApi.list 결과 — 스포일러 분할된 두 그룹 */
export interface EmotionListResult {
  /** page_number <= currentPage 인 안전한 기록 (본인 기록은 항상 포함) */
  safe: EmotionRecordWithAuthor[];
  /** page_number > currentPage 인 스포일러 기록 (블러 대상) */
  spoiler: EmotionRecordWithAuthor[];
}
