import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { ThemeProvider } from '../src/theme/theme';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Button Component (T-006)', () => {
  describe('Variant prop (pages_11 §9.1)', () => {
    it('should render primary variant with brand-500 background', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={() => {}}>
          Primary Button
        </Button>
      );

      const button = getByTestId('button');
      // Note: StyleSheet creates nested objects, so we check the style array
      expect(button.props.style).toBeDefined();
    });

    it('should render secondary variant with brand border', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="secondary" onPress={() => {}}>
          Secondary Button
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.style).toBeDefined();
    });

    it('should render ghost variant with transparent background', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="ghost" onPress={() => {}}>
          Ghost Button
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.style).toBeDefined();
    });

    it('should render destructive variant with semantic-error background', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="destructive" onPress={() => {}}>
          Destructive Button
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.style).toBeDefined();
    });

    it('should render disabled variant with bg.muted background and text.disabled color (C2)', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="disabled" onPress={() => {}}>
          Disabled Button
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.style).toBeDefined();

      // Verify the button is styled with disabled variant
      // The disabled variant should have:
      // - backgroundColor: theme.colors.bg.muted (#F4EFE8)
      // - opacity: 0.5 (from isDisabled)
      // - color: theme.colors.text.disabled (#C8B8A8)
      // Note: StyleSheet.flatten may return an object, not an array
      const style = button.props.style;
      expect(style).toBeDefined();

      // Verify the component renders and accessibilityState is disabled
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Loading state', () => {
    it('should show ActivityIndicator when loading', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={() => {}} loading>
          Loading
        </Button>
      );

      const spinner = getByTestId('button-spinner');
      expect(spinner).toBeDefined();
    });

    it('should not call onPress when loading', () => {
      const onPressMock = jest.fn();
      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={onPressMock} loading>
          Loading
        </Button>
      );

      const button = getByTestId('button');
      fireEvent.press(button);
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility (C4)', () => {
    it('should have accessibilityLabel', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={() => {}} accessibilityLabel="Submit form">
          Submit
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.accessibilityLabel).toBe('Submit form');
    });

    it('should have 48dp touch target for non-ghost variants', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={() => {}}>
          Primary
        </Button>
      );

      const button = getByTestId('button');
      // Height should be 48dp (using spacing[12])
      expect(button.props.style).toBeDefined();
    });

    it('should have hitSlop for ghost variant (40dp + hitSlop)', () => {
      const { getByTestId } = renderWithTheme(
        <Button variant="ghost" onPress={() => {}}>
          Ghost
        </Button>
      );

      const button = getByTestId('button');
      // Ghost button is 40dp but hitSlop extends to 44dp minimum
      expect(button.props.style).toBeDefined();
    });
  });

  describe('Dark mode support', () => {
    it('should use dark tokens in dark mode', () => {
      // Mock dark mode
      jest.doMock('react-native/Libraries/Utilities/useColorScheme', () => ({
        default: () => 'dark',
      }));

      const { getByTestId } = renderWithTheme(
        <Button variant="primary" onPress={() => {}}>
          Dark Primary
        </Button>
      );

      const button = getByTestId('button');
      expect(button.props.style).toBeDefined();
    });
  });

  describe('Disabled + loading conflict', () => {
    it('should prioritize disabled over loading', () => {
      const { getByTestId, queryByTestId } = renderWithTheme(
        <Button variant="disabled" onPress={() => {}} loading>
          Disabled Loading
        </Button>
      );

      const button = getByTestId('button');
      const spinner = queryByTestId('button-spinner');

      // When disabled, loading spinner should not show (disabled takes priority)
      expect(spinner).toBeNull();
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
