import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ProcessingProgress } from '../components';
import { useAppStore } from '../store/useAppStore';
import { RootStackParamList, ModelStatus, Model3D } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'Processing'>;

const PROCESSING_STAGES: ModelStatus[] = [
  'pending',
  'processing',
  'extracting_face',
  'generating_mesh',
  'applying_texture',
  'optimizing',
  'completed',
];

export const ProcessingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { photoId, jobId } = route.params;

  const { selectedPhoto, addModel, preferences } = useAppStore();

  const [status, setStatus] = useState<ModelStatus>('pending');
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(45);

  // Simulate processing stages
  useEffect(() => {
    let stageIndex = 0;
    let currentProgress = 0;

    const processInterval = setInterval(() => {
      if (stageIndex >= PROCESSING_STAGES.length - 1) {
        clearInterval(processInterval);
        return;
      }

      stageIndex++;
      const newStatus = PROCESSING_STAGES[stageIndex];
      setStatus(newStatus);

      // Calculate progress based on stage
      const progressPerStage = 100 / (PROCESSING_STAGES.length - 1);
      currentProgress = Math.min(progressPerStage * stageIndex, 100);
      setProgress(currentProgress);

      // Update estimated time
      const remainingStages = PROCESSING_STAGES.length - 1 - stageIndex;
      setEstimatedTime(remainingStages * 8);

      // When completed, create the model and navigate
      if (newStatus === 'completed') {
        const newModel: Model3D = {
          id: `model_${Date.now()}`,
          sourcePhotoId: photoId,
          sourcePhotoUri: selectedPhoto?.uri || '',
          modelUri: `${photoId}_model.glb`,
          textureUri: `${photoId}_texture.png`,
          thumbnailUri: selectedPhoto?.uri || '',
          createdAt: new Date(),
          status: 'completed',
          processingProgress: 100,
          facePreservationScore: Math.floor(Math.random() * 10) + 90, // 90-99%
          metadata: {
            vertexCount: 45000 + Math.floor(Math.random() * 10000),
            faceCount: 90000 + Math.floor(Math.random() * 20000),
            textureResolution: {
              width: preferences.textureResolution === 'ultra' ? 4096 :
                     preferences.textureResolution === 'high' ? 2048 :
                     preferences.textureResolution === 'medium' ? 1024 : 512,
              height: preferences.textureResolution === 'ultra' ? 4096 :
                      preferences.textureResolution === 'high' ? 2048 :
                      preferences.textureResolution === 'medium' ? 1024 : 512,
            },
            format: preferences.outputFormat === '3d-obj' ? '3d-obj' :
                    preferences.outputFormat as 'gltf' | 'glb',
            fileSize: preferences.textureResolution === 'ultra' ? 25000000 :
                      preferences.textureResolution === 'high' ? 12000000 :
                      preferences.textureResolution === 'medium' ? 5000000 : 2000000,
          },
        };

        addModel(newModel);

        // Navigate to model viewer after a short delay
        setTimeout(() => {
          navigation.reset({
            index: 1,
            routes: [
              { name: 'MainTabs' },
              { name: 'ModelViewer', params: { model: newModel } },
            ],
          });
        }, 1000);
      }
    }, 3000); // Advance every 3 seconds

    return () => clearInterval(processInterval);
  }, [photoId, selectedPhoto, addModel, preferences, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={status === 'completed'}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creating 3D Model</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Processing Progress */}
      <ProcessingProgress
        status={status}
        progress={progress}
        estimatedTime={estimatedTime}
      />

      {/* Cancel Info */}
      {status !== 'completed' && status !== 'failed' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelProcessButton}
            onPress={handleCancel}
          >
            <Text style={styles.cancelProcessText}>Cancel Processing</Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Processing continues even if you leave this screen
          </Text>
        </View>
      )}
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
  cancelButton: {
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
  placeholder: {
    width: 44,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    alignItems: 'center',
  },
  cancelProcessButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelProcessText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '500',
  },
  footerNote: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
});

export default ProcessingScreen;
