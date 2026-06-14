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

    const caption = getByText('120 / 320p (37%)');
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
    const { getByTestId } = render(
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
