import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { UserPreferences } from '../types';

type OutputFormat = '3d-obj' | 'gltf' | 'glb';
type TextureResolution = 'low' | 'medium' | 'high' | 'ultra';
type PreservationLevel = 'standard' | 'high' | 'maximum';

const OUTPUT_FORMATS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'glb', label: 'GLB', description: 'Binary GLTF, most compatible' },
  { value: 'gltf', label: 'GLTF', description: 'Standard 3D format' },
  { value: '3d-obj', label: 'OBJ', description: 'Legacy format, widely supported' },
];

const TEXTURE_RESOLUTIONS: {
  value: TextureResolution;
  label: string;
  size: string;
}[] = [
  { value: 'low', label: 'Low', size: '512x512' },
  { value: 'medium', label: 'Medium', size: '1024x1024' },
  { value: 'high', label: 'High', size: '2048x2048' },
  { value: 'ultra', label: 'Ultra', size: '4096x4096' },
];

const PRESERVATION_LEVELS: {
  value: PreservationLevel;
  label: string;
  description: string;
}[] = [
  { value: 'standard', label: 'Standard', description: 'Faster processing' },
  { value: 'high', label: 'High', description: 'Better accuracy' },
  { value: 'maximum', label: 'Maximum', description: '100% face fidelity' },
];

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { preferences, updatePreferences } = useAppStore();

  const renderOptionGroup = <T extends string>(
    title: string,
    options: { value: T; label: string; description?: string; size?: string }[],
    currentValue: T,
    onSelect: (value: T) => void
  ) => (
    <View style={styles.optionGroup}>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.optionsList}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              currentValue === option.value && styles.optionItemSelected,
            ]}
            onPress={() => onSelect(option.value)}
          >
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionLabel,
                  currentValue === option.value && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              {option.description && (
                <Text style={styles.optionDescription}>{option.description}</Text>
              )}
              {option.size && (
                <Text style={styles.optionSize}>{option.size}</Text>
              )}
            </View>
            {currentValue === option.value && (
              <Ionicons name="checkmark-circle" size={24} color="#6c5ce7" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Output Format */}
        {renderOptionGroup(
          'Output Format',
          OUTPUT_FORMATS,
          preferences.outputFormat,
          (value) => updatePreferences({ outputFormat: value })
        )}

        {/* Texture Resolution */}
        {renderOptionGroup(
          'Texture Resolution',
          TEXTURE_RESOLUTIONS,
          preferences.textureResolution,
          (value) => updatePreferences({ textureResolution: value })
        )}

        {/* Face Preservation Level */}
        {renderOptionGroup(
          'Face Preservation Level',
          PRESERVATION_LEVELS,
          preferences.preservationLevel,
          (value) => updatePreferences({ preservationLevel: value })
        )}

        {/* Toggle Settings */}
        <View style={styles.toggleGroup}>
          <Text style={styles.optionTitle}>Additional Options</Text>

          <View style={styles.toggleItem}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Auto-save to Gallery</Text>
              <Text style={styles.toggleDescription}>
                Automatically save generated models to your device
              </Text>
            </View>
            <Switch
              value={preferences.autoSaveToGallery}
              onValueChange={(value) =>
                updatePreferences({ autoSaveToGallery: value })
              }
              trackColor={{ false: '#333', true: '#6c5ce7' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.toggleItem}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Face Smoothing</Text>
              <Text style={styles.toggleDescription}>
                Apply subtle smoothing to facial textures (may reduce accuracy)
              </Text>
            </View>
            <Switch
              value={preferences.enableFaceSmoothing}
              onValueChange={(value) =>
                updatePreferences({ enableFaceSmoothing: value })
              }
              trackColor={{ false: '#333', true: '#6c5ce7' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#6c5ce7" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>About Face Preservation</Text>
            <Text style={styles.infoText}>
              Photo3D uses advanced AI to analyze 468 facial landmarks, ensuring
              your 3D model maintains 100% accuracy to the original photo. Higher
              preservation levels require more processing time but deliver better
              results.
            </Text>
          </View>
        </View>

        {/* Processing Time Estimate */}
        <View style={styles.estimateCard}>
          <Text style={styles.estimateTitle}>Estimated Processing Time</Text>
          <View style={styles.estimateValues}>
            <View style={styles.estimateItem}>
              <Ionicons name="time-outline" size={20} color="#888" />
              <Text style={styles.estimateText}>
                {preferences.preservationLevel === 'standard'
                  ? '~20 seconds'
                  : preferences.preservationLevel === 'high'
                    ? '~35 seconds'
                    : '~55 seconds'}
              </Text>
            </View>
            <View style={styles.estimateItem}>
              <Ionicons name="cube-outline" size={20} color="#888" />
              <Text style={styles.estimateText}>
                {preferences.textureResolution === 'low'
                  ? '~2 MB'
                  : preferences.textureResolution === 'medium'
                    ? '~5 MB'
                    : preferences.textureResolution === 'high'
                      ? '~12 MB'
                      : '~25 MB'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  optionGroup: {
    marginBottom: 24,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: '#6c5ce7',
  },
  optionDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  optionSize: {
    color: '#6c5ce7',
    fontSize: 11,
    marginTop: 2,
  },
  toggleGroup: {
    marginBottom: 24,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  toggleDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  estimateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
  },
  estimateTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  estimateValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estimateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estimateText: {
    color: '#888',
    fontSize: 14,
  },
});

export default SettingsScreen;
