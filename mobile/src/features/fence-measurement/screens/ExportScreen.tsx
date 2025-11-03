import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type ExportScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Export'>;
type ExportScreenRouteProp = RouteProp<RootStackParamList, 'Export'>;

interface Props {
  navigation: ExportScreenNavigationProp;
  route: ExportScreenRouteProp;
}

export default function ExportScreen({ navigation, route }: Props) {
  const { projectId } = route.params;

  const handleGeneratePDF = () => {
    // TODO: Generate PDF using react-native-html-to-pdf
    console.log('Generate PDF for project:', projectId);
  };

  const handleSharePDF = () => {
    // TODO: Share PDF using react-native-share
    console.log('Share PDF');
  };

  const handleExportJSON = () => {
    // TODO: Export raw data as JSON
    console.log('Export JSON');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Export Project</Text>

      <TouchableOpacity style={styles.exportButton} onPress={handleGeneratePDF}>
        <Text style={styles.exportButtonText}>📄 Generate PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportButton} onPress={handleSharePDF}>
        <Text style={styles.exportButtonText}>📤 Share PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportButton} onPress={handleExportJSON}>
        <Text style={styles.exportButtonText}>💾 Export JSON Data</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  exportButton: {
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
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
