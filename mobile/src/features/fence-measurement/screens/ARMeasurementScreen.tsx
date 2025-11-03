import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type ARMeasurementScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ARMeasurement'>;
type ARMeasurementScreenRouteProp = RouteProp<RootStackParamList, 'ARMeasurement'>;

interface Props {
  navigation: ARMeasurementScreenNavigationProp;
  route: ARMeasurementScreenRouteProp;
}

export default function ARMeasurementScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  const [points, setPoints] = useState<number>(0);
  const [totalLength, setTotalLength] = useState<number>(0);

  // TODO: Integrate ViroReact ARScene
  // TODO: Implement AR hit testing
  // TODO: Implement point placement
  // TODO: Calculate distances

  const handleClose = () => {
    navigation.goBack();
  };

  const handlePlacePoint = () => {
    // TODO: Raycast and place point
    setPoints(prev => prev + 1);
    console.log('Place point via AR raycast');
  };

  const handleUndo = () => {
    if (points > 0) {
      setPoints(prev => prev - 1);
    }
  };

  const handleSave = () => {
    // TODO: Save measurements to Supabase
    console.log('Save measurements');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TODO: Replace with ViroARSceneNavigator */}
      <View style={styles.arView}>
        <Text style={styles.placeholder}>AR Camera View</Text>
        <Text style={styles.placeholder}>(ViroReact ARScene goes here)</Text>
      </View>

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.stats}>
            <Text style={styles.statsText}>Points: {points}</Text>
            <Text style={styles.statsText}>Length: {totalLength.toFixed(1)} ft</Text>
          </View>
        </View>

        {/* Crosshair (center of screen) */}
        <View style={styles.crosshair}>
          <View style={styles.crosshairHorizontal} />
          <View style={styles.crosshairVertical} />
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleUndo}>
            <Text style={styles.controlButtonText}>↶ Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.placePoin tButton} onPress={handlePlacePoint}>
            <Text style={styles.placePointButtonText}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={handleSave}>
            <Text style={styles.controlButtonText}>✓ Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  arView: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#999',
    fontSize: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  stats: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginTop: -20,
    marginLeft: -20,
  },
  crosshairHorizontal: {
    position: 'absolute',
    top: 19,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#fff',
  },
  crosshairVertical: {
    position: 'absolute',
    left: 19,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#fff',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placePointButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  placePointButtonText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
});
