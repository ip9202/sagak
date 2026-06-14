-- Create indexes for SPEC-DB-001
-- Migration: 0013_create_indexes
-- Requirements: Performance optimization for common queries (from ERD section 3)
-- Reference: .booktalk/pages_06_ERD.md section 3

-- Index 1: user_books (user_id, status) for 서재 목록 조회
CREATE INDEX idx_user_books_user_id_status ON public.user_books (user_id, status);

-- Index 2: user_books (book_id, is_public, last_progress_at) for Track A readers
CREATE INDEX idx_user_books_book_id_public_progress ON public.user_books (book_id, is_public, last_progress_at);

-- Index 3: user_books (book_id, started_reading_at) for time-based recommendations
CREATE INDEX idx_user_books_book_id_started ON public.user_books (book_id, started_reading_at);

-- Index 4: clubs (book_id, type, status) for book club discovery
CREATE INDEX idx_clubs_book_id_type_status ON public.clubs (book_id, type, status);

-- Index 5: join_requests (club_id, status) for pending join requests
CREATE INDEX idx_join_requests_club_id_status ON public.join_requests (club_id, status);

-- Index 6: join_requests (requester_id, status) for user's sent requests
CREATE INDEX idx_join_requests_requester_id_status ON public.join_requests (requester_id, status);

-- Index 7: emotion_records (book_id, page_number) for feed pagination
CREATE INDEX idx_emotion_records_book_id_page ON public.emotion_records (book_id, page_number);

-- Index 8: emotion_records (user_id, created_at DESC) for user's records
CREATE INDEX idx_emotion_records_user_id_created_at ON public.emotion_records (user_id, created_at DESC);

-- Index 9: sticker_reactions (record_id) for reaction aggregation
CREATE INDEX idx_sticker_reactions_record_id ON public.sticker_reactions (record_id);

-- Index 10: club_members (user_id) for user's groups list
CREATE INDEX idx_club_members_user_id ON public.club_members (user_id);

-- Index 11: reading_sessions (user_id, book_id) for reading footprint
CREATE INDEX idx_reading_sessions_user_id_book_id ON public.reading_sessions (user_id, book_id);

-- Index 12: notifications (user_id, is_read) for unread notifications
CREATE INDEX idx_notifications_user_id_is_read ON public.notifications (user_id, is_read);

-- Add helpful comments
COMMENT ON INDEX idx_user_books_user_id_status IS '서재 목록 조회 최적화';
COMMENT ON INDEX idx_user_books_book_id_public_progress IS 'Track A "지금 읽는 중" 활성·공개 독자 목록';
COMMENT ON INDEX idx_user_books_book_id_started IS '"같은 시기" 우선 추천';
COMMENT ON INDEX idx_clubs_book_id_type_status IS '책별 함께 읽기 그룹 조회(합류 대상)';
COMMENT ON INDEX idx_join_requests_club_id_status IS '그룹의 대기 중 합류 요청';
COMMENT ON INDEX idx_join_requests_requester_id_status IS '내가 보낸 요청';
COMMENT ON INDEX idx_emotion_records_book_id_page IS '진도별 피드 조회';
COMMENT ON INDEX idx_emotion_records_user_id_created_at IS '내 기록 목록 (최신순)';
COMMENT ON INDEX idx_sticker_reactions_record_id IS '기록별 리액션 집계';
COMMENT ON INDEX idx_club_members_user_id IS '내 그룹 목록';
COMMENT ON INDEX idx_reading_sessions_user_id_book_id IS '발자국/(확장)독서실';
COMMENT ON INDEX idx_notifications_user_id_is_read IS '안읽은 알림';
