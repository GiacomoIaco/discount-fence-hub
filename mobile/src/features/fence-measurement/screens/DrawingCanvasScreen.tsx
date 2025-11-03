import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type DrawingCanvasScreenNavigationProp = StackNavigationProp<RootStackParamList, 'DrawingCanvas'>;
type DrawingCanvasScreenRouteProp = RouteProp<RootStackParamList, 'DrawingCanvas'>;

interface Props {
  navigation: DrawingCanvasScreenNavigationProp;
  route: DrawingCanvasScreenRouteProp;
}

export default function DrawingCanvasScreen({ navigation, route }: Props) {
  const { projectId } = route.params;

  // TODO: Integrate @shopify/react-native-skia
  // TODO: Load fence segments and draw plan view
  // TODO: Implement drawing tools
  // TODO: Add dimension labels
  // TODO: Add gate and obstacle markers

  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Drawing Canvas (Skia)</Text>
      <Text style={styles.subtitle}>Project: {projectId}</Text>
      {/* TODO: Replace with Skia Canvas */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 24,
    color: '#999',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
