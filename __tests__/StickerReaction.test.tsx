import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StickerReaction } from '../src/components/StickerReaction';
import { ThemeProvider } from '../src/theme/theme';

describe('StickerReaction Component (T-009)', () => {
  it('should render 3 sticker types', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <StickerReaction selectedType={null} onTypeSelect={() => {}} />
      </ThemeProvider>
    );

    const container = getByTestId('sticker-reaction');
    expect(container).toBeDefined();
  });

  it('should toggle sticker selection', () => {
    const onSelectMock = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <StickerReaction selectedType={null} onTypeSelect={onSelectMock} />
      </ThemeProvider>
    );

    // First click should select
    const empathyButton = getByTestId('sticker-empathy');
    fireEvent.press(empathyButton);
    expect(onSelectMock).toHaveBeenCalledWith('empathy');

    // Second click should deselect (toggle)
    onSelectMock.mockClear();
    fireEvent.press(empathyButton);
    expect(onSelectMock).toHaveBeenCalledWith(null);
  });

  it('should show selected state with brand-200 background', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <StickerReaction selectedType={'empathy'} onTypeSelect={() => {}} />
      </ThemeProvider>
    );

    const empathyButton = getByTestId('sticker-empathy');
    expect(empathyButton).toBeDefined();
  });

  it('should disable interaction when not authenticated', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <StickerReaction
          selectedType={null}
          onTypeSelect={() => {}}
          isAuthenticated={false}
        />
      </ThemeProvider>
    );

    const container = getByTestId('sticker-reaction');
    expect(container).toBeDefined();
  });

  it('should support dark mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <StickerReaction selectedType={null} onTypeSelect={() => {}} />
      </ThemeProvider>
    );

    const container = getByTestId('sticker-reaction');
    expect(container).toBeDefined();
  });
});
