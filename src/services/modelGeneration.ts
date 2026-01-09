import * as FileSystem from 'expo-file-system';
import { apiService } from './api';
import { faceDetectionService } from './faceDetection';
import {
  Model3D,
  ModelStatus,
  ProcessingJob,
  UserPreferences,
  FaceDetectionResult,
} from '../types';

/**
 * 3D Model Generation Service
 *
 * Orchestrates the complete pipeline for generating 3D models from photos:
 * 1. Upload and validate photo
 * 2. Detect face and extract landmarks
 * 3. Generate 3D mesh with texture
 * 4. Apply face-preserving refinements
 * 5. Download and save final model
 */

interface GenerationOptions {
  preferences: UserPreferences;
  onProgress?: (status: ModelStatus, progress: number) => void;
  onFaceDetected?: (result: FaceDetectionResult) => void;
}

interface GenerationResult {
  success: boolean;
  model?: Model3D;
  error?: string;
}

class ModelGenerationService {
  private pollingInterval: number = 2000; // 2 seconds
  private maxPollingAttempts: number = 150; // 5 minutes max

  /**
   * Main method to generate a 3D model from a photo
   */
  async generateFromPhoto(
    photoUri: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const { preferences, onProgress, onFaceDetected } = options;

    try {
      // Step 1: Upload photo
      onProgress?.('pending', 5);
      const uploadResult = await apiService.uploadPhoto(photoUri);

      if (!uploadResult.success || !uploadResult.data) {
        return {
          success: false,
          error: uploadResult.error?.message || 'Failed to upload photo',
        };
      }

      const { photoId, faceDetection } = uploadResult.data;

      // Step 2: Validate face detection
      onProgress?.('extracting_face', 15);
      onFaceDetected?.(faceDetection);

      const validation =
        faceDetectionService.validateFaceForProcessing(faceDetection);

      if (!validation.isValid) {
        return {
          success: false,
          error: `Face validation failed: ${validation.issues.join(', ')}. ${validation.recommendations.join(' ')}`,
        };
      }

      // Calculate quality score
      const qualityScore =
        faceDetectionService.calculateFaceQualityScore(faceDetection);

      if (qualityScore < 50) {
        return {
          success: false,
          error: `Photo quality score (${qualityScore}/100) is too low for accurate 3D reconstruction. Please use a clearer photo with better lighting.`,
        };
      }

      // Step 3: Start model generation
      onProgress?.('generating_mesh', 25);
      const generateResult = await apiService.generateModel(photoId, preferences);

      if (!generateResult.success || !generateResult.data) {
        return {
          success: false,
          error: generateResult.error?.message || 'Failed to start generation',
        };
      }

      const { jobId } = generateResult.data;

      // Step 4: Poll for completion
      const completedJob = await this.pollForCompletion(
        jobId,
        onProgress
      );

      if (!completedJob || completedJob.status === 'failed') {
        return {
          success: false,
          error: completedJob?.errorMessage || 'Model generation failed',
        };
      }

      // Step 5: Get result and download model
      onProgress?.('optimizing', 90);
      const resultResponse = await apiService.getModelResult(jobId);

      if (!resultResponse.success || !resultResponse.data) {
        return {
          success: false,
          error: resultResponse.error?.message || 'Failed to get model result',
        };
      }

      const { model, downloadUrls } = resultResponse.data;

      // Download model file based on preference
      const formatKey = preferences.outputFormat === '3d-obj' ? 'obj' : preferences.outputFormat;
      const downloadUrl = downloadUrls[formatKey as keyof typeof downloadUrls];

      if (downloadUrl) {
        const fileName = `model_${model.id}.${preferences.outputFormat}`;
        const downloadResult = await apiService.downloadModel(
          downloadUrl,
          fileName
        );

        if (downloadResult.success && downloadResult.data) {
          model.modelUri = downloadResult.data;
        }
      }

      // Download texture
      if (downloadUrls.texture) {
        const textureFileName = `texture_${model.id}.png`;
        const textureResult = await apiService.downloadModel(
          downloadUrls.texture,
          textureFileName
        );

        if (textureResult.success && textureResult.data) {
          model.textureUri = textureResult.data;
        }
      }

      onProgress?.('completed', 100);

      return {
        success: true,
        model: {
          ...model,
          facePreservationScore: qualityScore,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      };
    }
  }

  /**
   * Poll for job completion
   */
  private async pollForCompletion(
    jobId: string,
    onProgress?: (status: ModelStatus, progress: number) => void
  ): Promise<ProcessingJob | null> {
    let attempts = 0;

    while (attempts < this.maxPollingAttempts) {
      const statusResult = await apiService.getJobStatus(jobId);

      if (!statusResult.success || !statusResult.data) {
        attempts++;
        await this.delay(this.pollingInterval);
        continue;
      }

      const job = statusResult.data;

      // Map progress to different stages
      const progressMap: Record<ModelStatus, number> = {
        pending: 25,
        processing: 35,
        extracting_face: 45,
        generating_mesh: 55,
        applying_texture: 70,
        optimizing: 85,
        completed: 100,
        failed: 0,
      };

      onProgress?.(job.status, progressMap[job.status] || job.progress);

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      attempts++;
      await this.delay(this.pollingInterval);
    }

    return null;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get local models directory
   */
  async getModelsDirectory(): Promise<string> {
    const dir = `${FileSystem.documentDirectory}models`;
    const dirInfo = await FileSystem.getInfoAsync(dir);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    return dir;
  }

  /**
   * List all saved models
   */
  async listSavedModels(): Promise<string[]> {
    const dir = await this.getModelsDirectory();
    const files = await FileSystem.readDirectoryAsync(dir);
    return files.filter(
      (f) => f.endsWith('.glb') || f.endsWith('.gltf') || f.endsWith('.obj')
    );
  }

  /**
   * Delete a saved model
   */
  async deleteModel(modelUri: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(modelUri, { idempotent: true });

      // Also delete associated texture if exists
      const textureUri = modelUri.replace(/\.(glb|gltf|obj)$/, '_texture.png');
      await FileSystem.deleteAsync(textureUri, { idempotent: true });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export model to share
   */
  async prepareModelForExport(model: Model3D): Promise<string | null> {
    try {
      const exportDir = `${FileSystem.cacheDirectory}export`;
      const dirInfo = await FileSystem.getInfoAsync(exportDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
      }

      const exportPath = `${exportDir}/${model.id}_export.${model.metadata.format}`;

      await FileSystem.copyAsync({
        from: model.modelUri,
        to: exportPath,
      });

      return exportPath;
    } catch {
      return null;
    }
  }

  /**
   * Calculate estimated processing time based on preferences
   */
  estimateProcessingTime(preferences: UserPreferences): number {
    let baseTime = 30; // 30 seconds base

    // Texture resolution impact
    const textureMultipliers: Record<string, number> = {
      low: 0.8,
      medium: 1.0,
      high: 1.5,
      ultra: 2.5,
    };
    baseTime *= textureMultipliers[preferences.textureResolution] || 1.0;

    // Preservation level impact
    const preservationMultipliers: Record<string, number> = {
      standard: 0.8,
      high: 1.2,
      maximum: 1.8,
    };
    baseTime *= preservationMultipliers[preferences.preservationLevel] || 1.0;

    return Math.round(baseTime);
  }
}

export const modelGenerationService = new ModelGenerationService();
export default modelGenerationService;
