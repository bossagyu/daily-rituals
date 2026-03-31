/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  it('renders app name', () => {
    render(<AppHeader />);
    expect(screen.getByText('Daily Rituals')).toBeInTheDocument();
  });

  it('does not render logout button', () => {
    render(<AppHeader />);
    expect(screen.queryByRole('button', { name: /ログアウト/ })).not.toBeInTheDocument();
  });

  it('does not render user name', () => {
    render(<AppHeader />);
    expect(screen.queryByText(/kouhei/)).not.toBeInTheDocument();
  });
});
