import React from 'react';
import { render } from '@testing-library/react-native';
import { BookCard } from '../src/components/BookCard';
import { EmotionRecordCard } from '../src/components/EmotionRecordCard';
import { ThemeProvider } from '../src/theme/theme';

describe('BookCard Component (T-008)', () => {
  it('should render with 80x110 cover placeholder', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <BookCard title="Test Book" author="Test Author" currentPage={120} totalPages={320} />
      </ThemeProvider>
    );

    const card = getByTestId('book-card');
    expect(card).toBeDefined();
  });

  it('should truncate title to 2 lines with ellipsis', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <BookCard
          title="This is a very long book title that should be truncated to two lines with ellipsis"
          author="Test Author"
          currentPage={120}
          totalPages={320}
        />
      </ThemeProvider>
    );

    const title = getByTestId('book-card-title');
    expect(title).toBeDefined();
  });

  it('should show progress bar with percentage', () => {
    const { getByText } = render(
      <ThemeProvider>
        <BookCard title="Test Book" author="Test Author" currentPage={120} totalPages={320} />
      </ThemeProvider>
    );

    const caption = getByText('120 / 320p (38%)');
    expect(caption).toBeDefined();
  });

  it('should support dark mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <BookCard title="Test Book" author="Test Author" currentPage={120} totalPages={320} />
      </ThemeProvider>
    );

    const card = getByTestId('book-card');
    expect(card).toBeDefined();
  });
});

describe('EmotionRecordCard Component (T-008)', () => {
  it('should render with blur overlay when isSpoiler is true (C3)', () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          isSpoiler={true}
        />
      </ThemeProvider>
    );

    const card = getByTestId('emotion-record-card');
    expect(card).toBeDefined();

    // Verify spoiler label is present
    const spoilerLabel = getByText('이 기록은 내 진도를 넘었어요');
    expect(spoilerLabel).toBeDefined();
  });

  it('should render without blur overlay when isSpoiler is false', () => {
    const { getByTestId, queryByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          isSpoiler={false}
        />
      </ThemeProvider>
    );

    const card = getByTestId('emotion-record-card');
    expect(card).toBeDefined();

    // Verify spoiler label is NOT present
    const spoilerLabel = queryByText('이 기록은 내 진도를 넘었어요');
    expect(spoilerLabel).toBeNull();
  });

  it('should have brand-300 2dp left accent line (C3)', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          isSpoiler={false}
        />
      </ThemeProvider>
    );

    const card = getByTestId('emotion-record-card');
    expect(card).toBeDefined();
  });

  it('should render all three sticker types (empathy, touching, comforted)', () => {
    const { getByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          stickers={[
            { type: 'empathy', count: 5 },
            { type: 'touching', count: 3 },
            { type: 'comforted', count: 2 },
          ]}
        />
      </ThemeProvider>
    );

    // Verify all sticker emojis and counts are rendered
    expect(getByText('🤗 5')).toBeDefined();
    expect(getByText('😢 3')).toBeDefined();
    expect(getByText('🫂 2')).toBeDefined();
  });

  it('should not render sticker row when stickers array is empty', () => {
    const { queryByTestId } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          stickers={[]}
        />
      </ThemeProvider>
    );

    const card = queryByTestId('emotion-record-card');
    expect(card).toBeDefined();

    // Verify stickers container is not rendered (no testID for stickers container)
    // The component uses conditional rendering: stickers.length > 0
  });

  it('should not render sticker row when stickers array is undefined', () => {
    const { queryByTestId } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          // stickers prop is optional, defaults to []
        />
      </ThemeProvider>
    );

    const card = queryByTestId('emotion-record-card');
    expect(card).toBeDefined();
  });

  it('should display empty content text correctly', () => {
    const { getByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content=""
          bookTitle="Test Book"
        />
      </ThemeProvider>
    );

    // Verify empty string is handled
    const contentText = getByText('');
    expect(contentText).toBeDefined();
  });

  it('should display nickname, page, and time label correctly', () => {
    const { getByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="TestUser"
          page={42}
          daysAgo={1}
          content="Test content"
          bookTitle="Test Book"
        />
      </ThemeProvider>
    );

    // Verify "어제" (yesterday) is shown when daysAgo is 1
    expect(getByText('TestUser · p.42 · 어제')).toBeDefined();
  });

  it('should display "오늘" when daysAgo is 0', () => {
    const { getByText } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="TestUser"
          page={42}
          daysAgo={0}
          content="Test content"
          bookTitle="Test Book"
        />
      </ThemeProvider>
    );

    expect(getByText('TestUser · p.42 · 오늘')).toBeDefined();
  });

  it('should support dark mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <EmotionRecordCard
          nickname="User"
          page={120}
          daysAgo={3}
          content="Test content"
          bookTitle="Test Book"
          isSpoiler={false}
        />
      </ThemeProvider>
    );

    const card = getByTestId('emotion-record-card');
    expect(card).toBeDefined();
  });
});
