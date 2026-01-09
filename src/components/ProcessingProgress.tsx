import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModelStatus } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProcessingProgressProps {
  status: ModelStatus;
  progress: number;
  estimatedTime?: number;
}

const STATUS_CONFIG: Record<
  ModelStatus,
  { label: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: {
    label: 'Preparing',
    description: 'Initializing processing pipeline...',
    icon: 'hourglass-outline',
  },
  processing: {
    label: 'Processing',
    description: 'Analyzing your photo...',
    icon: 'analytics-outline',
  },
  extracting_face: {
    label: 'Extracting Face',
    description: 'Detecting facial features and landmarks...',
    icon: 'scan-outline',
  },
  generating_mesh: {
    label: 'Generating Mesh',
    description: 'Creating 3D geometry from facial data...',
    icon: 'cube-outline',
  },
  applying_texture: {
    label: 'Applying Texture',
    description: 'Mapping your face onto the 3D model...',
    icon: 'color-palette-outline',
  },
  optimizing: {
    label: 'Optimizing',
    description: 'Refining model for maximum face preservation...',
    icon: 'sparkles-outline',
  },
  completed: {
    label: 'Completed',
    description: 'Your 3D model is ready!',
    icon: 'checkmark-circle-outline',
  },
  failed: {
    label: 'Failed',
    description: 'An error occurred during processing.',
    icon: 'alert-circle-outline',
  },
};

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  status,
  progress,
  estimatedTime,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const config = STATUS_CONFIG[status];

  // Pulse animation for active states
  useEffect(() => {
    if (status !== 'completed' && status !== 'failed') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status, pulseAnim]);

  // Progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s remaining`;
  };

  return (
    <View style={styles.container}>
      {/* Main Icon */}
      <Animated.View
        style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}
      >
        <View style={styles.iconCircle}>
          <Ionicons
            name={config.icon}
            size={48}
            color={status === 'failed' ? '#e74c3c' : '#6c5ce7'}
          />
        </View>

        {/* Orbiting dots */}
        {status !== 'completed' && status !== 'failed' && (
          <>
            <Animated.View style={[styles.orbitDot, styles.orbitDot1]} />
            <Animated.View style={[styles.orbitDot, styles.orbitDot2]} />
            <Animated.View style={[styles.orbitDot, styles.orbitDot3]} />
          </>
        )}
      </Animated.View>

      {/* Status Info */}
      <Text style={styles.statusLabel}>{config.label}</Text>
      <Text style={styles.statusDescription}>{config.description}</Text>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {/* Estimated Time */}
      {estimatedTime && status !== 'completed' && status !== 'failed' && (
        <Text style={styles.estimatedTime}>{formatTime(estimatedTime)}</Text>
      )}

      {/* Stage Indicators */}
      <View style={styles.stagesContainer}>
        {Object.entries(STATUS_CONFIG)
          .filter(([key]) => !['completed', 'failed'].includes(key))
          .map(([key, value], index) => {
            const stageKeys = Object.keys(STATUS_CONFIG).filter(
              (k) => !['completed', 'failed'].includes(k)
            );
            const currentIndex = stageKeys.indexOf(status);
            const stageIndex = stageKeys.indexOf(key);
            const isCompleted = stageIndex < currentIndex;
            const isCurrent = key === status;

            return (
              <View key={key} style={styles.stageItem}>
                <View
                  style={[
                    styles.stageDot,
                    isCompleted && styles.stageCompleted,
                    isCurrent && styles.stageCurrent,
                  ]}
                >
                  {isCompleted && (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  )}
                </View>
                {index < 5 && (
                  <View
                    style={[
                      styles.stageLine,
                      isCompleted && styles.stageLineCompleted,
                    ]}
                  />
                )}
              </View>
            );
          })}
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Ionicons name="information-circle-outline" size={16} color="#888" />
        <Text style={styles.tipText}>
          {status === 'extracting_face'
            ? 'Detecting 468 facial landmarks for accurate reconstruction'
            : status === 'generating_mesh'
              ? 'Creating detailed 3D geometry optimized for your features'
              : status === 'applying_texture'
                ? 'Preserving your exact facial features and skin texture'
                : 'Processing typically takes 30-60 seconds'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  orbitDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c5ce7',
  },
  orbitDot1: {
    top: 0,
    left: '50%',
    marginLeft: -4,
  },
  orbitDot2: {
    bottom: 10,
    left: 10,
  },
  orbitDot3: {
    bottom: 10,
    right: 10,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusDescription: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6c5ce7',
    borderRadius: 4,
  },
  progressText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  estimatedTime: {
    color: '#888',
    fontSize: 13,
    marginBottom: 30,
  },
  stagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCompleted: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  stageCurrent: {
    borderColor: '#6c5ce7',
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
  },
  stageLine: {
    width: 30,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
  },
  stageLineCompleted: {
    backgroundColor: '#6c5ce7',
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    maxWidth: SCREEN_WIDTH - 40,
  },
  tipText: {
    color: '#888',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
});

export default ProcessingProgress;
