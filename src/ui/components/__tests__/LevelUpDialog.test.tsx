/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LevelUpDialog } from '../LevelUpDialog';

describe('LevelUpDialog', () => {
  it('does not render anything when open is false', () => {
    const { container } = render(
      <LevelUpDialog
        open={false}
        previousLevel={3}
        newLevel={4}
        rewardDescription={null}
        onClose={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and level transition when open', () => {
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={4}
        rewardDescription={null}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('レベルアップ！')).toBeInTheDocument();
    expect(screen.getByText(/Lv\.3/)).toBeInTheDocument();
    expect(screen.getByText(/Lv\.4/)).toBeInTheDocument();
  });

  it('shows reward description when provided', () => {
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={4}
        rewardDescription="Watch a movie"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/ご褒美/)).toBeInTheDocument();
    expect(screen.getByText('Watch a movie')).toBeInTheDocument();
  });

  it('does not show reward section when rewardDescription is null', () => {
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={4}
        rewardDescription={null}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/ご褒美/)).not.toBeInTheDocument();
  });

  it('shows multi-level transition (e.g. 3 → 5)', () => {
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={5}
        rewardDescription={null}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Lv\.3/)).toBeInTheDocument();
    expect(screen.getByText(/Lv\.5/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={4}
        rewardDescription={null}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses role="dialog" for accessibility', () => {
    render(
      <LevelUpDialog
        open
        previousLevel={3}
        newLevel={4}
        rewardDescription={null}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
