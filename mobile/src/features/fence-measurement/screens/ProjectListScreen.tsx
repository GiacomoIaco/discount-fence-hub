import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type ProjectListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProjectList'>;

interface Props {
  navigation: ProjectListScreenNavigationProp;
}

export default function ProjectListScreen({ navigation }: Props) {
  // TODO: Fetch projects from Supabase using React Query
  const mockProjects = [
    { id: '1', projectName: 'Smith Residence', clientName: 'John Smith', status: 'draft' },
    { id: '2', projectName: 'Johnson Backyard', clientName: 'Jane Johnson', status: 'measuring' },
  ];

  const handleCreateProject = () => {
    // TODO: Show create project modal
    console.log('Create new project');
  };

  const handleProjectPress = (projectId: string) => {
    navigation.navigate('ProjectDetail', { projectId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Fence Projects</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateProject}>
          <Text style={styles.createButtonText}>+ New Project</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={mockProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.projectCard}
            onPress={() => handleProjectPress(item.id)}
          >
            <Text style={styles.projectName}>{item.projectName}</Text>
            <Text style={styles.clientName}>{item.clientName}</Text>
            <Text style={styles.status}>Status: {item.status}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  status: {
    fontSize: 12,
    color: '#2563eb',
    textTransform: 'capitalize',
  },
});
