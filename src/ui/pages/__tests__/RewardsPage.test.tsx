/**
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { RewardsPage } from '../RewardsPage';
import { DuplicateRewardLevelError } from '@/data/repositories/rewardRepository';
import type { Reward } from '@/domain/models';

// --- Mock repository ---

const mockFindAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/hooks/useRepositories', () => ({
  useRepositories: () => ({
    rewardRepository: {
      findAll: mockFindAll,
      create: mockCreate,
      update: mockUpdate,
      remove: mockRemove,
    },
  }),
}));

const sampleRewards: Reward[] = [
  {
    id: 'r1',
    userId: 'u1',
    level: 5,
    description: 'Watch a movie',
    createdAt: '2026-04-08T10:00:00Z',
    updatedAt: '2026-04-08T10:00:00Z',
  },
  {
    id: 'r2',
    userId: 'u1',
    level: 10,
    description: 'Buy a new book',
    createdAt: '2026-04-08T11:00:00Z',
    updatedAt: '2026-04-08T11:00:00Z',
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <RewardsPage />
    </MemoryRouter>,
  );

describe('RewardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAll.mockResolvedValue([...sampleRewards]);
  });

  it('renders the page title and back-to-calendar link', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'ご褒美' })).toBeInTheDocument();
    const backLink = screen.getByRole('link', { name: /カレンダーに戻る/ });
    expect(backLink).toHaveAttribute('href', '/calendar');
    await waitFor(() => expect(mockFindAll).toHaveBeenCalled());
  });

  it('displays existing rewards in ascending level order', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Watch a movie')).toBeInTheDocument();
      expect(screen.getByText('Buy a new book')).toBeInTheDocument();
    });
    const items = screen.getAllByTestId('reward-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText(/Lv\.5/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Lv\.10/)).toBeInTheDocument();
  });

  it('shows empty state when no rewards exist', async () => {
    mockFindAll.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/まだご褒美がありません/)).toBeInTheDocument();
    });
  });

  it('creates a new reward via the add form', async () => {
    const newReward: Reward = {
      id: 'r3',
      userId: 'u1',
      level: 15,
      description: 'Special dinner',
      createdAt: '2026-04-08T12:00:00Z',
      updatedAt: '2026-04-08T12:00:00Z',
    };
    mockCreate.mockResolvedValueOnce(newReward);

    renderPage();
    await waitFor(() => expect(mockFindAll).toHaveBeenCalled());

    const levelInput = screen.getByLabelText(/レベル/);
    const descInput = screen.getByLabelText(/ご褒美/);
    const submitBtn = screen.getByRole('button', { name: '追加' });

    fireEvent.change(levelInput, { target: { value: '15' } });
    fireEvent.change(descInput, { target: { value: 'Special dinner' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        level: 15,
        description: 'Special dinner',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Special dinner')).toBeInTheDocument();
    });
  });

  it('trims whitespace from description before submit', async () => {
    mockCreate.mockResolvedValueOnce({
      id: 'r4',
      userId: 'u1',
      level: 20,
      description: 'Trim me',
      createdAt: '2026-04-08T12:00:00Z',
      updatedAt: '2026-04-08T12:00:00Z',
    });

    renderPage();
    await waitFor(() => expect(mockFindAll).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/レベル/), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/ご褒美/), {
      target: { value: '  Trim me   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        level: 20,
        description: 'Trim me',
      });
    });
  });

  it('shows validation error when description is empty', async () => {
    renderPage();
    await waitFor(() => expect(mockFindAll).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/レベル/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/ご褒美/), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(screen.getByText(/ご褒美の内容を入力してください/)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows validation error when level is less than 1', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Watch a movie')).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/レベル/), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/ご褒美/), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(screen.getByText(/レベルは1以上/)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows duplicate level error', async () => {
    mockCreate.mockRejectedValueOnce(new DuplicateRewardLevelError(5));

    renderPage();
    await waitFor(() => expect(mockFindAll).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/レベル/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/ご褒美/), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    await waitFor(() => {
      expect(screen.getByText(/レベル 5 には既にご褒美が登録されています/)).toBeInTheDocument();
    });
  });

  it('edits a reward description', async () => {
    const updated: Reward = {
      ...sampleRewards[0],
      description: 'Watch two movies',
      updatedAt: '2026-04-08T13:00:00Z',
    };
    mockUpdate.mockResolvedValueOnce(updated);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Watch a movie')).toBeInTheDocument(),
    );

    const items = screen.getAllByTestId('reward-item');
    const editBtn = within(items[0]).getByRole('button', { name: /編集/ });
    fireEvent.click(editBtn);

    const editInput = await waitFor(() =>
      within(items[0]).getByDisplayValue('Watch a movie'),
    );
    fireEvent.change(editInput, { target: { value: 'Watch two movies' } });

    const saveBtn = within(items[0]).getByRole('button', { name: /保存/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('r1', {
        description: 'Watch two movies',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Watch two movies')).toBeInTheDocument();
    });
  });

  it('cancels an edit without calling update', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Watch a movie')).toBeInTheDocument(),
    );

    const items = screen.getAllByTestId('reward-item');
    fireEvent.click(within(items[0]).getByRole('button', { name: /編集/ }));

    const editInput = await waitFor(() =>
      within(items[0]).getByDisplayValue('Watch a movie'),
    );
    fireEvent.change(editInput, { target: { value: 'Should not save' } });
    fireEvent.click(within(items[0]).getByRole('button', { name: /キャンセル/ }));

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Watch a movie')).toBeInTheDocument();
  });

  it('deletes a reward without confirmation', async () => {
    mockRemove.mockResolvedValueOnce(undefined);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Watch a movie')).toBeInTheDocument(),
    );

    const items = screen.getAllByTestId('reward-item');
    fireEvent.click(within(items[0]).getByRole('button', { name: /削除/ }));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('r1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Watch a movie')).not.toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    mockFindAll.mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network error/);
    });
  });
});
