import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/ui/navigation';

export default function App() {
  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
