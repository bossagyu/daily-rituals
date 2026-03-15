/**
 * HabitFormScreen - Form for creating and editing habits.
 *
 * Supports:
 * - Habit name input
 * - Frequency type selection (daily / weekly_days / weekly_count)
 * - Day selection for weekly_days
 * - Count input for weekly_count
 * - Color selection from presets
 * - Save and archive actions
 * - Zod validation with error messages
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HabitsStackParamList } from '../navigation/types';
import type { HabitFormState, FrequencyType } from '../../domain/models';
import {
  validateHabitForm,
  toCreateHabitInput,
  habitToFormState,
  INITIAL_FORM_STATE,
  PRESET_COLORS,
  FREQUENCY_TYPES,
  FREQUENCY_TYPE_LABELS,
  DAY_LABELS,
} from '../../domain/models';
import type { HabitRepository } from '../../data/repositories';
import { useHabits } from '../../hooks/useHabits';

// --- Constants ---

const BACKGROUND_COLOR = '#F5F5F5';
const CARD_BACKGROUND = '#FFFFFF';
const PRIMARY_COLOR = '#4CAF50';
const DANGER_COLOR = '#F44336';
const ERROR_COLOR = '#D32F2F';
const BORDER_COLOR = '#E0E0E0';
const LABEL_COLOR = '#333333';
const PLACEHOLDER_COLOR = '#999999';
const INACTIVE_TEXT_COLOR = '#666666';
const WHITE = '#FFFFFF';

const BORDER_RADIUS = 8;
const COLOR_SWATCH_SIZE = 40;
const DAY_BUTTON_SIZE = 40;

// --- Types ---

type Props = NativeStackScreenProps<HabitsStackParamList, 'HabitForm'> & {
  readonly repository: HabitRepository;
};

// --- Sub-components ---

type FrequencyTypeSelectorProps = {
  readonly selectedType: FrequencyType;
  readonly onSelect: (type: FrequencyType) => void;
};

const FrequencyTypeSelector: React.FC<FrequencyTypeSelectorProps> = ({
  selectedType,
  onSelect,
}) => (
  <View style={styles.frequencyTypeContainer}>
    {FREQUENCY_TYPES.map((type) => {
      const isSelected = type === selectedType;
      return (
        <TouchableOpacity
          key={type}
          style={[
            styles.frequencyTypeButton,
            isSelected && styles.frequencyTypeButtonActive,
          ]}
          onPress={() => onSelect(type)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          testID={`frequency-type-${type}`}
        >
          <Text
            style={[
              styles.frequencyTypeText,
              isSelected && styles.frequencyTypeTextActive,
            ]}
          >
            {FREQUENCY_TYPE_LABELS[type]}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

type DaySelectorProps = {
  readonly selectedDays: readonly number[];
  readonly onToggle: (day: number) => void;
  readonly error?: string;
};

const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDays,
  onToggle,
  error,
}) => (
  <View style={styles.section}>
    <Text style={styles.label}>曜日を選択</Text>
    <View style={styles.dayContainer}>
      {DAY_LABELS.map((label, index) => {
        const isSelected = selectedDays.includes(index);
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayButton,
              isSelected && styles.dayButtonActive,
            ]}
            onPress={() => onToggle(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            testID={`day-${index}`}
          >
            <Text
              style={[
                styles.dayText,
                isSelected && styles.dayTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

type ColorSelectorProps = {
  readonly selectedColor: string;
  readonly onSelect: (color: string) => void;
};

const ColorSelector: React.FC<ColorSelectorProps> = ({
  selectedColor,
  onSelect,
}) => (
  <View style={styles.section}>
    <Text style={styles.label}>色</Text>
    <View style={styles.colorContainer}>
      {PRESET_COLORS.map((color) => {
        const isSelected = color === selectedColor;
        return (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              isSelected && styles.colorSwatchSelected,
            ]}
            onPress={() => onSelect(color)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            testID={`color-${color}`}
          />
        );
      })}
    </View>
  </View>
);

// --- Main component ---

export const HabitFormScreen: React.FC<Props> = ({ route, navigation, repository }) => {
  const habitId = route.params?.habitId;
  const isEditing = habitId !== undefined;

  const { habits, createHabit, updateHabit, archiveHabit, isLoading } =
    useHabits(repository);

  const [formState, setFormState] = useState<HabitFormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [isInitialized, setIsInitialized] = useState(!isEditing);

  // Load existing habit data when editing
  useEffect(() => {
    if (isEditing && habits.length > 0 && !isInitialized) {
      const existingHabit = habits.find((h) => h.id === habitId);
      if (existingHabit) {
        setFormState(habitToFormState(existingHabit));
        setIsInitialized(true);
      }
    }
  }, [isEditing, habitId, habits, isInitialized]);

  const updateField = useCallback(
    <K extends keyof HabitFormState>(field: K, value: HabitFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      setErrors((prev) => {
        if (field in prev) {
          const { [field]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    },
    []
  );

  const handleFrequencyTypeChange = useCallback(
    (type: FrequencyType) => {
      updateField('frequencyType', type);
    },
    [updateField]
  );

  const handleDayToggle = useCallback(
    (day: number) => {
      setFormState((prev) => {
        const days = prev.weeklyDays.includes(day)
          ? prev.weeklyDays.filter((d) => d !== day)
          : [...prev.weeklyDays, day];
        return { ...prev, weeklyDays: days };
      });
      setErrors((prev) => {
        if ('weeklyDays' in prev) {
          const { weeklyDays: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    },
    []
  );

  const handleWeeklyCountChange = useCallback(
    (text: string) => {
      const count = parseInt(text, 10);
      if (!isNaN(count)) {
        updateField('weeklyCount', count);
      } else if (text === '') {
        updateField('weeklyCount', 0);
      }
    },
    [updateField]
  );

  const handleSave = useCallback(async () => {
    const validation = validateHabitForm(formState);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const input = toCreateHabitInput(formState);

    try {
      if (isEditing && habitId) {
        await updateHabit(habitId, input);
      } else {
        await createHabit(input);
      }
      navigation.goBack();
    } catch {
      Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
    }
  }, [formState, isEditing, habitId, createHabit, updateHabit, navigation]);

  const handleArchive = useCallback(async () => {
    if (!habitId) return;

    Alert.alert(
      'アーカイブ',
      'この習慣をアーカイブしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'アーカイブ',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveHabit(habitId);
              navigation.goBack();
            } catch {
              Alert.alert('エラー', 'アーカイブに失敗しました。');
            }
          },
        },
      ]
    );
  }, [habitId, archiveHabit, navigation]);

  if (isEditing && !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Habit name */}
      <View style={styles.section}>
        <Text style={styles.label}>習慣名</Text>
        <TextInput
          style={[styles.textInput, errors['name'] && styles.textInputError]}
          value={formState.name}
          onChangeText={(text) => updateField('name', text)}
          placeholder="例: 読書、運動、瞑想"
          placeholderTextColor={PLACEHOLDER_COLOR}
          maxLength={100}
          testID="habit-name-input"
        />
        {errors['name'] ? (
          <Text style={styles.errorText}>{errors['name']}</Text>
        ) : null}
      </View>

      {/* Frequency type */}
      <View style={styles.section}>
        <Text style={styles.label}>頻度</Text>
        <FrequencyTypeSelector
          selectedType={formState.frequencyType}
          onSelect={handleFrequencyTypeChange}
        />
      </View>

      {/* Weekly days selector */}
      {formState.frequencyType === 'weekly_days' && (
        <DaySelector
          selectedDays={formState.weeklyDays}
          onToggle={handleDayToggle}
          error={errors['weeklyDays']}
        />
      )}

      {/* Weekly count input */}
      {formState.frequencyType === 'weekly_count' && (
        <View style={styles.section}>
          <Text style={styles.label}>週の回数</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.countInput,
              errors['weeklyCount'] && styles.textInputError,
            ]}
            value={formState.weeklyCount > 0 ? String(formState.weeklyCount) : ''}
            onChangeText={handleWeeklyCountChange}
            keyboardType="number-pad"
            maxLength={1}
            testID="weekly-count-input"
          />
          {errors['weeklyCount'] ? (
            <Text style={styles.errorText}>{errors['weeklyCount']}</Text>
          ) : null}
        </View>
      )}

      {/* Color selector */}
      <ColorSelector
        selectedColor={formState.color}
        onSelect={(color) => updateField('color', color)}
      />

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
        testID="save-button"
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? '保存中...' : '保存'}
        </Text>
      </TouchableOpacity>

      {/* Archive button (edit mode only) */}
      {isEditing && (
        <TouchableOpacity
          style={styles.archiveButton}
          onPress={handleArchive}
          disabled={isLoading}
          testID="archive-button"
        >
          <Text style={styles.archiveButtonText}>アーカイブ</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: LABEL_COLOR,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: LABEL_COLOR,
  },
  textInputError: {
    borderColor: ERROR_COLOR,
  },
  countInput: {
    width: 60,
    textAlign: 'center',
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 12,
    marginTop: 4,
  },
  frequencyTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: CARD_BACKGROUND,
    alignItems: 'center',
  },
  frequencyTypeButtonActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  frequencyTypeText: {
    fontSize: 13,
    color: INACTIVE_TEXT_COLOR,
    fontWeight: '500',
  },
  frequencyTypeTextActive: {
    color: WHITE,
    fontWeight: '600',
  },
  dayContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    width: DAY_BUTTON_SIZE,
    height: DAY_BUTTON_SIZE,
    borderRadius: DAY_BUTTON_SIZE / 2,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: CARD_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  dayText: {
    fontSize: 13,
    color: INACTIVE_TEXT_COLOR,
    fontWeight: '500',
  },
  dayTextActive: {
    color: WHITE,
    fontWeight: '600',
  },
  colorContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: COLOR_SWATCH_SIZE,
    height: COLOR_SWATCH_SIZE,
    borderRadius: COLOR_SWATCH_SIZE / 2,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: LABEL_COLOR,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: BORDER_RADIUS,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  archiveButton: {
    borderRadius: BORDER_RADIUS,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: DANGER_COLOR,
  },
  archiveButtonText: {
    color: DANGER_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
});
