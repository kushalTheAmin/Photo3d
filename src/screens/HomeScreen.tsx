import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../store/useAppStore';
import { RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { models, photos } = useAppStore();

  const recentModels = models.slice(0, 3);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.appName}>Photo3D</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Transform Photos into 3D Models</Text>
          <Text style={styles.heroSubtitle}>
            Capture or upload a photo and watch as AI creates a stunning 3D
            model while preserving every facial detail
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('Camera')}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.createButtonText}>Create New Model</Text>
          </TouchableOpacity>
        </View>

        {/* Floating 3D illustration */}
        <View style={styles.heroIllustration}>
          <View style={styles.cube3d}>
            <View style={[styles.cubeFace, styles.cubeFront]} />
            <View style={[styles.cubeFace, styles.cubeTop]} />
            <View style={[styles.cubeFace, styles.cubeRight]} />
          </View>
        </View>
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Why Photo3D?</Text>
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#6c5ce720' }]}>
              <Ionicons name="scan-outline" size={24} color="#6c5ce7" />
            </View>
            <Text style={styles.featureTitle}>Face Preservation</Text>
            <Text style={styles.featureDescription}>
              100% accurate facial feature preservation using advanced AI
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#27ae6020' }]}>
              <Ionicons name="flash-outline" size={24} color="#27ae60" />
            </View>
            <Text style={styles.featureTitle}>Fast Processing</Text>
            <Text style={styles.featureDescription}>
              Generate detailed 3D models in under 60 seconds
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#f39c1220' }]}>
              <Ionicons name="download-outline" size={24} color="#f39c12" />
            </View>
            <Text style={styles.featureTitle}>Export Options</Text>
            <Text style={styles.featureDescription}>
              Download in OBJ, GLTF, or GLB formats
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: '#e74c3c20' }]}>
              <Ionicons name="cube-outline" size={24} color="#e74c3c" />
            </View>
            <Text style={styles.featureTitle}>3D Viewer</Text>
            <Text style={styles.featureDescription}>
              Interactive viewer with rotation, zoom, and textures
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Models */}
      {recentModels.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Models</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MainTabs', { screen: 'Models' } as any)
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScroll}
          >
            {recentModels.map((model) => (
              <TouchableOpacity
                key={model.id}
                style={styles.recentCard}
                onPress={() => navigation.navigate('ModelViewer', { model })}
              >
                <Image
                  source={{ uri: model.thumbnailUri || model.sourcePhotoUri }}
                  style={styles.recentImage}
                />
                <View style={styles.recentInfo}>
                  <View style={styles.recentBadge}>
                    <Ionicons name="cube" size={12} color="#6c5ce7" />
                    <Text style={styles.recentBadgeText}>
                      {model.facePreservationScore}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{models.length}</Text>
          <Text style={styles.statLabel}>Models Created</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{photos.length}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>100%</Text>
          <Text style={styles.statLabel}>Face Accuracy</Text>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.howItWorksSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Take or Upload Photo</Text>
            <Text style={styles.stepDescription}>
              Capture a clear front-facing photo or select one from your gallery
            </Text>
          </View>
        </View>

        <View style={styles.stepConnector} />

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>AI Processing</Text>
            <Text style={styles.stepDescription}>
              Our AI analyzes 468 facial landmarks to create an accurate 3D mesh
            </Text>
          </View>
        </View>

        <View style={styles.stepConnector} />

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>View & Export</Text>
            <Text style={styles.stepDescription}>
              Explore your 3D model and export it in your preferred format
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => navigation.navigate('Camera')}
        >
          <Text style={styles.startButtonText}>Start Creating</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greeting: {
    color: '#888',
    fontSize: 14,
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    zIndex: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    maxWidth: '80%',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: '85%',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  heroIllustration: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -40,
  },
  cube3d: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  cubeFace: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cubeFront: {
    backgroundColor: 'rgba(108, 92, 231, 0.5)',
    bottom: 0,
    left: 0,
  },
  cubeTop: {
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
    top: 0,
    left: 10,
    transform: [{ skewX: '-30deg' }],
    width: 50,
    height: 30,
  },
  cubeRight: {
    backgroundColor: 'rgba(108, 92, 231, 0.4)',
    bottom: 10,
    right: 0,
    transform: [{ skewY: '-30deg' }],
    width: 30,
    height: 50,
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  recentSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  seeAllText: {
    color: '#6c5ce7',
    fontSize: 14,
  },
  recentScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  recentCard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  recentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recentInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  recentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentBadgeText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#6c5ce7',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  howItWorksSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  stepConnector: {
    width: 2,
    height: 24,
    backgroundColor: 'rgba(108, 92, 231, 0.3)',
    marginLeft: 17,
    marginVertical: 4,
  },
  bottomCTA: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c5ce7',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});

export default HomeScreen;
