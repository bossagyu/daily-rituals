import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TodayScreen } from '../screens';
import { HabitsStackNavigator } from './HabitsStackNavigator';
import type { RootTabParamList } from './types';

const TAB_ICON_SIZE = 24;

const Tab = createBottomTabNavigator<RootTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, { focused: IoniconsName; default: IoniconsName }> = {
  Today: { focused: 'today', default: 'today-outline' },
  Habits: { focused: 'list', default: 'list-outline' },
};

export const RootNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={TAB_ICON_SIZE} color={color} />;
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Habits" component={HabitsStackNavigator} />
    </Tab.Navigator>
  );
};
