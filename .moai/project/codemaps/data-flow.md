# Sa-gak Data Flow Paths

주요 데이터 흐름 — 인증 가드, OAuth 딥링크, 테마, 세션 지속성, 도서 검색/상세 조회 API(M1/M2) + 수동 검색/바코드 스캔/상세 UI(M3/M4)

## 1. Auth Guard Flow

**목적:** 인증/온보딩 상태에 따른 라우팅 분기

**진입점:** `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`

```mermaid
sequenceDiagram
    participant Route as Route (app/index.tsx)
    participant Hook as useSession()
    participant Context as AuthContext
    participant Client as Supabase Client
    participant Store as SecureStore/AsyncStorage

    Route->>Hook: const session = useSession()
    Hook->>Context: Access session state
    Context->>Client: getUser() (if cached missing)
    Client->>Store: Read session token
    Store-->>Client: Return token
    Client-->>Context: Return user data
    Context-->>Hook: Return session state

    alt session === null
        Hook-->>Route: null (loading)
        Route->>Route: <ActivityIndicator />
    else !isAuthenticated
        Hook-->>Route: { isAuthenticated: false }
        Route->>Route: router.replace('/auth/login')
    else isAuthenticated && !isOnboarded
        Hook-->>Route: { isAuthenticated: true, isOnboarded: false }
        Route->>Route: router.replace('/auth/onboarding')
    else isAuthenticated && isOnboarded
        Hook-->>Route: { isAuthenticated: true, isOnboarded: true }
        Route->>Route: router.replace('/tabs')
    end
```

### State Transitions

| 상태 | 조건 | 액션 | 다음 상태 |
|------|------|------|----------|
| `null` | 초기 로딩 중 | `<ActivityIndicator />` | 로딩 완료 시 `{session, user, profile, ...}` 또는 `{session: null, user: null, profile: null, loading: false}` |
| `{ isAuthenticated: false }` | 세션 없음 | `router.replace('/auth/login')` | 로그인 성공 시 `{ isAuthenticated: true, isOnboarded: ? }` |
| `{ isAuthenticated: true, isOnboarded: false }` | 온보딩 안 됨 | `router.replace('/auth/onboarding')` | 온보딩 완료 시 `{ isAuthenticated: true, isOnboarded: true }` |
| `{ isAuthenticated: true, isOnboarded: true }` | 모든 조건 충족 | `router.replace('/tabs')` | 메인 앱 진입 |

### Key Implementation

**File:** `src/auth/useSession.ts`

```typescript
export function useSession() {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useSession must be used within AuthProvider')
  }
  
  return context.session
}
```

**반환값 타입:**
```typescript
type SessionState = null | {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  isOnboarded: boolean
  signInWithProvider: (provider: 'kakao' | 'apple' | 'google') => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}
```

---

## 2. OAuth Deep-link Flow

**목적:** OAuth 제공자(Kakao/Apple/Google)에서 인증 후 앱으로 복귀

**진입점:** `app/(auth)/auth/callback.tsx`

```mermaid
sequenceDiagram
    participant User as User
    participant OAuth as OAuth Provider
    participant DeepLink as Deep Link<br/>sagak://auth/callback
    participant Callback as callback.tsx
    participant Listener as AuthContext.onAuthStateChange
    participant Client as Supabase Client
    participant Router as Router

    User->>OAuth: OAuth 요청 (signInWithProvider)
    OAuth->>OAuth: 사용자 승인
    OAuth->>DeepLink: 리다이렉트 with auth code
    DeepLink->>Callback: 앱 열림 (sagak://auth/callback)
    
    Callback->>Callback: useLocalSearchParams() (discarded)
    Callback->>Callback: useSession() 호출
    
    Note over Callback,Listener: AuthContext listener already listening
    Listener->>Client: Supabase auth listener trigger
    Client->>Client: Exchange auth code for tokens
    Client-->>Listener: Session established
    
    Listener->>Listener: Update AuthContext state
    Listener->>Callback: useSession returns new state
    
    alt isNewUser
        Callback->>Router: router.replace('/auth/onboarding')
    else existingUser
        Callback->>Router: router.replace('/tabs')
    end
```

### Key Implementation

**File:** `src/auth/AuthContext.tsx` (onAuthStateChange)

```typescript
useEffect(() => {
  const { data: authListener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setSessionState({
          session,
          user: session.user,
          profile,
          loading: false,
          isAuthenticated: true,
          isOnboarded: profile?.nickname !== null
        })
      } else if (event === 'SIGNED_OUT') {
        setSessionState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          isAuthenticated: false,
          isOnboarded: false
        })
      }
    }
  )

  return () => authListener.subscription.unsubscribe()
}, [])
```

### Deep-link Parameter Handling

**File:** `app/(auth)/auth/callback.tsx`

```typescript
export default function CallbackScreen() {
  const router = useRouter()
  // const params = useLocalSearchParams() // discarded, not used
  
  const session = useSession()
  
  useEffect(() => {
    if (session === null) {
      return // still loading
    }
    
    if (session.isAuthenticated) {
      if (session.isOnboarded) {
        router.replace('/tabs')
      } else {
        router.replace('/auth/onboarding')
      }
    } else {
      router.replace('/auth/login')
    }
  }, [session, router])
  
  return <ActivityIndicator />
}
```

**참고:** 딥링크 파라미터는 사용되지 않음. 실제 토큰 교환은 Supabase Auth listener가 처리합니다.

---

## 3. Theme Flow

**목적:** 라이트/다크 모드 전환 및 테마 토큰 제공

**진입점:** `app/_layout.tsx` (ThemeProvider), 모든 컴포넌트 (useTheme)

```mermaid
sequenceDiagram
    participant Layout as app/_layout.tsx
    participant Provider as ThemeProvider
    participant Hook as useTheme()
    participant Tokens as tokens.ts
    participant DarkTokens as darkTokens.ts
    participant System as Appearance (System)
    participant Store as AsyncStorage (Manual Mode)

    Layout->>Provider: <ThemeProvider>
    Provider->>System: Appearance.getColorScheme()
    System-->>Provider: 'light' | 'dark'
    
    Provider->>Store: AsyncStorage.getItem('themeMode')
    Store-->>Provider: null | 'light' | 'dark'
    
    alt manual mode set
        Provider->>Provider: Use stored mode
    else auto mode (default)
        Provider->>Provider: Use system scheme
    end
    
    Provider->>Tokens: import tokens
    Provider->>DarkTokens: import darkTokens
    
    Note over Provider,DarkTokens: Merge tokens based on colorScheme
    
    Loop Every component render
        Component->>Hook: useTheme()
        Hook-->>Component: { theme, colorScheme, setManualMode }
        Component->>Component: Apply theme tokens
    end
```

### Key Implementation

**File:** `src/theme/theme.tsx`

```typescript
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = Appearance.getColorScheme()
  const [manualMode, setManualModeState] = useState<'light' | 'dark' | null>(null)
  const colorScheme = manualMode || systemColorScheme || 'light'
  
  const themeTokens = colorScheme === 'dark' 
    ? { ...tokens, ...darkTokens }
    : tokens
  
  const setManualMode = useCallback((mode: 'light' | 'dark') => {
    setManualModeState(mode)
    AsyncStorage.setItem('themeMode', mode)
  }, [])
  
  return (
    <ThemeContext.Provider value={{ theme: themeTokens, colorScheme, setManualMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### Token Resolution

**File:** `src/theme/tokens.ts`

```typescript
export default {
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    background: '#ffffff',
    surface: '#f3f4f6',
    // ... more tokens
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
  }
}
```

**File:** `src/theme/darkTokens.ts` (overrides)

```typescript
export default {
  colors: {
    background: '#000000',
    surface: '#1f2937',
    // ... other dark overrides
  }
}
```

### Theme Consumption

**예시: `src/components/Button.tsx`**

```typescript
export function Button(props: ButtonProps) {
  const { theme } = useTheme()
  
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        { backgroundColor: theme.colors.primary }
      ]}
    >
      <Text style={[styles.text, { color: theme.colors.onPrimary }]}>
        {props.title}
      </Text>
    </TouchableOpacity>
  )
}
```

---

## 4. Session Persistence Flow

**목적:** 세션 토큰을 SecureStore/AsyncStorage에 지속적으로 저장

**진입점:** `src/lib/supabase/client.ts` (초기화 시 어댑터 주입)

```mermaid
sequenceDiagram
    participant Client as getSupabaseClient()
    participant Adapter as supabaseStorageAdapter
    participant SecureStore as Expo SecureStore
    participant AsyncStorage as AsyncStorage
    participant Supabase as Supabase Client

    Client->>Adapter: Create adapter instance
    Adapter->>Adapter: Check platform
    
    alt iOS/Android
        Adapter->>SecureStore: Use SecureStore (encrypted)
    else Web/Fallback
        Adapter->>AsyncStorage: Use AsyncStorage (plaintext)
    end
    
    Client->>Supabase: createClient({ auth: { storage: adapter } })
    Supabase->>Supabase: Initialize with custom storage
    
    Note over Supabase,Adapter: Supabase uses adapter for all session operations
    
    Loop Session operations
        Supabase->>Adapter: storage.getItem('session')
        Adapter->>SecureStore/AsyncStorage: Read token
        SecureStore/AsyncStorage-->>Adapter: Return token
        Adapter-->>Supabase: Return session
    end
```

### Key Implementation

**File:** `src/lib/supabase/storageAdapter.ts`

```typescript
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SecureStoreAvailable = Platform.OS !== 'web'

export const supabaseStorageAdapter = {
  getItem: (key: string) => {
    if (SecureStoreAvailable) {
      return SecureStore.getItemAsync(key)
    } else {
      return AsyncStorage.getItem(key)
    }
  },
  setItem: (key: string, value: string) => {
    if (SecureStoreAvailable) {
      return SecureStore.setItemAsync(key, value)
    } else {
      return AsyncStorage.setItem(key, value)
    }
  },
  removeItem: (key: string) => {
    if (SecureStoreAvailable) {
      return SecureStore.deleteItemAsync(key)
    } else {
      return AsyncStorage.removeItem(key)
    }
  }
}
```

**File:** `src/lib/supabase/client.ts`

```typescript
import { createClient } from '@jsr/supabase__supabase-js'
import { supabaseStorageAdapter } from './storageAdapter'
import { getEnvVar } from '@/config/env'

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  supabaseInstance = createClient(
    getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
    getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        storage: supabaseStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    }
  )
  
  return supabaseInstance
}
```

### Storage Security

| 플랫폼 | 저장소 | 보안 | 설명 |
|-------|-------|------|------|
| iOS | SecureStore (Keychain) | ✅ 암호화됨 | 하드웨어 보안 모듈에 저장 |
| Android | SecureStore (Keystore) | ✅ 암호화됨 | 키 스토어에 암호화 저장 |
| Web | AsyncStorage (localStorage) | ⚠️ 평문 | HTTPS 전송에 의존, 개발용 |

---

## 5. Book Search Flow (SPEC-BOOK-001 M1+M2)

**목적:** 도서 검색 요청을 Edge Function으로 전달하여 Kakao API 또는 캐시된 결과 반환

**진입점:** `src/features/book/searchApi.ts` → `invokeEdgeFunction('kakao-book-search')`

```mermaid
sequenceDiagram
    participant UI as BookSearchScreen (M3)
    participant Client as searchBooks()
    participant Edge as Edge Function<br/>kakao-book-search
    participant Cache as findCachedBook()
    participant Kakao as Kakao Book API
    participant DB as Supabase books 테이블
    participant Supabase as getSupabaseClient()

    UI->>Client: searchBooks(query, target)
    Client->>Client: 빈 쿼리 검증 (REQ-BOOK-005)
    
    alt 빈/공백 쿼리
        Client-->>UI: throw AppError(VALIDATION)
        UI->>UI: "검색어를 입력해 주세요"
    else 유효한 쿼리
        Client->>Edge: invokeEdgeFunction('kakao-book-search', {query, target})
        Edge->>Edge: handleSearchRequest()
        
        alt target=isbn && 캐시 히트 (REQ-BOOK-010)
            Edge->>Cache: findCachedBook(client, isbn)
            Cache->>DB: SELECT * FROM books WHERE isbn = $1
            DB-->>Cache: BookRow (캐시된)
            Cache-->>Edge: cached BookRow
            Edge->>Edge: cacheRowToSearchResult (역변환)
            Edge-->>Client: { data: [SearchResult] }
            Client-->>UI: SearchResult[]
        else 캐시 미스 (REQ-BOOK-001)
            Edge->>Kakao: searchKakaoBooks({query, target, apiKey})
            Kakao-->>Edge: KakaoSearchResponse {documents[]}
            Edge->>Edge: normalizeKakaoDocuments (정규화)
            Edge->>Edge: mapToBookRow (매핑)
            Edge->>DB: upsertBooks(rows[]) (REQ-BOOK-011)
            DB->>DB: ON CONFLICT (isbn) DO UPDATE (배치)
            Edge-->>Client: { data: [SearchResult] }
            Client-->>UI: SearchResult[]
        end
    end
```

### Key Implementation

**File:** `src/features/book/searchApi.ts`

```typescript
export async function searchBooks(
  query: string,
  target: SearchTarget = 'title'
): Promise<SearchResult[]> {
  // REQ-BOOK-005: 빈/공백 쿼리 차단
  if (!query || query.trim().length === 0) {
    const err = new AppError('검색어를 입력해 주세요', 'VALIDATION_ERROR', 400);
    err.category = 'VALIDATION' as ErrorCategory;
    throw err;
  }

  const response = await invokeEdgeFunction<SearchResponse>('kakao-book-search', {
    query: query.trim(),
    target,
  });

  return response?.data ?? [];
}
```

### Edge Flow: Cache Hit vs Miss

**Cache Hit (target=isbn):**
1. `findCachedBook(client, isbn)` → `SELECT * FROM books WHERE isbn = $1`
2. 히트 시: `cacheRowToSearchResult` 역변환 → 즉시 반환 (Kakao API 생략)
3. 시나리오: S13 (이미 검색된 ISBN 재검색)

**Cache Miss:**
1. `searchKakaoBooks` → Kakao API 호출
2. `normalizeKakaoDocuments` → 필수 필드 검증
3. `mapToBookRow` → `authors[]` → `author` (join)
4. `upsertBooks(rows[])` → 단일 배치 `upsert` (ON CONFLICT isbn)
5. 시나리오: S14 (신규 ISBN), S18 (title/author 검색)

### Security Boundary

| 경계 | 클라이언트 (anon + SELECT) | Edge Function (service_role + upsert) |
|------|---------------------------|--------------------------------------|
| **권한** | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_SERVICE_ROLE_KEY` (env-only) |
| **작업** | `SELECT * FROM books` | `INSERT/UPDATE books` (RLS 우회) |
| **Kakao 키** | ❌ 노출 금지 (REQ-BOOK-002) | ✅ `KAKAO_REST_API_KEY` (Deno.env) |
| **목적** | 검색 결과 읽기 | 캐시 쓰기, Kakao API 호출 |

---

## 6. Book Detail Flow (SPEC-BOOK-001 M1+M2)

**목적:** bookId로 books 테이블에서 단일 행 조회 (Edge Function 경유 없이 PostgREST 직접 호출)

**진입점:** `src/features/book/bookDetailApi.ts` → `getSupabaseClient().from('books')`

```mermaid
sequenceDiagram
    participant UI as BookDetailScreen (M4)
    participant Client as getBookDetail()
    participant Supabase as getSupabaseClient()
    participant PostgREST as PostgREST
    participant DB as books 테이블

    UI->>Client: getBookDetail(bookId)
    Client->>Supabase: getSupabaseClient()
    Supabase->>PostgREST: from('books').select('*').eq('id', bookId).single()
    PostgREST->>DB: SELECT * FROM books WHERE id = $1
    DB-->>PostgREST: {data: BookRow, error: null} or {data: null, error: PGRST116}
    
    alt 성공 (1행)
        PostgREST-->>Supabase: {data: BookRow, error: null}
        Supabase-->>Client: BookRow
        Client-->>UI: BookRow (시나리오 S19)
    else 0행 (PGRST116)
        PostgREST-->>Supabase: {data: null, error: {code: 'PGRST116', message: '...'}}
        Supabase->>Client: normalizeError(error)
        Client->>Client: classifyError → NOT_FOUND
        Client-->>UI: throw AppError(NOT_FOUND) (시나리오 S20)
    else RLS 거부 (42501)
        PostgREST-->>Supabase: {data: null, error: {code: '42501', message: '...'}}
        Supabase->>Client: normalizeError(error)
        Client->>Client: classifyError → RLS_DENIED
        Client-->>UI: throw AppError(RLS_DENIED) (시나리오 S22)
    end
```

### Key Implementation

**File:** `src/features/book/bookDetailApi.ts`

```typescript
export async function getBookDetail(bookId: string): Promise<BookRow> {
  const client = getSupabaseClient();

  let result: { data: BookRow | null; error: unknown };
  try {
    result = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('Book not found'));
  }

  return result.data;
}
```

### Error Classification

| PostgREST 코드 | normalizeError → classifyError | AppError.category | 시나리오 |
|----------------|-------------------------------|-------------------|----------|
| `PGRST116` (0행) | `NOT_FOUND` | `NOT_FOUND` | S20 (존재하지 않는 bookId) |
| `42501` (RLS) | `RLS_DENIED` | `PERMISSION` | S22 (권한 없음) |
| 네트워크 에러 | `NETWORK_ERROR` | `NETWORK` | S4 (Edge Function 타임아웃) |

---

## Data Flow Health Check

| 흐름 | 상태 | 비고 |
|------|------|------|
| Auth Guard | ✅ 정상 | useSession 기반 분기, null/undefined 안전하게 처리 |
| OAuth Deep-link | ✅ 정상 | 딥링크 파라미터 폐기, Supabase listener 의존 |
| Theme | ✅ 정상 | 시스템/수동 모드 전환, 토큰 병합 작동 |
| Session Persistence | ✅ 정상 | SecureStore/AsyncStorage 폴백, 플랫폼 감지 |
| Book Search (API) | ✅ 정상 (M1+M2) | Edge Function 경유, 캐시 히트/미스 분기, Kakao API 폴백 |
| Book Detail (API) | ✅ 정상 (M1+M2) | PostgREST 직접 조회, PGRST116→NOT_FOUND 분류 |
| Manual Search (UI) | ✅ 정상 (M4) | BookSearchScreen → searchBooks, 빈 쿼리 차단/빈 결과 안내 |
| Barcode Scan (UI) | ✅ 정상 (M3) | BarcodeScanner → 권한 게이트 → ISBN 검증 → 디바운스 → 자동 검색 |
| Book Detail (UI) | ✅ 정상 (M4) | BookDetailScreen → useSession 가드 → getBookDetail → 3상태 분기 |

---

## 7. Manual Search Flow (SPEC-BOOK-001 M4)

**목적:** 사용자가 키워드로 도서를 검색하고 결과에서 선택하여 상세로 이동

**진입점:** `app/(tabs)/search.tsx` (href:null) → `src/features/book/BookSearchScreen.tsx`

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Lib as library.tsx
    participant Route as /search (href:null)
    participant UI as BookSearchScreen
    participant API as searchBooks()
    participant Card as SearchResultCard
    participant Nav as router

    User->>Lib: 검색 진입 CTA 탭
    Lib->>Route: router.push('/search')
    Route->>UI: BookSearchScreen 렌더링

    User->>UI: 검색어 입력 + 검색 버튼
    UI->>UI: 빈 쿼리 검증 (REQ-BOOK-005)
    
    alt 빈/공백 쿼리
        UI->>User: "검색어를 입력해 주세요" (인라인 안내)
    else 유효한 쿼리
        UI->>API: searchBooks(query, target)
        Note over API: Edge Function 플로우 (섹션 5 참조)
        API-->>UI: SearchResult[]
        
        alt 0건 결과
            UI->>User: 빈 결과 안내 ("검색 결과가 없습니다")
        else 1건 이상
            UI->>Card: SearchResult[] 렌더링
            Card->>User: 카드 목록 표시 (formatPublishedMonth)
            User->>Card: 결과 선택
            Card->>Nav: onSelectBook → /book/{isbn}
            Note over Nav: known-issue: ISBN→bookId 매핑<br/>(SPEC-LIBRARY-001 후속)
        end
    end
```

### Key Implementation

**File:** `src/features/book/BookSearchScreen.tsx`

- `searchBooks` 연동 (빈 쿼리 차단은 API 계층에서 1차, UI에서 2차 안내)
- 빈 결과 안내 표시
- `SearchResultCard`로 결과 렌더링

**File:** `src/components/SearchResultCard.tsx`

- `formatPublishedMonth`로 출판월 포맷 (YYYY.MM)
- `useTheme` 토큰 적용

---

## 8. Barcode Scan Flow (SPEC-BOOK-001 M3)

**목적:** 카메라로 도서 바코드를 스캔하여 ISBN을 추출하고 자동 검색으로 전환

**진입점:** `app/(tabs)/scan.tsx` (href:null, 풀스크린) → `src/features/book/BarcodeScanner.tsx`

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Lib as library.tsx
    participant Route as /scan (href:null)
    participant Scanner as BarcodeScanner
    participant Perm as useCameraPermissions
    participant Cam as CameraView (expo-camera)
    participant ISBN as isValidIsbn()
    participant Debounce as shouldSuppressDuplicate()
    participant Nav as router

    User->>Lib: 스캔 진입 CTA 탭
    Lib->>Route: router.push('/scan')
    Route->>Scanner: BarcodeScanner 렌더링
    Scanner->>Perm: useCameraPermissions()
    Perm-->>Scanner: status (null/granted/denied)
    
    alt null (로딩)
        Scanner->>User: 권한 요청 대기
    else denied
        Scanner->>User: 권한 거부 안내 + 설정 이동 CTA
    else granted
        Scanner->>Cam: CameraView + barcodeScannerSettings
        Cam->>Scanner: onBarcodeScanned({rawValue})
        Scanner->>ISBN: isValidIsbn(rawValue)
        
        alt 유효하지 않은 ISBN
            Scanner->>User: 무시 (체크디짓 실패)
        else 유효한 ISBN
            Scanner->>Debounce: shouldSuppressDuplicate(isbn, now)
            
            alt 중복 (2000ms 이내)
                Scanner->>Scanner: 무시 (REQ-BOOK-009)
            else 신규
                Scanner->>Nav: router.replace('/search', {isbn})
                Note over Nav: 자동 검색 트리거 → 섹션 7 플로우
            end
        end
    end
```

### Key Implementation

**File:** `src/features/book/BarcodeScanner.tsx`

- `useCameraPermissions` 권한 게이트 3상태 (null/granted/denied)
- `CameraView` + `barcodeScannerSettings` (expo-camera)
- `onBarcodeScanned` 핸들러 → ISBN 검증 → 디바운스 → 라우팅

**File:** `src/features/book/isbn.ts` (순수함수)

- `isValidIsbn` → `isValidIsbn13` / `isValidIsbn10` 체크디짓 검증 (REQ-BOOK-007)

**File:** `src/features/book/debounce.ts` (순수함수)

- `shouldSuppressDuplicate(isbn, now)` → `DUPLICATE_DEBOUNCE_MS=2000` 이내 중복 차단 (REQ-BOOK-009)

### Permission States

| 상태 | 조건 | 액션 |
|------|------|------|
| `null` | 권한 요청 로딩 중 | 대기 |
| `granted` | 카메라 권한 승인 | CameraView 렌더링 |
| `denied` | 권한 거부 | 안내 + 설정 이동 CTA |

---

## 9. Book Detail UI Flow (SPEC-BOOK-001 M4)

**목적:** bookId로 도서 상세를 조회하고 인증 가드(RLS)를 처리하여 표시

**진입점:** `app/(tabs)/[bookId].tsx` (동적 라우트) → `src/features/book/BookDetailScreen.tsx`

```mermaid
sequenceDiagram
    participant Nav as router
    participant Route as /book/{bookId}
    participant UI as BookDetailScreen
    participant Session as useSession()
    participant API as getBookDetail()
    participant Format as formatPublishedMonth()
    participant User as 사용자

    Nav->>Route: router.push('/book/123')
    Route->>UI: BookDetailScreen 렌더링
    UI->>Session: useSession() (가드)
    
    alt session === null
        UI->>User: ActivityIndicator
    else !isAuthenticated
        UI->>Nav: router.replace('/auth/login') (S22 RLS 거부 사전 차단)
    else authenticated
        UI->>API: getBookDetail(bookId)
        Note over API: PostgREST 플로우 (섹션 6 참조)
        
        alt 성공 (BookRow)
            API-->>UI: BookRow
            UI->>Format: formatPublishedMonth(publishedDate)
            UI->>User: 상세 정보 표시 (제목/저자/출판월/표지)
        else NOT_FOUND (S20)
            API-->>UI: throw AppError(NOT_FOUND)
            UI->>User: "도서를 찾을 수 없습니다"
        else RLS_DENIED (S22)
            API-->>UI: throw AppError(RLS_DENIED)
            UI->>User: "권한이 없습니다" / 로그인 유도
        end
    end
```

### Key Implementation

**File:** `src/features/book/BookDetailScreen.tsx`

- `useSession` 가드 (인증 상태 확인 — RLS 거부 사전 차단)
- `getBookDetail(bookId)` 호출
- 3상태 분기: BookRow / NOT_FOUND(S20) / RLS_DENIED(S22)
- `formatPublishedMonth`로 출판월 포맷

**SPEC-NAV-001 통합:** 기존 `[bookId].tsx` stub을 BookDetailScreen으로 교체 (M4).

---

**Last Updated:** 2026-06-16  
**Branch:** develop (852f0ac → a293e8d SPEC-BOOK-001 M3+M4 merged)
