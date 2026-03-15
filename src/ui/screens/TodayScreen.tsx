/**
 * TodayScreen - Home screen showing today's habits with completion toggles.
 *
 * Displays habits due today (filtered by FrequencyService),
 * allows toggling completion state, and shows streak/weekly progress.
 */

import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import type { Habit } from '../../domain/models';
import type { WeeklyProgress } from '../../domain/services/frequencyService';
import type { Streak } from '../../domain/models';
import { useHabits } from '../../hooks/useHabits';
import { useCompletions, useStreak } from '../../hooks';
import type { HabitRepository, CompletionRepository } from '../../data/repositories';
import {
  filterTodayHabits,
  formatDateString,
  getCompletionStats,
  formatFrequencyLabel,
} from './todayScreenHelpers';

// --- Constants ---

const COMPLETED_OPACITY = 0.6;
const COLOR_INDICATOR_SIZE = 12;
const COLOR_INDICATOR_BORDER_RADIUS = 6;
const CHECKBOX_SIZE = 28;
const CHECKBOX_BORDER_RADIUS = 14;
const CHECKBOX_BORDER_WIDTH = 2;

// --- Types ---

export type TodayScreenProps = {
  readonly habitRepository: HabitRepository;
  readonly completionRepository: CompletionRepository;
};

type HabitItemProps = {
  readonly habit: Habit;
  readonly completed: boolean;
  readonly streak: Streak;
  readonly weeklyProgress: WeeklyProgress | null;
  readonly onToggle: () => void;
};

// --- Sub-components ---

const HabitItem: React.FC<HabitItemProps> = React.memo(
  ({ habit, completed, streak, weeklyProgress, onToggle }) => {
    return (
      <Pressable
        style={[styles.habitItem, completed && styles.habitItemCompleted]}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={`${habit.name}${completed ? ' 完了' : ''}`}
      >
        <View style={styles.habitLeft}>
          <View
            style={[
              styles.checkbox,
              completed && { backgroundColor: habit.color, borderColor: habit.color },
              !completed && { borderColor: habit.color },
            ]}
          >
            {completed && <Text style={styles.checkIcon}>{'\u2713'}</Text>}
          </View>
          <View style={styles.habitInfo}>
            <Text
              style={[styles.habitName, completed && styles.habitNameCompleted]}
              numberOfLines={1}
            >
              {habit.name}
            </Text>
            <View style={styles.habitMeta}>
              <View
                style={[styles.colorIndicator, { backgroundColor: habit.color }]}
              />
              <Text style={styles.frequencyLabel}>
                {formatFrequencyLabel(habit)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.habitRight}>
          {weeklyProgress !== null && (
            <Text style={styles.weeklyProgress}>
              今週 {weeklyProgress.done}/{weeklyProgress.target}
            </Text>
          )}
          {streak.current > 0 && (
            <Text style={styles.streakText}>
              {'\u{1F525}'} {streak.current}
            </Text>
          )}
        </View>
      </Pressable>
    );
  },
);

HabitItem.displayName = 'HabitItem';

const EmptyState: React.FC = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyTitle}>今日の習慣はありません</Text>
    <Text style={styles.emptySubtitle}>
      習慣タブから新しい習慣を追加してみましょう
    </Text>
  </View>
);

const AllCompletedBanner: React.FC = () => (
  <View style={styles.allCompletedBanner}>
    <Text style={styles.allCompletedText}>
      今日の習慣をすべて達成しました！
    </Text>
  </View>
);

const ErrorMessage: React.FC<{ readonly message: string }> = ({ message }) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorText}>エラーが発生しました: {message}</Text>
  </View>
);

const LoadingIndicator: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" />
    <Text style={styles.loadingText}>読み込み中...</Text>
  </View>
);

// --- Main component ---

export const TodayScreen: React.FC<TodayScreenProps> = ({
  habitRepository,
  completionRepository,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayString = useMemo(() => formatDateString(today), [today]);

  const {
    habits,
    isLoading: habitsLoading,
    error: habitsError,
  } = useHabits(habitRepository);

  const {
    loading: completionsLoading,
    error: completionsError,
    isCompleted,
    toggleCompletion,
  } = useCompletions(completionRepository, todayString);

  const todayHabits = useMemo(
    () => filterTodayHabits(habits, today),
    [habits, today],
  );

  const {
    getStreak,
    getWeeklyProgress,
    refreshStreak,
  } = useStreak(completionRepository, todayHabits, todayString);

  const stats = useMemo(
    () => getCompletionStats(todayHabits, isCompleted, todayString),
    [todayHabits, isCompleted, todayString],
  );

  const handleToggle = useCallback(
    async (habitId: string): Promise<void> => {
      await toggleCompletion(habitId, todayString);
      await refreshStreak(habitId);
    },
    [toggleCompletion, todayString, refreshStreak],
  );

  const isLoading = habitsLoading || completionsLoading;
  const error = habitsError ?? completionsError;

  if (isLoading && todayHabits.length === 0) {
    return <LoadingIndicator />;
  }

  if (error !== null) {
    return <ErrorMessage message={error} />;
  }

  const renderItem = ({ item }: { readonly item: Habit }): React.ReactElement => {
    const completed = isCompleted(item.id, todayString);
    const streak = getStreak(item.id);
    const weeklyProgress =
      item.frequency.type === 'weekly_count'
        ? getWeeklyProgress(item.id)
        : null;

    return (
      <HabitItem
        habit={item}
        completed={completed}
        streak={streak}
        weeklyProgress={weeklyProgress}
        onToggle={() => handleToggle(item.id)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>今日の習慣</Text>
        {todayHabits.length > 0 && (
          <Text style={styles.progressText}>
            {stats.completed}/{stats.total} 完了
          </Text>
        )}
      </View>
      {stats.allCompleted && <AllCompletedBanner />}
      <FlatList
        data={todayHabits}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          todayHabits.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={EmptyState}
      />
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  progressText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  habitItemCompleted: {
    opacity: COMPLETED_OPACITY,
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_BORDER_RADIUS,
    borderWidth: CHECKBOX_BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  habitNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  habitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  colorIndicator: {
    width: COLOR_INDICATOR_SIZE,
    height: COLOR_INDICATOR_SIZE,
    borderRadius: COLOR_INDICATOR_BORDER_RADIUS,
    marginRight: 6,
  },
  frequencyLabel: {
    fontSize: 12,
    color: '#888888',
  },
  habitRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  weeklyProgress: {
    fontSize: 12,
    color: '#4A90D9',
    fontWeight: '600',
    marginBottom: 2,
  },
  streakText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  allCompletedBanner: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  allCompletedText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888888',
    marginTop: 12,
  },
});
