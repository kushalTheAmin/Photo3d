import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../store/useAppStore';
import { modelGenerationService } from '../services/modelGeneration';
import { Model3D, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ModelsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { models, removeModel } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleModelPress = useCallback(
    (model: Model3D) => {
      navigation.navigate('ModelViewer', { model });
    },
    [navigation]
  );

  const handleDeleteModel = useCallback(
    (model: Model3D) => {
      Alert.alert(
        'Delete Model',
        'Are you sure you want to delete this 3D model?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await modelGenerationService.deleteModel(model.modelUri);
              removeModel(model.id);
            },
          },
        ]
      );
    },
    [removeModel]
  );

  const handleShareModel = useCallback(async (model: Model3D) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
      return;
    }

    const exportPath = await modelGenerationService.prepareModelForExport(model);
    if (exportPath) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'model/gltf-binary',
        dialogTitle: 'Share 3D Model',
      });
    } else {
      Alert.alert('Export Failed', 'Could not prepare the model for sharing');
    }
  }, []);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderGridItem = useCallback(
    ({ item }: { item: Model3D }) => (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => handleModelPress(item)}
      >
        <Image
          source={{ uri: item.thumbnailUri || item.sourcePhotoUri }}
          style={styles.gridImage}
        />
        <View style={styles.gridOverlay}>
          <View style={styles.modelBadge}>
            <Ionicons name="cube" size={12} color="#6c5ce7" />
            <Text style={styles.modelBadgeText}>
              {item.facePreservationScore}%
            </Text>
          </View>
          <View style={styles.gridActions}>
            <TouchableOpacity
              style={styles.gridActionButton}
              onPress={() => handleShareModel(item)}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gridActionButton}
              onPress={() => handleDeleteModel(item)}
            >
              <Ionicons name="trash-outline" size={16} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.gridInfo}>
          <Text style={styles.gridFormat}>
            {item.metadata.format.toUpperCase()}
          </Text>
          <Text style={styles.gridDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleModelPress, handleShareModel, handleDeleteModel]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Model3D }) => (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => handleModelPress(item)}
      >
        <Image
          source={{ uri: item.thumbnailUri || item.sourcePhotoUri }}
          style={styles.listImage}
        />
        <View style={styles.listContent}>
          <View style={styles.listHeader}>
            <View style={styles.modelBadge}>
              <Ionicons name="cube" size={14} color="#6c5ce7" />
              <Text style={styles.modelBadgeText}>
                {item.facePreservationScore}% Preserved
              </Text>
            </View>
            <Text style={styles.listFormat}>
              {item.metadata.format.toUpperCase()}
            </Text>
          </View>
          <View style={styles.listMeta}>
            <Text style={styles.listMetaText}>
              <Ionicons name="triangle-outline" size={12} color="#888" />{' '}
              {item.metadata.vertexCount.toLocaleString()} vertices
            </Text>
            <Text style={styles.listMetaText}>
              <Ionicons name="image-outline" size={12} color="#888" />{' '}
              {item.metadata.textureResolution.width}x
              {item.metadata.textureResolution.height}
            </Text>
          </View>
          <Text style={styles.listDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.listActions}>
          <TouchableOpacity
            style={styles.listActionButton}
            onPress={() => handleShareModel(item)}
          >
            <Ionicons name="share-outline" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.listActionButton}
            onPress={() => handleDeleteModel(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    ),
    [handleModelPress, handleShareModel, handleDeleteModel]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Models</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'grid' && styles.viewModeActive,
            ]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={viewMode === 'grid' ? '#6c5ce7' : '#888'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'list' && styles.viewModeActive,
            ]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={20}
              color={viewMode === 'list' ? '#6c5ce7' : '#888'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {models.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cube-outline" size={64} color="#444" />
          </View>
          <Text style={styles.emptyTitle}>No Models Yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first 3D model by taking or uploading a photo
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Camera')}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Create Model</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={models}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={models}
          renderItem={renderListItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {models.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Camera')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  viewModeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeActive: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 48) / 2,
    margin: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#16162a',
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'cover',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  modelBadgeText: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: '600',
  },
  gridActions: {
    flexDirection: 'row',
    gap: 4,
  },
  gridActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  gridFormat: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridDate: {
    color: '#888',
    fontSize: 11,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  listImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  listContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listFormat: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
  },
  listMeta: {
    gap: 4,
  },
  listMetaText: {
    color: '#888',
    fontSize: 12,
  },
  listDate: {
    color: '#666',
    fontSize: 11,
  },
  listActions: {
    padding: 12,
    justifyContent: 'space-around',
  },
  listActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ModelsScreen;
