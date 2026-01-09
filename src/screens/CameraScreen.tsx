import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PhotoCapture } from '../components';
import { useAppStore } from '../store/useAppStore';
import { Photo, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { addPhoto, setSelectedPhoto } = useAppStore();

  const handlePhotoTaken = useCallback(
    (photo: Photo) => {
      addPhoto(photo);
      setSelectedPhoto(photo);
      navigation.navigate('PhotoPreview', { photo });
    },
    [addPhoto, setSelectedPhoto, navigation]
  );

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <PhotoCapture onPhotoTaken={handlePhotoTaken} onClose={handleClose} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default CameraScreen;
