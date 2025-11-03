import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { FenceProject } from '@shared/types/fence-measurement.types';

// Import screens (we'll create these next)
import ProjectListScreen from '../features/fence-measurement/screens/ProjectListScreen';
import ProjectDetailScreen from '../features/fence-measurement/screens/ProjectDetailScreen';
import ARMeasurementScreen from '../features/fence-measurement/screens/ARMeasurementScreen';
import DrawingCanvasScreen from '../features/fence-measurement/screens/DrawingCanvasScreen';
import ExportScreen from '../features/fence-measurement/screens/ExportScreen';

// Define navigation types
export type RootStackParamList = {
  ProjectList: undefined;
  ProjectDetail: { projectId: string };
  ARMeasurement: { projectId: string };
  DrawingCanvas: { projectId: string };
  Export: { projectId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ProjectList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ProjectList"
        component={ProjectListScreen}
        options={{ title: 'Fence Projects' }}
      />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project Details' }}
      />
      <Stack.Screen
        name="ARMeasurement"
        component={ARMeasurementScreen}
        options={{
          title: 'AR Measurement',
          headerShown: false, // Full screen for AR
        }}
      />
      <Stack.Screen
        name="DrawingCanvas"
        component={DrawingCanvasScreen}
        options={{ title: 'Drawing' }}
      />
      <Stack.Screen
        name="Export"
        component={ExportScreen}
        options={{ title: 'Export Project' }}
      />
    </Stack.Navigator>
  );
}
