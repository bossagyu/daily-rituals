import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const EMPTY_MESSAGE = '習慣を追加しましょう';
const EMPTY_HINT = '「+」ボタンから新しい習慣を作成できます';

export const EmptyHabitList: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{EMPTY_MESSAGE}</Text>
      <Text style={styles.hint}>{EMPTY_HINT}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
