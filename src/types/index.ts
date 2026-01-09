// Photo and Image Types
export interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
  createdAt: Date;
  fileName?: string;
}

// Face Detection Types
export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  detected: boolean;
  boundingBox?: FaceBoundingBox;
  landmarks?: {
    leftEye: FaceLandmark;
    rightEye: FaceLandmark;
    nose: FaceLandmark;
    leftMouth: FaceLandmark;
    rightMouth: FaceLandmark;
    jawLine: FaceLandmark[];
    faceContour: FaceLandmark[];
  };
  confidence: number;
  faceId?: string;
}

// 3D Model Types
export interface Model3D {
  id: string;
  sourcePhotoId: string;
  sourcePhotoUri: string;
  modelUri: string;
  textureUri: string;
  thumbnailUri: string;
  createdAt: Date;
  status: ModelStatus;
  processingProgress: number;
  facePreservationScore: number;
  metadata: Model3DMetadata;
}

export type ModelStatus =
  | 'pending'
  | 'processing'
  | 'extracting_face'
  | 'generating_mesh'
  | 'applying_texture'
  | 'optimizing'
  | 'completed'
  | 'failed';

export interface Model3DMetadata {
  vertexCount: number;
  faceCount: number;
  textureResolution: {
    width: number;
    height: number;
  };
  format: '3d-obj' | 'gltf' | 'glb' | 'fbx';
  fileSize: number;
}

// Processing Types
export interface ProcessingJob {
  id: string;
  photoId: string;
  status: ModelStatus;
  progress: number;
  startedAt: Date;
  estimatedTimeRemaining?: number;
  errorMessage?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface UploadResponse {
  photoId: string;
  uploadUrl: string;
  faceDetection: FaceDetectionResult;
}

export interface GenerateModelResponse {
  jobId: string;
  estimatedTime: number;
}

export interface ModelResultResponse {
  model: Model3D;
  downloadUrls: {
    obj: string;
    gltf: string;
    glb: string;
    texture: string;
  };
}

// User Preferences
export interface UserPreferences {
  outputFormat: '3d-obj' | 'gltf' | 'glb';
  textureResolution: 'low' | 'medium' | 'high' | 'ultra';
  autoSaveToGallery: boolean;
  enableFaceSmoothing: boolean;
  preservationLevel: 'standard' | 'high' | 'maximum';
}

// Navigation Types
export type RootStackParamList = {
  MainTabs: undefined;
  Camera: undefined;
  PhotoPreview: { photo: Photo };
  Processing: { photoId: string; jobId: string };
  ModelViewer: { model: Model3D };
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Gallery: undefined;
  Create: undefined;
  Models: undefined;
  Profile: undefined;
};
