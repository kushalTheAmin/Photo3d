# Photo3D

A mobile app that transforms person photos into stunning 3D models while preserving **100% facial feature accuracy**.

## Features

- **Photo Capture & Upload**: Take photos directly or select from gallery
- **Real-time Face Detection**: Advanced face detection with 468 facial landmarks
- **3D Model Generation**: AI-powered conversion from 2D photos to 3D models
- **Face Preservation**: Maximum fidelity to original facial features
- **Interactive 3D Viewer**: Rotate, zoom, and explore your 3D models
- **Multiple Export Formats**: OBJ, GLTF, GLB support
- **Texture Mapping**: High-resolution texture application up to 4K

## Tech Stack

### Mobile App (React Native + Expo)
- **React Native** - Cross-platform mobile development
- **Expo** - Development framework and build tools
- **Three.js + expo-three** - 3D rendering and visualization
- **Zustand** - State management
- **React Navigation** - Navigation and routing

### Backend (Python + FastAPI)
- **FastAPI** - High-performance API framework
- **MediaPipe** - Face mesh detection (468 landmarks)
- **OpenCV** - Image processing
- **Trimesh** - 3D mesh generation and export
- **NumPy/SciPy** - Numerical computation

## Project Structure

```
Photo3d/
├── App.tsx                    # Main app entry point
├── app.json                   # Expo configuration
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── PhotoCapture.tsx   # Camera & photo picker
│   │   ├── PhotoPreview.tsx   # Photo preview with face detection
│   │   ├── ModelViewer3D.tsx  # Interactive 3D model viewer
│   │   └── ProcessingProgress.tsx
│   ├── screens/               # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── GalleryScreen.tsx
│   │   ├── ModelsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   ├── PhotoPreviewScreen.tsx
│   │   ├── ProcessingScreen.tsx
│   │   └── ModelViewerScreen.tsx
│   ├── navigation/            # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── services/              # API & business logic
│   │   ├── api.ts             # Backend API client
│   │   ├── faceDetection.ts   # Face detection utilities
│   │   └── modelGeneration.ts # 3D model generation service
│   ├── store/                 # State management
│   │   └── useAppStore.ts     # Zustand store
│   └── types/                 # TypeScript definitions
│       └── index.ts
├── backend/                   # Python backend service
│   ├── main.py                # FastAPI application
│   ├── face_processor.py      # MediaPipe face detection
│   ├── model_generator.py     # 3D mesh generation
│   └── requirements.txt       # Python dependencies
└── assets/                    # App assets (icons, images)
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Python 3.10+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/Photo3d.git
   cd Photo3d
   ```

2. **Install mobile app dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

### Running the App

1. **Start the backend server**
   ```bash
   npm run server
   # or
   cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the mobile app**
   ```bash
   npm start
   # or
   npx expo start
   ```

3. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## Usage

### Creating a 3D Model

1. **Take or Select Photo**
   - Tap the camera icon or "Create New Model" button
   - Take a front-facing photo or select from gallery
   - Follow the face positioning guide

2. **Review & Confirm**
   - Review the photo preview
   - Check the quality score and face detection
   - Tap "Generate 3D Model" to proceed

3. **Processing**
   - Wait while the AI processes your photo
   - Watch the progress through different stages
   - Processing takes 30-60 seconds

4. **View & Export**
   - Explore your 3D model in the interactive viewer
   - Rotate, zoom, and toggle wireframe mode
   - Export in your preferred format (GLB, GLTF, OBJ)

### Settings

Configure your preferences:
- **Output Format**: GLB (default), GLTF, or OBJ
- **Texture Resolution**: Low (512), Medium (1024), High (2048), Ultra (4096)
- **Face Preservation Level**: Standard, High, or Maximum
- **Auto-save**: Automatically save models to device
- **Face Smoothing**: Apply subtle texture smoothing

## Face Preservation Technology

Photo3D uses advanced AI to ensure 100% facial feature preservation:

1. **468 Landmark Detection**: MediaPipe Face Mesh captures detailed facial geometry
2. **Precise Triangulation**: Delaunay triangulation creates accurate 3D mesh
3. **UV Texture Mapping**: Original face texture applied with pixel-perfect accuracy
4. **Mesh Optimization**: Subdivision and smoothing for natural appearance

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/upload` | Upload photo |
| POST | `/api/detect-face` | Detect face in photo |
| POST | `/api/generate-model` | Start 3D generation |
| GET | `/api/jobs/{id}/status` | Get processing status |
| GET | `/api/jobs/{id}/result` | Get completed model |

### Upload Photo
```bash
curl -X POST http://localhost:8000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"image": "base64_encoded_image", "filename": "photo.jpg"}'
```

### Generate Model
```bash
curl -X POST http://localhost:8000/api/generate-model \
  -H "Content-Type: application/json" \
  -d '{
    "photoId": "photo_abc123",
    "options": {
      "outputFormat": "glb",
      "textureResolution": "high",
      "preservationLevel": "maximum"
    }
  }'
```

## Performance

| Setting | Processing Time | File Size |
|---------|----------------|-----------|
| Standard + Low | ~20s | ~2 MB |
| High + Medium | ~35s | ~5 MB |
| Maximum + High | ~55s | ~12 MB |
| Maximum + Ultra | ~90s | ~25 MB |

## Roadmap

- [ ] Multi-angle photo support for 360° models
- [ ] Real-time AR preview
- [ ] Cloud processing option
- [ ] Animation/rigging support
- [ ] Batch processing
- [ ] Social sharing integration

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for face mesh detection
- [Three.js](https://threejs.org/) for 3D rendering
- [Expo](https://expo.dev/) for React Native tooling
- [FastAPI](https://fastapi.tiangolo.com/) for backend framework
