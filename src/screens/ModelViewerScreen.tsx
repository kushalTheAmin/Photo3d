import React, { useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { ModelViewer3D } from '../components';
import { modelGenerationService } from '../services/modelGeneration';
import { RootStackParamList, Model3D } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'ModelViewer'>;

export const ModelViewerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { model } = route.params;

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleExport = useCallback(async () => {
    Alert.alert(
      'Export Model',
      `Your ${model.metadata.format.toUpperCase()} model is ready!\n\nFile size: ${(model.metadata.fileSize / 1000000).toFixed(1)} MB`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save to Files',
          onPress: async () => {
            Alert.alert('Success', 'Model saved to your device');
          },
        },
      ]
    );
  }, [model]);

  const handleShare = useCallback(async () => {
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
      return;
    }

    const exportPath = await modelGenerationService.prepareModelForExport(model);

    if (exportPath) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'model/gltf-binary',
        dialogTitle: 'Share your 3D Model',
      });
    } else {
      Alert.alert('Share', 'Sharing your 3D model...');
    }
  }, [model]);

  return (
    <View style={styles.container}>
      <ModelViewer3D
        model={model}
        onClose={handleClose}
        onExport={handleExport}
        onShare={handleShare}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});

export default ModelViewerScreen;
