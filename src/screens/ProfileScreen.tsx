import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppStore } from '../store/useAppStore';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { models, photos, preferences, clearAll } = useAppStore();

  const totalModels = models.length;
  const totalPhotos = photos.length;
  const avgPreservation =
    models.length > 0
      ? Math.round(
          models.reduce((sum, m) => sum + m.facePreservationScore, 0) /
            models.length
        )
      : 0;

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your photos and 3D models. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearAll();
            Alert.alert('Success', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'settings-outline',
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      onPress: () => Alert.alert('Help', 'Contact support@photo3d.app'),
    },
    {
      icon: 'star-outline',
      label: 'Rate App',
      onPress: () => Alert.alert('Rate', 'Thank you for your support!'),
    },
    {
      icon: 'share-social-outline',
      label: 'Share App',
      onPress: () => Alert.alert('Share', 'Share functionality coming soon!'),
    },
    {
      icon: 'document-text-outline',
      label: 'Privacy Policy',
      onPress: () => Alert.alert('Privacy', 'Privacy policy details...'),
    },
    {
      icon: 'information-circle-outline',
      label: 'About',
      onPress: () =>
        Alert.alert('Photo3D', 'Version 1.0.0\n\nTransform photos into 3D models'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#6c5ce7" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Photo3D User</Text>
          <Text style={styles.userStatus}>
            Creating amazing 3D models
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalModels}</Text>
          <Text style={styles.statLabel}>Models</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalPhotos}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{avgPreservation}%</Text>
          <Text style={styles.statLabel}>Avg. Score</Text>
        </View>
      </View>

      {/* Current Settings Preview */}
      <View style={styles.settingsPreview}>
        <Text style={styles.sectionTitle}>Current Settings</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Output Format</Text>
          <Text style={styles.settingValue}>
            {preferences.outputFormat.toUpperCase()}
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Texture Resolution</Text>
          <Text style={styles.settingValue}>
            {preferences.textureResolution.charAt(0).toUpperCase() +
              preferences.textureResolution.slice(1)}
          </Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Face Preservation</Text>
          <Text style={styles.settingValue}>
            {preferences.preservationLevel.charAt(0).toUpperCase() +
              preferences.preservationLevel.slice(1)}
          </Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIcon}>
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color="#6c5ce7"
                />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleClearData}
        >
          <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Photo3D v1.0.0</Text>
        <Text style={styles.footerCopyright}>
          Made with love for 3D enthusiasts
        </Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userStatus: {
    color: '#888',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#6c5ce7',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  settingsPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
    color: '#888',
    fontSize: 14,
  },
  settingValue: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '500',
  },
  menuContainer: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    color: '#fff',
    fontSize: 15,
  },
  dangerZone: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  dangerTitle: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  dangerButtonText: {
    color: '#e74c3c',
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
  },
  footerCopyright: {
    color: '#444',
    fontSize: 11,
    marginTop: 4,
  },
  bottomPadding: {
    height: 100,
  },
});

export default ProfileScreen;
