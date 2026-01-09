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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../store/useAppStore';
import { Photo, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 48) / 3;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const GalleryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { photos, addPhoto, removePhoto } = useAppStore();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handlePickImages = useCallback(async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets) {
      result.assets.forEach((asset) => {
        const photo: Photo = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          createdAt: new Date(),
          fileName: asset.fileName || undefined,
        };
        addPhoto(photo);
      });
    }
  }, [addPhoto]);

  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(photo.id)) {
            newSet.delete(photo.id);
          } else {
            newSet.add(photo.id);
          }
          return newSet;
        });
      } else {
        navigation.navigate('PhotoPreview', { photo });
      }
    },
    [selectionMode, navigation]
  );

  const handleLongPress = useCallback((photo: Photo) => {
    setSelectionMode(true);
    setSelectedIds(new Set([photo.id]));
  }, []);

  const handleDeleteSelected = useCallback(() => {
    Alert.alert(
      'Delete Photos',
      `Are you sure you want to delete ${selectedIds.size} photo(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedIds.forEach((id) => removePhoto(id));
            setSelectedIds(new Set());
            setSelectionMode(false);
          },
        },
      ]
    );
  }, [selectedIds, removePhoto]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const renderPhoto = useCallback(
    ({ item }: { item: Photo }) => {
      const isSelected = selectedIds.has(item.id);

      return (
        <TouchableOpacity
          style={[styles.photoContainer, isSelected && styles.photoSelected]}
          onPress={() => handlePhotoPress(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={500}
        >
          <Image source={{ uri: item.uri }} style={styles.photo} />

          {selectionMode && (
            <View
              style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
              ]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
          )}

          {!selectionMode && (
            <View style={styles.photoOverlay}>
              <TouchableOpacity
                style={styles.processButton}
                onPress={() => navigation.navigate('PhotoPreview', { photo: item })}
              >
                <Ionicons name="cube-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectionMode, selectedIds, handlePhotoPress, handleLongPress, navigation]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={cancelSelection}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {selectedIds.size} Selected
            </Text>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={selectedIds.size > 0 ? '#e74c3c' : '#555'}
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Gallery</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handlePickImages}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Content */}
      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="images-outline" size={64} color="#444" />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyDescription}>
            Add photos from your gallery to create 3D models
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handlePickImages}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Add Photos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      {photos.length > 0 && !selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Camera')}
        >
          <Ionicons name="camera" size={24} color="#fff" />
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
  cancelText: {
    color: '#6c5ce7',
    fontSize: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  photoContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#16162a',
  },
  photoSelected: {
    borderWidth: 2,
    borderColor: '#6c5ce7',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'flex-end',
  },
  processButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108, 92, 231, 0.8)',
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

export default GalleryScreen;
