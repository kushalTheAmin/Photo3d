import axios, { AxiosInstance, AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import {
  ApiResponse,
  UploadResponse,
  GenerateModelResponse,
  ModelResultResponse,
  FaceDetectionResult,
  ProcessingJob,
  UserPreferences,
} from '../types';

// Configuration - Update this with your actual backend URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('API Error:', error.message);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as { message?: string };
      return new Error(data.message || `Server error: ${error.response.status}`);
    } else if (error.request) {
      return new Error('Network error. Please check your connection.');
    }
    return new Error(error.message || 'An unexpected error occurred');
  }

  // Upload photo for processing
  async uploadPhoto(photoUri: string): Promise<ApiResponse<UploadResponse>> {
    try {
      // Read file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await this.client.post<UploadResponse>('/api/upload', {
        image: base64,
        filename: photoUri.split('/').pop(),
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Upload failed',
        },
      };
    }
  }

  // Detect face in uploaded photo
  async detectFace(photoId: string): Promise<ApiResponse<FaceDetectionResult>> {
    try {
      const response = await this.client.post<FaceDetectionResult>(
        '/api/detect-face',
        { photoId }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FACE_DETECTION_ERROR',
          message: error instanceof Error ? error.message : 'Face detection failed',
        },
      };
    }
  }

  // Start 3D model generation
  async generateModel(
    photoId: string,
    preferences: Partial<UserPreferences>
  ): Promise<ApiResponse<GenerateModelResponse>> {
    try {
      const response = await this.client.post<GenerateModelResponse>(
        '/api/generate-model',
        {
          photoId,
          options: {
            outputFormat: preferences.outputFormat || 'glb',
            textureResolution: preferences.textureResolution || 'high',
            enableFaceSmoothing: preferences.enableFaceSmoothing || false,
            preservationLevel: preferences.preservationLevel || 'maximum',
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Model generation failed',
        },
      };
    }
  }

  // Check processing status
  async getJobStatus(jobId: string): Promise<ApiResponse<ProcessingJob>> {
    try {
      const response = await this.client.get<ProcessingJob>(
        `/api/jobs/${jobId}/status`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: error instanceof Error ? error.message : 'Status check failed',
        },
      };
    }
  }

  // Get completed model result
  async getModelResult(jobId: string): Promise<ApiResponse<ModelResultResponse>> {
    try {
      const response = await this.client.get<ModelResultResponse>(
        `/api/jobs/${jobId}/result`
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESULT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get result',
        },
      };
    }
  }

  // Download 3D model file
  async downloadModel(
    downloadUrl: string,
    fileName: string
  ): Promise<ApiResponse<string>> {
    try {
      const localUri = `${FileSystem.documentDirectory}models/${fileName}`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(
        `${FileSystem.documentDirectory}models`
      );
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}models`,
          { intermediates: true }
        );
      }

      // Download file
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        localUri
      );

      if (downloadResult.status === 200) {
        return { success: true, data: localUri };
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Download failed',
        },
      };
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
