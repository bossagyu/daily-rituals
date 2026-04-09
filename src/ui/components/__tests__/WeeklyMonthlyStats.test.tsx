/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WeeklyMonthlyStats } from '../WeeklyMonthlyStats';

describe('WeeklyMonthlyStats', () => {
  it('renders weekly and monthly section labels', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 5, targetCount: 10, rate: 0.5 }}
        monthly={{ completedCount: 20, targetCount: 25, rate: 0.8 }}
      />,
    );
    expect(screen.getByText('今週')).toBeInTheDocument();
    expect(screen.getByText('今月')).toBeInTheDocument();
  });

  it('displays weekly completion ratio and percentage', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 5, targetCount: 10, rate: 0.5 }}
        monthly={{ completedCount: 20, targetCount: 25, rate: 0.8 }}
      />,
    );
    const weeklySection = screen.getByTestId('stats-weekly');
    expect(within(weeklySection).getByText('5 / 10')).toBeInTheDocument();
    expect(within(weeklySection).getByText('50%')).toBeInTheDocument();
  });

  it('displays monthly completion ratio and percentage', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 5, targetCount: 10, rate: 0.5 }}
        monthly={{ completedCount: 20, targetCount: 25, rate: 0.8 }}
      />,
    );
    const monthlySection = screen.getByTestId('stats-monthly');
    expect(within(monthlySection).getByText('20 / 25')).toBeInTheDocument();
    expect(within(monthlySection).getByText('80%')).toBeInTheDocument();
  });

  it('rounds the percentage to the nearest integer', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 1, targetCount: 3, rate: 1 / 3 }}
        monthly={{ completedCount: 2, targetCount: 3, rate: 2 / 3 }}
      />,
    );
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('shows 0% and 0 / 0 when no targets exist', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 0, targetCount: 0, rate: 0 }}
        monthly={{ completedCount: 0, targetCount: 0, rate: 0 }}
      />,
    );
    const weeklySection = screen.getByTestId('stats-weekly');
    const monthlySection = screen.getByTestId('stats-monthly');
    expect(within(weeklySection).getByText('0 / 0')).toBeInTheDocument();
    expect(within(weeklySection).getByText('0%')).toBeInTheDocument();
    expect(within(monthlySection).getByText('0 / 0')).toBeInTheDocument();
    expect(within(monthlySection).getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% when fully complete', () => {
    render(
      <WeeklyMonthlyStats
        weekly={{ completedCount: 7, targetCount: 7, rate: 1 }}
        monthly={{ completedCount: 30, targetCount: 30, rate: 1 }}
      />,
    );
    expect(screen.getAllByText('100%')).toHaveLength(2);
  });
});
