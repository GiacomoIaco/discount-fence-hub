/**
 * Shared calculation utilities for fence measurements
 * Used by both web app and mobile app
 */

import type {
  Point3D,
  FenceSegment,
  Dimensions,
  Measurement,
  BoundingBox,
  FenceProject,
  CalibrationData,
} from '../types/fence-measurement.types';

// ============================================
// DISTANCE CALCULATIONS
// ============================================

/**
 * Calculate 3D Euclidean distance between two points
 */
export function calculateDistance3D(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate 2D distance (ignoring z-axis, for plan view)
 */
export function calculateDistance2D(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate horizontal distance (assuming y is vertical axis)
 */
export function calculateHorizontalDistance(p1: Point3D, p2: Point3D): number {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// ============================================
// UNIT CONVERSIONS
// ============================================

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

/**
 * Convert feet to meters
 */
export function feetToMeters(feet: number): number {
  return feet / 3.28084;
}

/**
 * Convert feet to inches
 */
export function feetToInches(feet: number): number {
  return feet * 12;
}

/**
 * Convert inches to feet
 */
export function inchesToFeet(inches: number): number {
  return inches / 12;
}

/**
 * Convert total feet to feet and inches
 */
export function feetToDimensions(totalFeet: number): Dimensions {
  const feet = Math.floor(totalFeet);
  const remainingInches = (totalFeet - feet) * 12;
  const inches = Math.round(remainingInches * 100) / 100; // Round to 2 decimal places

  return {
    feet,
    inches,
    totalInches: feetToInches(totalFeet),
    meters: feetToMeters(totalFeet),
  };
}

/**
 * Convert feet and inches to total feet
 */
export function dimensionsToFeet(feet: number, inches: number): number {
  return feet + inchesToFeet(inches);
}

/**
 * Format dimensions as string (e.g., "10' 6\"")
 */
export function formatDimensions(totalFeet: number, includeMeters = false): string {
  const dims = feetToDimensions(totalFeet);

  const feetInches = `${dims.feet}' ${dims.inches.toFixed(1)}"`;

  if (includeMeters) {
    return `${feetInches} (${dims.meters.toFixed(2)}m)`;
  }

  return feetInches;
}

// ============================================
// SEGMENT CALCULATIONS
// ============================================

/**
 * Calculate length of a segment in meters
 */
export function calculateSegmentLength(segment: FenceSegment): number {
  return calculateDistance3D(segment.start, segment.end);
}

/**
 * Calculate total length of all segments
 */
export function calculateTotalLength(segments: FenceSegment[]): number {
  return segments.reduce((total, segment) => total + segment.lengthFeet, 0);
}

/**
 * Calculate perimeter if segments form a closed loop
 */
export function calculatePerimeter(segments: FenceSegment[]): number {
  if (segments.length === 0) return 0;

  let total = calculateTotalLength(segments);

  // Check if loop is closed (last point connects to first)
  const firstStart = segments[0].start;
  const lastEnd = segments[segments.length - 1].end;
  const distanceToClose = calculateDistance3D(lastEnd, firstStart);

  // If not closed (distance > 0.1m), it's not a perimeter
  if (distanceToClose > 0.1) {
    return 0; // Not a closed loop
  }

  return total;
}

/**
 * Calculate area enclosed by segments (2D projection, assumes horizontal plane)
 */
export function calculateEnclosedArea(segments: FenceSegment[]): number {
  if (segments.length < 3) return 0;

  // Shoelace formula for polygon area
  let area = 0;
  const points = segments.map(seg => seg.start);
  points.push(segments[segments.length - 1].end); // Close the loop

  for (let i = 0; i < points.length - 1; i++) {
    area += points[i].x * points[i + 1].z - points[i + 1].x * points[i].z;
  }

  area = Math.abs(area) / 2;

  // Convert to square feet
  const areaSquareMeters = area;
  const areaSquareFeet = areaSquareMeters * 10.7639; // 1 m² = 10.7639 ft²

  return areaSquareFeet;
}

// ============================================
// SLOPE CALCULATIONS
// ============================================

/**
 * Calculate slope percentage between two points
 */
export function calculateSlope(p1: Point3D, p2: Point3D): number {
  const horizontalDistance = calculateHorizontalDistance(p1, p2);
  const verticalRise = p2.y - p1.y;

  if (horizontalDistance === 0) return 0;

  const slope = (verticalRise / horizontalDistance) * 100;
  return Math.round(slope * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate slope angle in degrees
 */
export function calculateSlopeAngle(p1: Point3D, p2: Point3D): number {
  const horizontalDistance = calculateHorizontalDistance(p1, p2);
  const verticalRise = p2.y - p1.y;

  if (horizontalDistance === 0) return 0;

  const angleRadians = Math.atan(verticalRise / horizontalDistance);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  return Math.round(angleDegrees * 100) / 100;
}

// ============================================
// ANGLE CALCULATIONS
// ============================================

/**
 * Calculate angle between three points (in degrees)
 * p1 - p2 - p3, where p2 is the vertex
 */
export function calculateAngle(p1: Point3D, p2: Point3D, p3: Point3D): number {
  // Vectors from p2 to p1 and p2 to p3
  const v1 = {
    x: p1.x - p2.x,
    y: p1.y - p2.y,
    z: p1.z - p2.z,
  };

  const v2 = {
    x: p3.x - p2.x,
    y: p3.y - p2.y,
    z: p3.z - p2.z,
  };

  // Dot product
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

  // Magnitudes
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 0;

  // Angle in radians
  const angleRadians = Math.acos(dotProduct / (mag1 * mag2));

  // Convert to degrees
  const angleDegrees = (angleRadians * 180) / Math.PI;

  return Math.round(angleDegrees * 100) / 100;
}

/**
 * Check if angle is approximately 90 degrees (within tolerance)
 */
export function isRightAngle(angle: number, tolerance = 5): boolean {
  return Math.abs(angle - 90) <= tolerance;
}

/**
 * Check if angle is approximately 45 degrees
 */
export function is45Angle(angle: number, tolerance = 5): boolean {
  return Math.abs(angle - 45) <= tolerance || Math.abs(angle - 135) <= tolerance;
}

// ============================================
// SNAPPING & ALIGNMENT
// ============================================

/**
 * Snap angle to nearest increment (90°, 45°, etc.)
 */
export function snapAngle(angle: number, increment = 45): number {
  return Math.round(angle / increment) * increment;
}

/**
 * Snap point to grid
 */
export function snapToGrid(point: Point3D, gridSize: number): Point3D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
    z: Math.round(point.z / gridSize) * gridSize,
  };
}

// ============================================
// CALIBRATION
// ============================================

/**
 * Calculate calibration factor
 */
export function calculateCalibrationFactor(
  knownLength: number,
  measuredLength: number
): number {
  if (measuredLength === 0) return 1.0;
  return knownLength / measuredLength;
}

/**
 * Apply calibration to a measurement
 */
export function applyCalibration(
  measurement: number,
  calibration?: CalibrationData
): number {
  if (!calibration) return measurement;
  return measurement * calibration.factor;
}

/**
 * Estimate accuracy based on confidence score and distance
 */
export function estimateAccuracy(confidence: number, distance: number): number {
  // Base accuracy for LiDAR at 1m = 0.5cm
  // Decreases with distance and lower confidence

  const baseAccuracy = 0.5; // cm at 1m with perfect confidence
  const distanceMeters = feetToMeters(distance);

  // Accuracy degrades with distance and low confidence
  const distanceFactor = Math.sqrt(distanceMeters);
  const confidenceFactor = 1 + (1 - confidence) * 2; // 1-3x depending on confidence

  const estimatedAccuracyCm = baseAccuracy * distanceFactor * confidenceFactor;

  return Math.round(estimatedAccuracyCm * 10) / 10; // Round to 1 decimal
}

// ============================================
// BOUNDING BOX
// ============================================

/**
 * Calculate bounding box for a set of points
 */
export function calculateBoundingBox(points: Point3D[]): BoundingBox | null {
  if (points.length === 0) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z);

  const min: Point3D = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    z: Math.min(...zs),
  };

  const max: Point3D = {
    x: Math.max(...xs),
    y: Math.max(...ys),
    z: Math.max(...zs),
  };

  const center: Point3D = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };

  return {
    min,
    max,
    center,
    width: max.x - min.x,
    height: max.y - min.y,
    depth: max.z - min.z,
  };
}

/**
 * Calculate bounding box for all segments in a project
 */
export function calculateProjectBounds(project: FenceProject): BoundingBox | null {
  if (!project.segments || project.segments.length === 0) return null;

  const allPoints: Point3D[] = [];
  project.segments.forEach(segment => {
    allPoints.push(segment.start, segment.end);
  });

  return calculateBoundingBox(allPoints);
}

// ============================================
// PROJECT SUMMARY CALCULATIONS
// ============================================

/**
 * Calculate project summary statistics
 */
export function calculateProjectSummary(project: FenceProject): {
  totalLinearFeet: number;
  totalAreaSqft: number;
  avgConfidence: number;
  estimatedAccuracyCm: number;
  perimeter: number;
  boundingBox: BoundingBox | null;
} {
  const segments = project.segments || [];

  const totalLinearFeet = calculateTotalLength(segments);
  const totalAreaSqft = calculateEnclosedArea(segments);
  const perimeter = calculatePerimeter(segments);

  const avgConfidence =
    segments.length > 0
      ? segments.reduce((sum, seg) => sum + seg.confidenceScore, 0) / segments.length
      : 0;

  const estimatedAccuracyCm = estimateAccuracy(avgConfidence, totalLinearFeet);
  const boundingBox = calculateProjectBounds(project);

  return {
    totalLinearFeet,
    totalAreaSqft,
    avgConfidence,
    estimatedAccuracyCm,
    perimeter,
    boundingBox,
  };
}

// ============================================
// MATERIAL ESTIMATES (Basic BOM)
// ============================================

export interface MaterialEstimate {
  posts: number;
  pickets: number;
  rails: number;
  concreteBags: number;
  gateHardwareSets: number;
}

/**
 * Calculate basic material estimates
 */
export function calculateMaterialEstimate(
  project: FenceProject,
  postSpacingFeet = 8,
  picketWidthInches = 6,
  picketSpacingInches = 0.5,
  railsPerSection = 3
): MaterialEstimate {
  const totalFeet = project.totalLinearFeet;
  const numGates = project.numGates || 0;

  // Posts: one every X feet + corners + gates
  const posts = Math.ceil(totalFeet / postSpacingFeet) + numGates * 2;

  // Pickets: fence length / (picket width + spacing)
  const picketPitch = picketWidthInches + picketSpacingInches;
  const picketsPerFoot = 12 / picketPitch;
  const pickets = Math.ceil(totalFeet * picketsPerFoot);

  // Rails: typically 2-3 per section
  const numSections = Math.ceil(totalFeet / postSpacingFeet);
  const rails = numSections * railsPerSection;

  // Concrete: 1 bag per post (50lb bags)
  const concreteBags = posts;

  // Gate hardware sets
  const gateHardwareSets = numGates;

  return {
    posts,
    pickets,
    rails,
    concreteBags,
    gateHardwareSets,
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate segment data
 */
export function validateSegment(segment: Partial<FenceSegment>): string[] {
  const errors: string[] = [];

  if (!segment.start) {
    errors.push('Segment must have start point');
  }

  if (!segment.end) {
    errors.push('Segment must have end point');
  }

  if (segment.lengthFeet !== undefined && segment.lengthFeet <= 0) {
    errors.push('Segment length must be positive');
  }

  if (segment.confidenceScore !== undefined) {
    if (segment.confidenceScore < 0 || segment.confidenceScore > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }
  }

  return errors;
}

/**
 * Validate project data
 */
export function validateProject(project: Partial<FenceProject>): string[] {
  const errors: string[] = [];

  if (!project.projectName || project.projectName.trim() === '') {
    errors.push('Project name is required');
  }

  if (!project.clientName || project.clientName.trim() === '') {
    errors.push('Client name is required');
  }

  if (!project.siteAddress || project.siteAddress.trim() === '') {
    errors.push('Site address is required');
  }

  return errors;
}

// ============================================
// EXPORTS
// ============================================

export default {
  calculateDistance3D,
  calculateDistance2D,
  calculateHorizontalDistance,
  metersToFeet,
  feetToMeters,
  feetToInches,
  inchesToFeet,
  feetToDimensions,
  dimensionsToFeet,
  formatDimensions,
  calculateSegmentLength,
  calculateTotalLength,
  calculatePerimeter,
  calculateEnclosedArea,
  calculateSlope,
  calculateSlopeAngle,
  calculateAngle,
  isRightAngle,
  is45Angle,
  snapAngle,
  snapToGrid,
  calculateCalibrationFactor,
  applyCalibration,
  estimateAccuracy,
  calculateBoundingBox,
  calculateProjectBounds,
  calculateProjectSummary,
  calculateMaterialEstimate,
  validateSegment,
  validateProject,
};
