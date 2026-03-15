import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit } from '../../domain/models';
import { formatFrequency } from '../../domain/services/frequencyDisplayService';

const COLOR_INDICATOR_SIZE = 12;
const ARCHIVED_OPACITY = 0.5;
const ACTIVE_OPACITY = 1.0;

type HabitListItemProps = {
  readonly habit: Habit;
  readonly onPress: (habitId: string) => void;
};

export const HabitListItem: React.FC<HabitListItemProps> = ({
  habit,
  onPress,
}) => {
  const isArchived = habit.archivedAt !== null;
  const containerOpacity = isArchived ? ARCHIVED_OPACITY : ACTIVE_OPACITY;

  const handlePress = () => {
    onPress(habit.id);
  };

  return (
    <Pressable
      style={[styles.container, { opacity: containerOpacity }]}
      onPress={handlePress}
      testID={`habit-item-${habit.id}`}
    >
      <View
        style={[styles.colorIndicator, { backgroundColor: habit.color }]}
      />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={styles.frequency}>
          {formatFrequency(habit.frequency)}
        </Text>
      </View>
      {isArchived && (
        <Text style={styles.archivedBadge}>アーカイブ済み</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  colorIndicator: {
    width: COLOR_INDICATOR_SIZE,
    height: COLOR_INDICATOR_SIZE,
    borderRadius: COLOR_INDICATOR_SIZE / 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  frequency: {
    fontSize: 13,
    color: '#888',
  },
  archivedBadge: {
    fontSize: 11,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
