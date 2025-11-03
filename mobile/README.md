# Fence Measure Pro - Mobile App

Cross-platform AR-powered fence measurement app for iOS and Android, built with React Native and Expo.

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native 0.76 + Expo 52
- **AR Library**: ViroReact (ARKit for iOS, ARCore for Android)
- **Drawing**: @shopify/react-native-skia (high-performance 2D canvas)
- **PDF Export**: react-native-html-to-pdf
- **Navigation**: React Navigation 7
- **State Management**: Zustand + React Query
- **Backend**: Supabase (shared with web app)
- **Storage**: MMKV (offline-first)
- **Language**: TypeScript

### Project Structure

```
mobile/
├── src/
│   ├── features/
│   │   └── fence-measurement/
│   │       ├── screens/               # Main app screens
│   │       │   ├── ProjectListScreen.tsx
│   │       │   ├── ProjectDetailScreen.tsx
│   │       │   ├── ARMeasurementScreen.tsx
│   │       │   ├── DrawingCanvasScreen.tsx
│   │       │   └── ExportScreen.tsx
│   │       │
│   │       ├── components/
│   │       │   ├── ARCamera/          # AR-related components
│   │       │   ├── Drawing/           # Canvas drawing components
│   │       │   └── Export/            # Export-related components
│   │       │
│   │       ├── hooks/                 # Custom React hooks
│   │       ├── services/              # Business logic
│   │       ├── native-modules/        # Native AR bridges
│   │       │   ├── ARMeasurement/
│   │       │   └── LiDARScanner/
│   │       │
│   │       └── types/                 # TypeScript types
│   │
│   ├── navigation/                    # App navigation setup
│   ├── shared/                        # Symlink to ../shared
│   └── theme/                         # App styling
│
├── ios/                               # Native iOS code (ARKit)
├── android/                           # Native Android code (ARCore)
├── App.tsx                            # App entry point
├── package.json
└── README.md                          # This file
```

## 🚀 Getting Started

### Prerequisites

- **Mac** (required for iOS development)
- **Xcode** 15+ (for iOS builds)
- **Android Studio** (optional, for Android builds)
- **Node.js** 18+ and npm/yarn
- **Expo CLI**: `npm install -g expo-cli eas-cli`

### Installation

1. **Navigate to mobile directory**:
   ```bash
   cd mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create `.env` file:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Install iOS pods** (Mac only):
   ```bash
   cd ios
   pod install
   cd ..
   ```

### Running the App

#### Development Mode

**iOS (Mac only)**:
```bash
npx expo run:ios
```

**Android**:
```bash
npx expo run:android
```

**Expo Go** (quick preview, limited AR):
```bash
npx expo start
```

#### Production Build

**iOS**:
```bash
eas build --platform ios --profile production
```

**Android**:
```bash
eas build --platform android --profile production
```

## 📱 Features

### Implemented (Phase 1 - Structure)

✅ Project list screen
✅ Project detail screen
✅ AR measurement screen (UI only)
✅ Drawing canvas screen (placeholder)
✅ Export screen (placeholder)
✅ Navigation setup
✅ TypeScript configuration
✅ Shared types with web app

### To Implement (Next Steps)

#### Phase 2: AR Measurement (Week 2)
- [ ] Integrate ViroReact ARScene
- [ ] Implement AR hit testing (raycast)
- [ ] Point placement on tap
- [ ] Distance calculation between points
- [ ] Calibration modal
- [ ] Confidence indicators
- [ ] Save segments to Supabase

#### Phase 3: Drawing Canvas (Week 3)
- [ ] Integrate Skia canvas
- [ ] Render fence segments from AR data
- [ ] Dimension labels
- [ ] Gate markers
- [ ] Obstacle markers
- [ ] Manual drawing tools
- [ ] Export canvas as image

#### Phase 4: Backend Integration (Week 4)
- [ ] Supabase client setup
- [ ] React Query hooks for CRUD
- [ ] Create/update/delete projects
- [ ] Photo upload to Supabase Storage
- [ ] Offline queue with MMKV
- [ ] Sync manager

#### Phase 5: PDF Export (Week 5)
- [ ] HTML templates for PDF
- [ ] Generate multi-page PDF
- [ ] Include photos, drawings, measurements
- [ ] Share via email, text, AirDrop
- [ ] Upload to Supabase Storage

## 🔧 Development Guide

### Adding a New Screen

1. Create screen file in `src/features/fence-measurement/screens/`
2. Add route type to `RootStackParamList` in `AppNavigator.tsx`
3. Add `<Stack.Screen>` in `AppNavigator.tsx`
4. Navigate using: `navigation.navigate('ScreenName', { params })`

### Using Shared Types

Import from the shared folder (symlinked):
```typescript
import type { FenceProject, FenceSegment } from '@shared/types/fence-measurement.types';
import { calculateDistance3D } from '@shared/utils/fenceCalculations';
```

### AR Development (ViroReact)

Example AR scene:
```typescript
import { ViroARScene, ViroARSceneNavigator } from '@viro-community/react-viro';

function ARScene() {
  const onARHitTest = async () => {
    // Perform raycast
    const results = await viroARScene.performARHitTestWithRay(/* ... */);
    // Get 3D position
    const point = results[0].transform.position;
  };

  return (
    <ViroARScene>
      {/* AR content */}
    </ViroARScene>
  );
}
```

### Drawing with Skia

Example canvas:
```typescript
import { Canvas, Path, Circle, Text } from '@shopify/react-native-skia';

function DrawingCanvas() {
  return (
    <Canvas style={{ flex: 1 }}>
      <Path
        path="M 10 10 L 100 10 L 100 100 Z"
        color="blue"
        strokeWidth={2}
      />
      <Circle cx={50} cy={50} r={10} color="red" />
      <Text x={20} y={20} text="10.5 ft" />
    </Canvas>
  );
}
```

### Supabase Queries

Example using React Query:
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

function useProjects() {
  return useQuery({
    queryKey: ['fence-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fence_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## 📦 Building for Production

### iOS

1. **Configure app in Xcode**:
   - Open `ios/FenceMeasurePro.xcworkspace`
   - Set team and bundle ID
   - Configure capabilities (Camera, AR, Location)

2. **Build with EAS**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

### Android

1. **Configure in Android Studio** (optional):
   - Open `android/` folder
   - Set package name
   - Configure permissions

2. **Build with EAS**:
   ```bash
   eas build --platform android --profile production
   ```

3. **Submit to Google Play**:
   ```bash
   eas submit --platform android
   ```

## 🔐 Environment Variables

Create `.env` file:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
EXPO_PUBLIC_API_BASE_URL=https://your-netlify-app.netlify.app
EXPO_PUBLIC_ENABLE_DEV_MODE=true
```

## 📚 Key Libraries

### AR & Camera
- **@viro-community/react-viro**: AR framework (ARKit/ARCore)
- **expo-camera**: Camera access
- **expo-sensors**: Device motion sensors

### Drawing & Graphics
- **@shopify/react-native-skia**: High-performance 2D drawing
- **react-native-svg**: SVG rendering
- **react-native-gesture-handler**: Touch gestures

### PDF & Export
- **react-native-html-to-pdf**: PDF generation
- **react-native-share**: Share files

### Storage & Sync
- **@supabase/supabase-js**: Backend client
- **react-native-mmkv**: Fast offline storage
- **@tanstack/react-query**: Data fetching and caching

## 🐛 Troubleshooting

### iOS Build Issues

**Error: "ARKit not available"**
- Ensure running on physical device (AR doesn't work in simulator)
- Check Info.plist has AR usage descriptions

**Pod install fails**:
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Android Build Issues

**ARCore not found**:
- Ensure device supports ARCore
- Check Google Play Services AR is installed

### ViroReact Issues

**"Unable to resolve module @viro-community/react-viro"**:
```bash
rm -rf node_modules
npm install
npx expo prebuild --clean
```

## 📖 Additional Resources

- [ViroReact Docs](https://viro-community.readme.io/)
- [React Native Skia Docs](https://shopify.github.io/react-native-skia/)
- [Expo Docs](https://docs.expo.dev/)
- [Supabase Docs](https://supabase.com/docs)

## 🤝 Contributing

This is a feature of the Discount Fence Hub application. See main project README for contribution guidelines.

## 📝 License

Proprietary - High Fortitude Fence Company

---

**Built with** ❤️ **using React Native, ViroReact, and Skia**
