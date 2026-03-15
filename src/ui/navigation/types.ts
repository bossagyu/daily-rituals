import type { NavigatorScreenParams } from '@react-navigation/native';

export type HabitsStackParamList = {
  readonly HabitList: undefined;
  readonly HabitForm: { readonly habitId?: string } | undefined;
};

export type RootTabParamList = {
  readonly Today: undefined;
  readonly Habits: NavigatorScreenParams<HabitsStackParamList>;
};
