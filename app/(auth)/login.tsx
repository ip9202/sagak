/**
 * Login screen route — re-exports src/auth LoginScreen
 * SPEC-AUTH-001 — REQ-AUTH-002~004
 *
 * 실제 구현은 src/auth/login.tsx에 있으며, 이 파일은 expo-router 라우트 진입점 역할만 한다.
 */
export { LoginScreen as default } from '../../src/auth/login';
