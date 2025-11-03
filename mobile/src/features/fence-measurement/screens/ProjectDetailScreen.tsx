import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type ProjectDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProjectDetail'>;
type ProjectDetailScreenRouteProp = RouteProp<RootStackParamList, 'ProjectDetail'>;

interface Props {
  navigation: ProjectDetailScreenNavigationProp;
  route: ProjectDetailScreenRouteProp;
}

export default function ProjectDetailScreen({ navigation, route }: Props) {
  const { projectId } = route.params;

  // TODO: Fetch project details from Supabase

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project: {projectId}</Text>
        <Text style={styles.label}>Status: Draft</Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => navigation.navigate('ARMeasurement', { projectId })}
        >
          <Text style={styles.actionButtonText}>📏 Start AR Measurement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('DrawingCanvas', { projectId })}
        >
          <Text style={styles.actionButtonText}>✏️ Open Drawing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Export', { projectId })}
        >
          <Text style={styles.actionButtonText}>📄 Export PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Measurements Summary</Text>
        <Text style={styles.label}>Total Linear Feet: 0</Text>
        <Text style={styles.label}>Gates: 0</Text>
        <Text style={styles.label}>Obstacles: 0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionsContainer: {
    padding: 16,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
