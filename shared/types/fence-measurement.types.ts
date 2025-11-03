/**
 * Shared TypeScript types for Fence Measurement feature
 * Used by both web app and mobile app for type safety and consistency
 */

// ============================================
// CORE TYPES
// ============================================

export type ProjectStatus = 'draft' | 'measuring' | 'review' | 'approved' | 'completed' | 'cancelled';

export type FenceStyle =
  | 'board-on-board'
  | 'shadowbox'
  | 'privacy'
  | 'picket'
  | 'chain-link'
  | 'vinyl'
  | 'composite'
  | 'split-rail'
  | 'other';

export type PostType = '4x4' | '6x6' | 'steel' | 'vinyl' | 'composite';

export type TerrainType = 'flat' | 'sloped' | 'stepped' | 'varied';

export type GateType = 'single-swing' | 'double-swing' | 'sliding' | 'rolling';

export type SwingDirection = 'inward' | 'outward' | 'left' | 'right' | 'bi-directional';

export type ObstacleShape = 'circle' | 'rectangle' | 'polygon' | 'irregular';

export type ObstacleType =
  | 'tree'
  | 'boulder'
  | 'rock'
  | 'stump'
  | 'utility-box'
  | 'electric-meter'
  | 'gas-meter'
  | 'water-meter'
  | 'ac-unit'
  | 'generator'
  | 'propane-tank'
  | 'pool'
  | 'hot-tub'
  | 'pond'
  | 'fountain'
  | 'deck'
  | 'patio'
  | 'shed'
  | 'building'
  | 'slope'
  | 'hill'
  | 'ditch'
  | 'creek'
  | 'driveway'
  | 'sidewalk'
  | 'path'
  | 'sprinkler-head'
  | 'drain'
  | 'vent'
  | 'custom';

export type PhotoType =
  | 'site-overview'
  | 'measurement'
  | 'detail'
  | 'obstacle'
  | 'gate-location'
  | 'property-line'
  | 'existing-fence'
  | 'reference'
  | 'annotation';

export type DrawingType = 'plan-view' | 'elevation' | 'detail' | 'annotation';

export type ExportType = 'pdf' | 'json' | 'csv' | 'dxf';

// ============================================
// 3D GEOMETRY
// ============================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D extends Point3D {
  // Same structure, different semantic meaning
}

export interface Transform3D {
  position: Point3D;
  rotation?: {
    x: number; // pitch
    y: number; // yaw
    z: number; // roll
  };
  scale?: {
    x: number;
    y: number;
    z: number;
  };
}

// ============================================
// AR MEASUREMENT TYPES
// ============================================

export interface ARHitTestResult {
  position: Point3D;
  confidence: number; // 0-1
  type: 'plane' | 'feature-point' | 'estimated-plane';
  transform: Transform3D;
  timestamp: number;
}

export interface CalibrationData {
  referenceLength: number; // feet - known length (e.g., 8ft board)
  measuredLength: number; // feet - what AR measured
  factor: number; // correction factor = referenceLength / measuredLength
  timestamp: Date;
  confidence: number;
}

// ============================================
// FENCE PROJECT
// ============================================

export interface FenceProject {
  id: string;
  projectName: string;
  projectNumber?: string; // Auto-generated: FP-YYYY-NNNN

  // Client
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;

  // Location
  siteAddress: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  siteCountry?: string;
  latitude?: number;
  longitude?: number;
  reverseGeocodedAddress?: string;

  // Sales Rep
  createdBy: string; // UUID
  salesRepName?: string;
  salesRepEmail?: string;

  // Status
  status: ProjectStatus;

  // Summary
  totalLinearFeet: number;
  totalAreaSqft: number;
  numSegments: number;
  numGates: number;
  numObstacles: number;
  perimeterFeet: number;

  // Calibration
  calibrationUsed: boolean;
  calibrationReferenceLength?: number;
  calibrationMeasuredLength?: number;
  calibrationFactor?: number;
  calibrationTimestamp?: Date;

  // Device metadata
  deviceModel?: string;
  deviceOs?: string;
  hasLidar: boolean;
  avgConfidenceScore?: number;
  estimatedAccuracyCm?: number;

  // Notes
  notes?: string;
  specialInstructions?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  measuringStartedAt?: Date;
  measuringCompletedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;

  // Sync
  synced: boolean;
  lastSyncedAt?: Date;
  syncVersion: number;

  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;

  // Related data (populated via joins)
  segments?: FenceSegment[];
  gates?: FenceGate[];
  obstacles?: FenceObstacle[];
  photos?: FenceProjectPhoto[];
  drawings?: FenceDrawing[];
  exports?: FenceProjectExport[];
}

// ============================================
// FENCE SEGMENT
// ============================================

export interface FenceSegment {
  id: string;
  projectId: string;

  // Order
  segmentIndex: number;

  // 3D Coordinates (meters from AR origin)
  start: Point3D;
  end: Point3D;

  // Measurements
  lengthFeet: number;
  lengthInches: number;
  lengthMeters?: number;

  // Specifications
  fenceStyle?: FenceStyle;
  fenceHeightFeet?: number;
  fenceHeightInches?: number;
  postType?: PostType;
  postSpacingFeet?: number;

  // Terrain
  slopePercent?: number;
  slopeAngleDegrees?: number;
  terrainType?: TerrainType;

  // Quality
  confidenceScore: number; // 0-1
  measurementTimestamp: Date;

  // Flags
  requiresSpecialPost: boolean;
  requiresGate: boolean;

  notes?: string;
  createdAt: Date;
}

// ============================================
// FENCE GATE
// ============================================

export interface FenceGate {
  id: string;
  projectId: string;

  // Position
  segmentId?: string;
  positionOnSegment?: number; // 0-1
  position?: Point3D; // Absolute position if not on segment

  // Properties
  gateName?: string;
  gateType: GateType;

  // Dimensions
  widthFeet: number;
  widthInches?: number;
  heightFeet?: number;
  heightInches?: number;

  // Operation
  swingDirection?: SwingDirection;
  opensTo?: string;

  // Hardware
  hardwareType?: string;
  lockType?: string;
  hingeType?: string;
  hasLatch: boolean;
  hasSpring: boolean;
  hasCloser: boolean;

  // Material
  material?: string;

  // Special requirements
  adaCompliant: boolean;
  fireRated: boolean;

  notes?: string;
  createdAt: Date;
}

// ============================================
// FENCE OBSTACLE
// ============================================

export interface FenceObstacle {
  id: string;
  projectId: string;

  // Position
  position: Point3D;

  // Shape & dimensions
  shape: ObstacleShape;
  radiusFeet?: number; // For circle
  widthFeet?: number; // For rectangle
  depthFeet?: number; // For rectangle
  polygonPoints?: Point3D[]; // For polygon

  // Type
  obstacleType: ObstacleType;
  label: string;
  description?: string;

  // Impact
  requiresRemoval: boolean;
  requiresGate: boolean;
  requiresSpecialPost: boolean;
  affectsFenceRoute: boolean;

  notes?: string;
  createdAt: Date;
}

// ============================================
// FENCE PROJECT PHOTO
// ============================================

export interface FenceProjectPhoto {
  id: string;
  projectId: string;

  // Type
  photoType: PhotoType;

  // Storage
  storagePath: string;
  thumbnailPath?: string;

  // Metadata
  caption?: string;
  description?: string;

  // Location
  latitude?: number;
  longitude?: number;

  // Relations
  relatedSegmentId?: string;
  relatedGateId?: string;
  relatedObstacleId?: string;

  // Image properties
  widthPx?: number;
  heightPx?: number;
  fileSizeBytes?: number;
  mimeType: string;

  // Timestamps
  takenAt: Date;
  uploadedAt: Date;
  createdAt: Date;

  displayOrder: number;
}

// ============================================
// FENCE DRAWING
// ============================================

export interface SkiaPath {
  type: 'line' | 'rect' | 'circle' | 'polyline' | 'polygon' | 'text' | 'arrow';
  points?: Point3D[];
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  text?: string;
  fontSize?: number;
  [key: string]: any; // Allow additional properties
}

export interface CanvasData {
  paths: SkiaPath[];
  shapes: any[];
  annotations: any[];
  metadata?: {
    created: Date;
    modified: Date;
    author?: string;
  };
}

export interface FenceDrawing {
  id: string;
  projectId: string;

  // Type
  drawingType: DrawingType;

  // Canvas data
  canvasData: CanvasData;

  // Dimensions
  canvasWidth: number;
  canvasHeight: number;
  scaleFactor?: number; // pixels per foot
  scaleRatio?: string; // e.g., "1:50"

  // Origin
  originX: number;
  originY: number;

  // Cached render
  renderedImagePath?: string;

  // Metadata
  name?: string;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// ============================================
// FENCE PROJECT EXPORT
// ============================================

export interface ExportSettings {
  includePhotos: boolean;
  includeBom: boolean;
  includeDrawings: boolean;
  includeMeasurements: boolean;
  templateName?: string;
  brandingLogoPath?: string;
  [key: string]: any;
}

export interface FenceProjectExport {
  id: string;
  projectId: string;

  // Type
  exportType: ExportType;

  // File
  storagePath: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType?: string;

  // PDF specific
  numPages?: number;
  includesPhotos: boolean;
  includesBom: boolean;
  includesDrawings: boolean;
  includesMeasurements: boolean;

  // Settings
  templateName?: string;
  brandingLogoPath?: string;
  exportSettings?: ExportSettings;

  // Export metadata
  exportedBy?: string;
  exportedAt: Date;

  // Sharing
  sharedVia?: string;
  sharedAt?: Date;
  recipientEmail?: string;
  recipientPhone?: string;

  // Download tracking
  downloadCount: number;
  lastDownloadedAt?: Date;

  createdAt: Date;
}

// ============================================
// FENCE STYLE PRESET
// ============================================

export interface FenceStylePreset {
  id: string;
  presetName: string;
  presetCode?: string;

  // Style
  style: FenceStyle;
  material?: string;

  // Defaults
  defaultHeightFeet?: number;
  defaultHeightInches?: number;
  defaultPostType?: PostType;
  defaultPostSpacingFeet?: number;

  // Construction
  picketWidthInches?: number;
  picketSpacingInches?: number;
  railCount?: number;
  railType?: string;
  capStyle?: string;

  // Material specs
  woodGrade?: string;
  woodTreatment?: string;

  // Pricing
  estimatedCostPerLinearFoot?: number;

  // Ownership
  isGlobal: boolean;
  isActive: boolean;
  createdBy?: string;

  // Visual
  thumbnailImagePath?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// REQUEST/RESPONSE TYPES (API)
// ============================================

export interface CreateProjectRequest {
  projectName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  siteAddress: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface CreateProjectResponse {
  project: FenceProject;
  success: boolean;
  error?: string;
}

export interface BatchCreateSegmentsRequest {
  projectId: string;
  segments: Omit<FenceSegment, 'id' | 'projectId' | 'createdAt'>[];
}

export interface BatchCreateSegmentsResponse {
  segments: FenceSegment[];
  success: boolean;
  error?: string;
}

export interface GeneratePDFRequest {
  projectId: string;
  settings: ExportSettings;
}

export interface GeneratePDFResponse {
  exportId: string;
  pdfUrl: string;
  fileSizeBytes: number;
  success: boolean;
  error?: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'project' | 'segment' | 'gate' | 'obstacle' | 'photo';
  data: any;
  timestamp: number;
  synced: boolean;
  retryCount: number;
  error?: string;
}

export interface SyncRequest {
  items: SyncQueueItem[];
  userId: string;
  deviceId: string;
}

export interface SyncResponse {
  results: {
    id: string;
    success: boolean;
    error?: string;
    serverId?: string; // Server-generated ID if different from client
  }[];
  success: boolean;
  syncedAt: Date;
}

// ============================================
// UI STATE TYPES (for mobile app)
// ============================================

export interface MeasurementState {
  isActive: boolean;
  points: Point3D[];
  segments: FenceSegment[];
  currentSegment?: FenceSegment;
  totalLength: number;
  calibration?: CalibrationData;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface DrawingState {
  mode: 'view' | 'draw' | 'annotate' | 'measure';
  tool: 'line' | 'rectangle' | 'circle' | 'text' | 'arrow' | 'dimension' | 'select';
  selectedPath?: SkiaPath;
  zoom: number;
  pan: { x: number; y: number };
}

// ============================================
// UTILITY TYPES
// ============================================

export interface Dimensions {
  feet: number;
  inches: number;
  totalInches: number;
  meters: number;
}

export interface Measurement {
  value: number;
  unit: 'feet' | 'inches' | 'meters' | 'centimeters';
  precision: number; // decimal places
}

export interface BoundingBox {
  min: Point3D;
  max: Point3D;
  center: Point3D;
  width: number;
  height: number;
  depth: number;
}

// ============================================
// DATABASE TYPES (raw from Supabase)
// ============================================

export interface Database {
  public: {
    Tables: {
      fence_projects: {
        Row: FenceProject;
        Insert: Omit<FenceProject, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<FenceProject, 'id' | 'createdAt'>>;
      };
      fence_segments: {
        Row: FenceSegment;
        Insert: Omit<FenceSegment, 'id' | 'createdAt'>;
        Update: Partial<Omit<FenceSegment, 'id' | 'createdAt'>>;
      };
      fence_gates: {
        Row: FenceGate;
        Insert: Omit<FenceGate, 'id' | 'createdAt'>;
        Update: Partial<Omit<FenceGate, 'id' | 'createdAt'>>;
      };
      fence_obstacles: {
        Row: FenceObstacle;
        Insert: Omit<FenceObstacle, 'id' | 'createdAt'>;
        Update: Partial<Omit<FenceObstacle, 'id' | 'createdAt'>>;
      };
      fence_project_photos: {
        Row: FenceProjectPhoto;
        Insert: Omit<FenceProjectPhoto, 'id' | 'createdAt'>;
        Update: Partial<Omit<FenceProjectPhoto, 'id' | 'createdAt'>>;
      };
      fence_drawings: {
        Row: FenceDrawing;
        Insert: Omit<FenceDrawing, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<FenceDrawing, 'id' | 'createdAt'>>;
      };
      fence_project_exports: {
        Row: FenceProjectExport;
        Insert: Omit<FenceProjectExport, 'id' | 'createdAt'>;
        Update: Partial<Omit<FenceProjectExport, 'id' | 'createdAt'>>;
      };
      fence_style_presets: {
        Row: FenceStylePreset;
        Insert: Omit<FenceStylePreset, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<FenceStylePreset, 'id' | 'createdAt'>>;
      };
    };
  };
}
