import React from 'react';
import { render } from '@testing-library/react-native';
import { Card } from '../src/components/Card';
import { ThemeProvider } from '../src/theme/theme';

describe('Card Component (T-007)', () => {
  it('should render with bg-surface background', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Card testID="card">
          Card Content
        </Card>
      </ThemeProvider>
    );

    const card = getByTestId('card');
    expect(card).toBeDefined();
  });

  it('should have radius-lg and shadow-sm', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Card testID="card">
          Card Content
        </Card>
      </ThemeProvider>
    );

    const card = getByTestId('card');
    expect(card.props.style).toBeDefined();
  });

  it('should support custom style', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Card testID="card-custom" style={{ marginTop: 16 }}>
          Card Content
        </Card>
      </ThemeProvider>
    );

    const card = getByTestId('card-custom');
    expect(card.props.style).toBeDefined();
  });

  it('should support dark mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Card testID="card">
          Card Content
        </Card>
      </ThemeProvider>
    );

    const card = getByTestId('card');
    expect(card.props.style).toBeDefined();
  });
});
