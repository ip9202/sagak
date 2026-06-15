/**
 * app.json 딥링크 스킴 검증 테스트
 * SPEC-NAV-001 — REQ-NAV-030, 인수 시나리오 D4, 엣지 케이스 EC8
 *
 * app.json은 정적 파일이므로 require()로 로드하여 문자열 값을 검증한다.
 * Expo가 scheme 등록 시 iOS CFBundleURLSchemes + Android intent-filter를 자동 생성하므로
 * 본 테스트는 app.json의 "scheme" 키 존재와 값만 보증한다.
 */
import appJson from '../../app.json';

describe('REQ-NAV-030: 딥링크 스킴 등록 (D4, EC8 사전 차단)', () => {
  it('app.json이 expo.expo.scheme 문자열 "sagak"을 포함한다', () => {
    expect(appJson.expo.scheme).toBe('sagak');
  });

  it('scheme이 빈 문자열이 아니다 (EC8: 스킴 미등록 상태 사전 차단)', () => {
    expect(typeof appJson.expo.scheme).toBe('string');
    expect(appJson.expo.scheme.length).toBeGreaterThan(0);
  });
});
