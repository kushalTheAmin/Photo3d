import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Text,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Photo, FaceDetectionResult } from '../types';
import { faceDetectionService } from '../services/faceDetection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoPreviewProps {
  photo: Photo;
  faceDetection?: FaceDetectionResult;
  onConfirm: () => void;
  onRetake: () => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  photo,
  faceDetection,
  onConfirm,
  onRetake,
  onBack,
  isProcessing = false,
}) => {
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } | null>(null);

  useEffect(() => {
    if (faceDetection) {
      const score = faceDetectionService.calculateFaceQualityScore(faceDetection);
      setQualityScore(score);

      const validationResult =
        faceDetectionService.validateFaceForProcessing(faceDetection);
      setValidation(validationResult);
    }
  }, [faceDetection]);

  const getQualityColor = (score: number) => {
    if (score >= 80) return '#27ae60';
    if (score >= 60) return '#f39c12';
    return '#e74c3c';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Photo Preview */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: photo.uri }} style={styles.image} />

        {/* Face Detection Overlay */}
        {faceDetection?.detected && faceDetection.boundingBox && (
          <View
            style={[
              styles.faceBox,
              {
                left: faceDetection.boundingBox.x,
                top: faceDetection.boundingBox.y,
                width: faceDetection.boundingBox.width,
                height: faceDetection.boundingBox.height,
              },
            ]}
          />
        )}

        {/* Face Detection Badge */}
        <View style={styles.detectionBadge}>
          {faceDetection?.detected ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
              <Text style={styles.detectionText}>Face Detected</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={16} color="#e74c3c" />
              <Text style={[styles.detectionText, { color: '#e74c3c' }]}>
                No Face Detected
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Quality Assessment */}
      <View style={styles.qualityContainer}>
        <Text style={styles.sectionTitle}>Photo Quality</Text>

        {qualityScore !== null && (
          <View style={styles.qualityScore}>
            <View style={styles.scoreCircle}>
              <Text
                style={[
                  styles.scoreValue,
                  { color: getQualityColor(qualityScore) },
                ]}
              >
                {qualityScore}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text
                style={[
                  styles.scoreLabel,
                  { color: getQualityColor(qualityScore) },
                ]}
              >
                {getQualityLabel(qualityScore)}
              </Text>
              <Text style={styles.scoreDescription}>
                {qualityScore >= 60
                  ? 'Ready for 3D model generation'
                  : 'Consider retaking for better results'}
              </Text>
            </View>
          </View>
        )}

        {/* Quality Progress Bar */}
        {qualityScore !== null && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${qualityScore}%`,
                  backgroundColor: getQualityColor(qualityScore),
                },
              ]}
            />
          </View>
        )}

        {/* Validation Issues */}
        {validation && !validation.isValid && (
          <View style={styles.issuesContainer}>
            {validation.issues.map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <Ionicons name="warning" size={14} color="#f39c12" />
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {validation && validation.recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Tips for better results:</Text>
            {validation.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Ionicons name="bulb-outline" size={14} color="#6c5ce7" />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={onRetake}
          disabled={isProcessing}
        >
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.retakeText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!faceDetection?.detected || isProcessing) && styles.disabledButton,
          ]}
          onPress={onConfirm}
          disabled={!faceDetection?.detected || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="cube-outline" size={20} color="#fff" />
              <Text style={styles.confirmText}>Generate 3D Model</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  imageContainer: {
    alignSelf: 'center',
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#16162a',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  faceBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#27ae60',
    borderRadius: 8,
  },
  detectionBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  detectionText: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: '500',
  },
  qualityContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  qualityScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  scoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreMax: {
    color: '#888',
    fontSize: 11,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreDescription: {
    color: '#888',
    fontSize: 13,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  issuesContainer: {
    marginBottom: 12,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  issueText: {
    color: '#f39c12',
    fontSize: 13,
  },
  recommendationsContainer: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  recommendationsTitle: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  retakeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.4)',
  },
});

export default PhotoPreview;
