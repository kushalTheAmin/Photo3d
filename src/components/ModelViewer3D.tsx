import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { Ionicons } from '@expo/vector-icons';
import { Model3D } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModelViewer3DProps {
  model: Model3D;
  onClose?: () => void;
  onExport?: () => void;
  onShare?: () => void;
}

export const ModelViewer3D: React.FC<ModelViewer3DProps> = ({
  model,
  onClose,
  onExport,
  onShare,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Three.js references
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationRef = useRef<number | null>(null);

  // Rotation state
  const rotationRef = useRef({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(2.5);

  // Pan responder for touch gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setAutoRotate(false);
        const { locationX, locationY } = evt.nativeEvent;
        lastTouchRef.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt, gestureState) => {
        const { numberActiveTouches } = evt.nativeEvent;

        if (numberActiveTouches === 1) {
          // Single touch - rotate
          const deltaX = gestureState.dx * 0.01;
          const deltaY = gestureState.dy * 0.01;

          rotationRef.current.y += deltaX;
          rotationRef.current.x += deltaY;

          // Clamp vertical rotation
          rotationRef.current.x = Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, rotationRef.current.x)
          );
        } else if (numberActiveTouches === 2) {
          // Pinch to zoom
          const scale = gestureState.scale || 1;
          zoomRef.current = Math.max(1, Math.min(5, 2.5 / scale));
        }
      },
      onPanResponderRelease: () => {
        // Optional: re-enable auto rotate after release
      },
    })
  ).current;

  // Create a default head model (placeholder when actual model loading isn't available)
  const createDefaultHeadModel = useCallback(() => {
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Create a more head-like shape by scaling
    geometry.scale(0.85, 1, 0.9);

    // Apply some vertex displacement for more organic shape
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      // Add subtle variation
      const noise = Math.sin(y * 3) * 0.02 + Math.sin(x * 5) * 0.01;
      positions.setZ(i, z + noise);

      // Chin area
      if (y < -0.5) {
        const chinFactor = (-y - 0.5) * 0.3;
        positions.setX(i, x * (1 - chinFactor));
        positions.setZ(i, z * (1 - chinFactor * 0.5));
      }

      // Forehead
      if (y > 0.6) {
        const foreheadFactor = (y - 0.6) * 0.2;
        positions.setZ(i, z - foreheadFactor);
      }
    }

    geometry.computeVertexNormals();

    return geometry;
  }, []);

  // Initialize Three.js scene
  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      try {
        setIsLoading(true);
        setError(null);

        // Create renderer
        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(0x1a1a2e, 1);
        rendererRef.current = renderer;

        // Create scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Create camera
        const camera = new THREE.PerspectiveCamera(
          45,
          gl.drawingBufferWidth / gl.drawingBufferHeight,
          0.1,
          1000
        );
        camera.position.z = zoomRef.current;
        cameraRef.current = camera;

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 5);
        scene.add(frontLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
        topLight.position.set(0, 5, 0);
        scene.add(topLight);

        const rimLight = new THREE.DirectionalLight(0x6c5ce7, 0.3);
        rimLight.position.set(-3, 0, -3);
        scene.add(rimLight);

        // Create material
        let material: THREE.Material;

        // Try to load texture if available
        if (model.textureUri) {
          try {
            const textureLoader = new TextureLoader();
            const texture = await textureLoader.loadAsync(model.textureUri);
            texture.flipY = false;

            material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.5,
              metalness: 0.1,
              wireframe: wireframe,
            });
          } catch {
            // Fallback to skin-tone material
            material = new THREE.MeshStandardMaterial({
              color: 0xffdbac,
              roughness: 0.6,
              metalness: 0.1,
              wireframe: wireframe,
            });
          }
        } else {
          // Default skin-tone material
          material = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            roughness: 0.6,
            metalness: 0.1,
            wireframe: wireframe,
          });
        }

        // Create geometry (use default head for demo)
        const geometry = createDefaultHeadModel();

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        meshRef.current = mesh;

        setIsLoading(false);

        // Animation loop
        const animate = () => {
          animationRef.current = requestAnimationFrame(animate);

          if (meshRef.current) {
            if (autoRotate) {
              meshRef.current.rotation.y += 0.005;
            } else {
              meshRef.current.rotation.x = rotationRef.current.x;
              meshRef.current.rotation.y = rotationRef.current.y;
            }
          }

          if (cameraRef.current) {
            cameraRef.current.position.z = zoomRef.current;
          }

          renderer.render(scene, camera);
          gl.endFrameEXP();
        };

        animate();
      } catch (err) {
        console.error('Error initializing 3D viewer:', err);
        setError('Failed to initialize 3D viewer');
        setIsLoading(false);
      }
    },
    [model, wireframe, autoRotate, createDefaultHeadModel]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Update wireframe mode
  useEffect(() => {
    if (meshRef.current && meshRef.current.material) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.wireframe = wireframe;
    }
  }, [wireframe]);

  const toggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => !prev);
  }, []);

  const toggleWireframe = useCallback(() => {
    setWireframe((prev) => !prev);
  }, []);

  const resetView = useCallback(() => {
    rotationRef.current = { x: 0, y: 0 };
    zoomRef.current = 2.5;
    setAutoRotate(true);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>3D Model</Text>
          <Text style={styles.headerSubtitle}>
            Face Preservation: {model.facePreservationScore}%
          </Text>
        </View>

        {onShare && (
          <TouchableOpacity style={styles.headerButton} onPress={onShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3D Viewer */}
      <View style={styles.viewerContainer} {...panResponder.panHandlers}>
        <GLView style={styles.glView} onContextCreate={onContextCreate} />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6c5ce7" />
            <Text style={styles.loadingText}>Loading model...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle" size={48} color="#e74c3c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, autoRotate && styles.activeButton]}
            onPress={toggleAutoRotate}
          >
            <Ionicons
              name="sync"
              size={20}
              color={autoRotate ? '#fff' : '#aaa'}
            />
            <Text
              style={[styles.controlText, autoRotate && styles.activeText]}
            >
              Auto Rotate
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, wireframe && styles.activeButton]}
            onPress={toggleWireframe}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={wireframe ? '#fff' : '#aaa'}
            />
            <Text
              style={[styles.controlText, wireframe && styles.activeText]}
            >
              Wireframe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={resetView}>
            <Ionicons name="refresh" size={20} color="#aaa" />
            <Text style={styles.controlText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {onExport && (
          <TouchableOpacity style={styles.exportButton} onPress={onExport}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.exportText}>Export Model</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Model Info */}
      <View style={styles.infoPanel}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Format</Text>
          <Text style={styles.infoValue}>{model.metadata.format.toUpperCase()}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Vertices</Text>
          <Text style={styles.infoValue}>
            {model.metadata.vertexCount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Texture</Text>
          <Text style={styles.infoValue}>
            {model.metadata.textureResolution.width}x
            {model.metadata.textureResolution.height}
          </Text>
        </View>
      </View>

      {/* Gesture hints */}
      <View style={styles.hints}>
        <Text style={styles.hintText}>
          <Ionicons name="hand-left-outline" size={12} color="#888" /> Drag to
          rotate
        </Text>
        <Text style={styles.hintText}>
          <Ionicons name="resize-outline" size={12} color="#888" /> Pinch to
          zoom
        </Text>
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
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#6c5ce7',
    fontSize: 12,
    marginTop: 2,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#16162a',
    borderRadius: 16,
    margin: 16,
    overflow: 'hidden',
  },
  glView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
  },
  errorText: {
    color: '#e74c3c',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  controls: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  activeButton: {
    backgroundColor: '#6c5ce7',
  },
  controlText: {
    color: '#aaa',
    fontSize: 12,
  },
  activeText: {
    color: '#fff',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  exportText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  hints: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  hintText: {
    color: '#666',
    fontSize: 11,
  },
});

export default ModelViewer3D;
