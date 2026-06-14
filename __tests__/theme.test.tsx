import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../src/theme/theme';
import { darkColors } from '../src/theme/darkTokens';

// Mock useColorScheme for testing
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: () => 'light',
}));

describe('Theme System (T-005)', () => {
  describe('darkTokens (pages_11 §3)', () => {
    it('should have bg-base as #1A1208', () => {
      expect(darkColors.bg.base).toBe('#1A1208');
    });

    it('should have all 6 explicitly defined dark tokens', () => {
      // pages_11 §3 explicitly defined values
      expect(darkColors.bg.base).toBe('#1A1208');
      expect(darkColors.bg.surface).toBe('#2A1C0E');
      expect(darkColors.bg.muted).toBe('#342212');
      expect(darkColors.text.primary).toBe('#F0E4D0');
      expect(darkColors.text.secondary).toBe('#B89878');
      expect(darkColors.brand[500]).toBe('#D4943D'); // +10% brightness
    });
  });

  describe('ThemeProvider', () => {
    it('should provide light theme by default', () => {
      const TestComponent = () => {
        const theme = useTheme();
        return <test-testid value={theme.colors.bg.base} />;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const component = screen.getByTestId('test');
      expect(component.props.value).toBe('#FDFAF5'); // light bg-base
    });

    it('should provide dark theme when colorScheme is dark', () => {
      // Mock dark mode
      jest.doMock('react-native/Libraries/Utilities/useColorScheme', () => ({
        default: () => 'dark',
      }));

      const TestComponent = () => {
        const theme = useTheme();
        return <test-testid value={theme.colors.bg.base} />;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const component = screen.getByTestId('test');
      expect(component.props.value).toBe('#1A1208'); // dark bg-base
    });

    it('should toggle theme on colorScheme change', () => {
      let colorScheme = 'light';
      const mockUseColorScheme = () => colorScheme;

      jest.doMock('react-native/Libraries/Utilities/useColorScheme', () => ({
        default: mockUseColorScheme,
      }));

      const TestComponent = () => {
        const theme = useTheme();
        return <test-testid value={theme.mode} />;
      };

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Initial: light
      let component = screen.getByTestId('test');
      expect(component.props.value).toBe('light');

      // Simulate colorScheme change
      colorScheme = 'dark';
      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      component = screen.getByTestId('test');
      expect(component.props.value).toBe('dark');
    });
  });

  describe('useTheme hook', () => {
    it('should return current theme colors', () => {
      const TestComponent = () => {
        const theme = useTheme();
        return (
          <>
            <test-testid bg={theme.colors.bg.base} text={theme.colors.text.primary} />
          </>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const component = screen.getByTestId('test');
      expect(component.props.bg).toBe('#FDFAF5');
      expect(component.props.text).toBe('#2D1F0E');
    });

    it('should return all extended tokens', () => {
      const TestComponent = () => {
        const theme = useTheme();
        return <test-testid spacing={theme.spacing[4]} radius={theme.radius.md} />;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const component = screen.getByTestId('test');
      expect(component.props.spacing).toBe(16);
      expect(component.props.radius).toBe(10);
    });
  });
});
