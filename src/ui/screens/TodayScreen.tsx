import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const TodayScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
});
