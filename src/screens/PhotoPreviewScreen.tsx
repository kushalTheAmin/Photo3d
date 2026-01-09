import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PhotoPreview } from '../components';
import { apiService } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { RootStackParamList, FaceDetectionResult, Photo } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'PhotoPreview'>;

export const PhotoPreviewScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photo } = route.params;

  const { setLastFaceDetection, setLoading, setError, preferences } = useAppStore();

  const [faceDetection, setFaceDetection] = useState<FaceDetectionResult | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Simulate face detection on mount
  useEffect(() => {
    const detectFace = async () => {
      // Simulate API call for face detection
      // In production, this would call the actual backend
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulated face detection result
      const mockResult: FaceDetectionResult = {
        detected: true,
        confidence: 0.95,
        boundingBox: {
          x: photo.width * 0.25,
          y: photo.height * 0.15,
          width: photo.width * 0.5,
          height: photo.height * 0.6,
        },
        landmarks: {
          leftEye: { x: photo.width * 0.35, y: photo.height * 0.35 },
          rightEye: { x: photo.width * 0.65, y: photo.height * 0.35 },
          nose: { x: photo.width * 0.5, y: photo.height * 0.5 },
          leftMouth: { x: photo.width * 0.4, y: photo.height * 0.65 },
          rightMouth: { x: photo.width * 0.6, y: photo.height * 0.65 },
          jawLine: [],
          faceContour: [],
        },
      };

      setFaceDetection(mockResult);
      setLastFaceDetection(mockResult);
    };

    detectFace();
  }, [photo, setLastFaceDetection]);

  const handleConfirm = useCallback(async () => {
    if (!faceDetection?.detected) return;

    setIsProcessing(true);
    setLoading(true);

    try {
      // Upload photo and start generation
      const uploadResult = await apiService.uploadPhoto(photo.uri);

      if (uploadResult.success && uploadResult.data) {
        const generateResult = await apiService.generateModel(
          uploadResult.data.photoId,
          preferences
        );

        if (generateResult.success && generateResult.data) {
          navigation.navigate('Processing', {
            photoId: uploadResult.data.photoId,
            jobId: generateResult.data.jobId,
          });
        } else {
          // For demo purposes, navigate anyway with mock data
          navigation.navigate('Processing', {
            photoId: `mock_${Date.now()}`,
            jobId: `job_${Date.now()}`,
          });
        }
      } else {
        // For demo purposes, navigate anyway with mock data
        navigation.navigate('Processing', {
          photoId: `mock_${Date.now()}`,
          jobId: `job_${Date.now()}`,
        });
      }
    } catch (error) {
      // For demo purposes, navigate anyway with mock data
      navigation.navigate('Processing', {
        photoId: `mock_${Date.now()}`,
        jobId: `job_${Date.now()}`,
      });
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  }, [faceDetection, photo, preferences, navigation, setLoading]);

  const handleRetake = useCallback(() => {
    navigation.navigate('Camera');
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <PhotoPreview
        photo={photo}
        faceDetection={faceDetection || undefined}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
        onBack={handleBack}
        isProcessing={isProcessing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

export default PhotoPreviewScreen;
