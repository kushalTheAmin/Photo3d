import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Photo,
  Model3D,
  ProcessingJob,
  UserPreferences,
  FaceDetectionResult,
} from '../types';

interface AppState {
  // Photos
  photos: Photo[];
  selectedPhoto: Photo | null;
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  setSelectedPhoto: (photo: Photo | null) => void;

  // 3D Models
  models: Model3D[];
  selectedModel: Model3D | null;
  addModel: (model: Model3D) => void;
  updateModel: (id: string, updates: Partial<Model3D>) => void;
  removeModel: (id: string) => void;
  setSelectedModel: (model: Model3D | null) => void;

  // Processing
  processingJobs: ProcessingJob[];
  currentJob: ProcessingJob | null;
  addJob: (job: ProcessingJob) => void;
  updateJob: (id: string, updates: Partial<ProcessingJob>) => void;
  removeJob: (id: string) => void;
  setCurrentJob: (job: ProcessingJob | null) => void;

  // Face Detection
  lastFaceDetection: FaceDetectionResult | null;
  setLastFaceDetection: (result: FaceDetectionResult | null) => void;

  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;

  // UI State
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Clear all data
  clearAll: () => void;
}

const defaultPreferences: UserPreferences = {
  outputFormat: 'glb',
  textureResolution: 'high',
  autoSaveToGallery: true,
  enableFaceSmoothing: false,
  preservationLevel: 'maximum',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Photos
      photos: [],
      selectedPhoto: null,
      addPhoto: (photo) =>
        set((state) => ({ photos: [photo, ...state.photos] })),
      removePhoto: (id) =>
        set((state) => ({ photos: state.photos.filter((p) => p.id !== id) })),
      setSelectedPhoto: (photo) => set({ selectedPhoto: photo }),

      // 3D Models
      models: [],
      selectedModel: null,
      addModel: (model) =>
        set((state) => ({ models: [model, ...state.models] })),
      updateModel: (id, updates) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
      removeModel: (id) =>
        set((state) => ({ models: state.models.filter((m) => m.id !== id) })),
      setSelectedModel: (model) => set({ selectedModel: model }),

      // Processing
      processingJobs: [],
      currentJob: null,
      addJob: (job) =>
        set((state) => ({ processingJobs: [job, ...state.processingJobs] })),
      updateJob: (id, updates) =>
        set((state) => ({
          processingJobs: state.processingJobs.map((j) =>
            j.id === id ? { ...j, ...updates } : j
          ),
          currentJob:
            state.currentJob?.id === id
              ? { ...state.currentJob, ...updates }
              : state.currentJob,
        })),
      removeJob: (id) =>
        set((state) => ({
          processingJobs: state.processingJobs.filter((j) => j.id !== id),
        })),
      setCurrentJob: (job) => set({ currentJob: job }),

      // Face Detection
      lastFaceDetection: null,
      setLastFaceDetection: (result) => set({ lastFaceDetection: result }),

      // User Preferences
      preferences: defaultPreferences,
      updatePreferences: (updates) =>
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        })),

      // UI State
      isLoading: false,
      error: null,
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Clear all data
      clearAll: () =>
        set({
          photos: [],
          selectedPhoto: null,
          models: [],
          selectedModel: null,
          processingJobs: [],
          currentJob: null,
          lastFaceDetection: null,
          preferences: defaultPreferences,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'photo3d-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        photos: state.photos,
        models: state.models,
        preferences: state.preferences,
      }),
    }
  )
);
