import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HabitListScreen, HabitFormScreen } from '../screens';
import type { HabitsStackParamList } from './types';

const Stack = createNativeStackNavigator<HabitsStackParamList>();

export const HabitsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HabitList"
        component={HabitListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HabitForm"
        component={HabitFormScreen}
        options={{ title: 'Habit Form' }}
      />
    </Stack.Navigator>
  );
};
