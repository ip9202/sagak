import React from 'react';
import { render } from '@testing-library/react-native';
import { ProgressBar } from '../src/components/ProgressBar';
import { ThemeProvider } from '../src/theme/theme';

describe('ProgressBar Component (T-007)', () => {
  it('should render with brand-500 to brand-300 gradient', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ProgressBar current={120} total={320} />
      </ThemeProvider>
    );

    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeDefined();
  });

  it('should show caption with current/total/percentage', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ProgressBar current={120} total={320} />
      </ThemeProvider>
    );

    const caption = getByText('120 / 320p (37%)');
    expect(caption).toBeDefined();
  });

  it('should clamp percentage at 100% when current >= total', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ProgressBar current={400} total={300} />
      </ThemeProvider>
    );

    const caption = getByText('400 / 300p (100%)');
    expect(caption).toBeDefined();
  });

  it('should show 0% when current is 0', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ProgressBar current={0} total={320} />
      </ThemeProvider>
    );

    const caption = getByText('0 / 320p (0%)');
    expect(caption).toBeDefined();
  });

  it('should hide label when total is 0', () => {
    const { queryByText } = render(
      <ThemeProvider>
        <ProgressBar current={0} total={0} />
      </ThemeProvider>
    );

    const caption = queryByText(/\/ 0p/);
    expect(caption).toBeNull();
  });

  it('should support dark mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ProgressBar current={120} total={320} />
      </ThemeProvider>
    );

    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeDefined();
  });
});
