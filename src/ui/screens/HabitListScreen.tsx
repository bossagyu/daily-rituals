import React, { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Habit } from '../../domain/models';
import type { HabitRepository } from '../../data/repositories';
import type { HabitsStackParamList } from '../navigation/types';
import { useHabitList } from '../../hooks/useHabitList';
import { HabitListItem } from '../components/HabitListItem';
import { EmptyHabitList } from '../components/EmptyHabitList';

type HabitListScreenProps = {
  readonly navigation: NativeStackNavigationProp<
    HabitsStackParamList,
    'HabitList'
  >;
  readonly repository: HabitRepository;
};

const ADD_BUTTON_SIZE = 56;
const ADD_BUTTON_LABEL = '+';
const SCREEN_TITLE = '習慣';
const SHOW_ARCHIVED_LABEL = 'アーカイブ済みを表示';

export const HabitListScreen: React.FC<HabitListScreenProps> = ({
  navigation,
  repository,
}) => {
  const {
    displayHabits,
    showArchived,
    toggleShowArchived,
    isLoading,
    error,
    refresh,
  } = useHabitList(repository);

  const handleHabitPress = useCallback(
    (habitId: string) => {
      navigation.navigate('HabitForm', { habitId });
    },
    [navigation],
  );

  const handleAddPress = useCallback(() => {
    navigation.navigate('HabitForm', undefined);
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { readonly item: Habit }) => (
      <HabitListItem habit={item} onPress={handleHabitPress} />
    ),
    [handleHabitPress],
  );

  const keyExtractor = useCallback((item: Habit) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{SCREEN_TITLE}</Text>
        <View style={styles.archiveToggle}>
          <Text style={styles.archiveToggleLabel}>{SHOW_ARCHIVED_LABEL}</Text>
          <Switch
            value={showArchived}
            onValueChange={toggleShowArchived}
            testID="archive-toggle"
          />
        </View>
      </View>

      {error !== null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading && displayHabits.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={displayHabits as Habit[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={EmptyHabitList}
          onRefresh={refresh}
          refreshing={isLoading}
          contentContainerStyle={
            displayHabits.length === 0 ? styles.emptyList : undefined
          }
        />
      )}

      <Pressable
        style={styles.addButton}
        onPress={handleAddPress}
        testID="add-habit-button"
      >
        <Text style={styles.addButtonText}>{ADD_BUTTON_LABEL}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archiveToggleLabel: {
    fontSize: 14,
    color: '#666',
  },
  errorBanner: {
    backgroundColor: '#FFE0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#CC0000',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    lineHeight: 32,
  },
});
