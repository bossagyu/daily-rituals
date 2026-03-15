import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { openDatabaseSync } from 'expo-sqlite';
import { initializeDatabase } from './src/data/database';
import { RepositoryProvider } from './src/data/repositories';
import { RootNavigator } from './src/ui/navigation';

const DATABASE_NAME = 'daily-rituals.db';

const db = openDatabaseSync(DATABASE_NAME);
initializeDatabase(db);

export default function App() {
  return (
    <RepositoryProvider db={db}>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </RepositoryProvider>
  );
}
