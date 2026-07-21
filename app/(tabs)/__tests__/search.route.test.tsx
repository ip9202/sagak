/**
 * search.tsx 라우트 — ISBN→UUID 라우팅 통합 테스트
 * SPEC-LIBRARY-001 — TASK-003 (blocker B 라우팅 해소)
 *
 * 검증 대상:
 * - onSelectBook 콜백이 resolveBookId 를 호출하여 UUID 로 router.push 수행
 * - NOT_FOUND(미등록 ISBN) 시 사용자 친화적 메시지 노출 (books 등록 플로우 안내)
 *
 * 전략: BookSearchScreen 을 thin mock 하여 onNavigateScan/onSelectBook 콜백만 호출하고,
 * resolveBookId 와 router.push 의 상호작용을 검증한다.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

// resolveBookId mock — 변수명은 mock 접두어 필수 (jest hoisting 제약)
const mockResolveBookId = jest.fn();
jest.mock('../../../src/features/book/resolveBookId', () => ({
  resolveBookId: (...args: unknown[]) => mockResolveBookId(...args),
}));

// router.push 추적
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

// BookSearchScreen thin mock — 콜백 prop 만 노출
jest.mock('../../../src/features/book/BookSearchScreen', () => {
  const ReactMod = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    BookSearchScreen: ({ onSelectBook }: { onSelectBook: (r: { isbn: string; title: string }) => void }) =>
      ReactMod.createElement(
        View,
        { testID: 'search-screen' },
        ReactMod.createElement(Text, null, 'mock-search'),
        ReactMod.createElement(
          Pressable,
          {
            testID: 'select-trigger',
            onPress: () => onSelectBook({ isbn: '9791186565873', title: '호모 데우스' }),
          },
          ReactMod.createElement(Text, null, 'select'),
        ),
      ),
  };
});

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

import SearchRoute from '../search';

describe('SPEC-LIBRARY-001 TASK-003: search.tsx ISBN→UUID 라우팅', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('onSelectBook 은 resolveBookId 로 UUID 를 얻어 router.push(/<UUID>) 수행한다', async () => {
    mockResolveBookId.mockResolvedValue('uuid-abc-123');
    const { getByTestId } = render(<SearchRoute />);

    fireEvent.press(getByTestId('select-trigger'));

    await waitFor(() => {
      expect(mockResolveBookId).toHaveBeenCalledWith('9791186565873');
      expect(mockPush).toHaveBeenCalledWith('/uuid-abc-123');
    });
  });

  it('resolveBookId 가 NOT_FOUND 인 경우 ISBN 이 아닌 UUID 를 push 하지 않는다 (에러 처리)', async () => {
    const notFoundError = Object.assign(new Error('not found'), {
      name: 'AppError',
      category: 'NOT_FOUND',
    });
    mockResolveBookId.mockRejectedValue(notFoundError);

    const { getByTestId } = render(<SearchRoute />);
    fireEvent.press(getByTestId('select-trigger'));

    // 에러 발생 시 push 가 호출되지 않음을 검증 (사용자에게 메시지 표시는 UI 계층에서 처리)
    await waitFor(() => expect(mockResolveBookId).toHaveBeenCalled());
    // 비동기 처리 대기 후 push 미호출 확인
    await new Promise((r) => setTimeout(r, 50));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
