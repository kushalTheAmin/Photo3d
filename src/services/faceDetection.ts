import { FaceDetectionResult, FaceLandmark, FaceBoundingBox } from '../types';

/**
 * Face Detection Service
 *
 * This service handles face detection and landmark extraction.
 * It integrates with the backend ML service for accurate face analysis.
 *
 * For maximum face preservation, we use:
 * - 468 facial landmarks (MediaPipe Face Mesh standard)
 * - High-resolution bounding box detection
 * - Depth estimation for 3D positioning
 */

interface FaceMeshLandmarks {
  landmarks: FaceLandmark[];
  faceOval: number[];
  leftEye: number[];
  rightEye: number[];
  leftEyebrow: number[];
  rightEyebrow: number[];
  nose: number[];
  lips: number[];
  lipsUpperOuter: number[];
  lipsLowerOuter: number[];
  lipsUpperInner: number[];
  lipsLowerInner: number[];
}

class FaceDetectionService {
  private static readonly FACE_MESH_LANDMARK_COUNT = 468;

  // Key landmark indices for face mesh
  private static readonly LANDMARK_INDICES = {
    noseTip: 1,
    leftEyeInner: 133,
    leftEyeOuter: 33,
    rightEyeInner: 362,
    rightEyeOuter: 263,
    leftMouthCorner: 61,
    rightMouthCorner: 291,
    chinBottom: 152,
    foreheadTop: 10,
    leftCheek: 234,
    rightCheek: 454,
  };

  /**
   * Validate if a face is suitable for 3D model generation
   */
  validateFaceForProcessing(result: FaceDetectionResult): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!result.detected) {
      issues.push('No face detected in the image');
      recommendations.push('Please upload a clear photo with a visible face');
      return { isValid: false, issues, recommendations };
    }

    // Check confidence threshold
    if (result.confidence < 0.8) {
      issues.push('Low face detection confidence');
      recommendations.push('Use better lighting and face the camera directly');
    }

    // Check face size relative to image
    if (result.boundingBox) {
      const faceArea = result.boundingBox.width * result.boundingBox.height;
      if (faceArea < 10000) {
        issues.push('Face is too small in the image');
        recommendations.push('Move closer to the camera or crop the image');
      }
    }

    // Check if essential landmarks are present
    if (result.landmarks) {
      if (!result.landmarks.leftEye || !result.landmarks.rightEye) {
        issues.push('Eyes not clearly visible');
        recommendations.push('Ensure both eyes are visible and not occluded');
      }
      if (!result.landmarks.nose) {
        issues.push('Nose not clearly visible');
        recommendations.push('Face the camera more directly');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Calculate face quality score for 3D reconstruction
   */
  calculateFaceQualityScore(result: FaceDetectionResult): number {
    if (!result.detected) return 0;

    let score = 0;
    const weights = {
      confidence: 0.3,
      landmarkCompleteness: 0.25,
      faceSize: 0.2,
      symmetry: 0.15,
      clarity: 0.1,
    };

    // Confidence score
    score += result.confidence * weights.confidence * 100;

    // Landmark completeness
    if (result.landmarks) {
      const landmarkCount = Object.values(result.landmarks).filter(
        (v) => v !== undefined
      ).length;
      const completeness = landmarkCount / 7; // 7 main landmark groups
      score += completeness * weights.landmarkCompleteness * 100;
    }

    // Face size score (assuming 1024x1024 image)
    if (result.boundingBox) {
      const optimalSize = 500; // Optimal face width in pixels
      const sizeRatio = Math.min(result.boundingBox.width / optimalSize, 1);
      score += sizeRatio * weights.faceSize * 100;
    }

    // Symmetry score (based on eye positions)
    if (result.landmarks?.leftEye && result.landmarks?.rightEye) {
      const eyeSymmetry = this.calculateEyeSymmetry(
        result.landmarks.leftEye,
        result.landmarks.rightEye
      );
      score += eyeSymmetry * weights.symmetry * 100;
    }

    // Base clarity score
    score += weights.clarity * 100;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate eye symmetry for quality assessment
   */
  private calculateEyeSymmetry(
    leftEye: FaceLandmark,
    rightEye: FaceLandmark
  ): number {
    // Calculate vertical alignment
    const yDiff = Math.abs(leftEye.y - rightEye.y);
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);

    if (eyeDistance === 0) return 0;

    const tiltRatio = yDiff / eyeDistance;
    // Perfect symmetry = 0 tilt, score decreases with tilt
    return Math.max(0, 1 - tiltRatio * 5);
  }

  /**
   * Extract face region for texture mapping
   */
  extractFaceRegion(
    boundingBox: FaceBoundingBox,
    padding: number = 0.2
  ): FaceBoundingBox {
    const paddingX = boundingBox.width * padding;
    const paddingY = boundingBox.height * padding;

    return {
      x: Math.max(0, boundingBox.x - paddingX),
      y: Math.max(0, boundingBox.y - paddingY),
      width: boundingBox.width + paddingX * 2,
      height: boundingBox.height + paddingY * 2,
    };
  }

  /**
   * Calculate optimal camera angle from landmarks
   */
  estimateFaceAngle(landmarks: {
    leftEye: FaceLandmark;
    rightEye: FaceLandmark;
    nose: FaceLandmark;
  }): { yaw: number; pitch: number; roll: number } {
    const { leftEye, rightEye, nose } = landmarks;

    // Calculate roll (head tilt)
    const eyeDeltaY = rightEye.y - leftEye.y;
    const eyeDeltaX = rightEye.x - leftEye.x;
    const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

    // Calculate yaw (left-right rotation)
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const noseDeltaX = nose.x - eyeMidX;
    const eyeDistance = Math.sqrt(eyeDeltaX ** 2 + eyeDeltaY ** 2);
    const yaw = (noseDeltaX / eyeDistance) * 45; // Approximate

    // Calculate pitch (up-down rotation)
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const noseDeltaY = nose.y - eyeMidY;
    const pitch = (noseDeltaY / eyeDistance) * 30; // Approximate

    return { yaw, pitch, roll };
  }

  /**
   * Check if face angle is suitable for 3D reconstruction
   */
  isFaceAngleSuitable(angle: {
    yaw: number;
    pitch: number;
    roll: number;
  }): { suitable: boolean; message: string } {
    const maxYaw = 30;
    const maxPitch = 25;
    const maxRoll = 20;

    if (Math.abs(angle.yaw) > maxYaw) {
      return {
        suitable: false,
        message: `Face is turned too far ${angle.yaw > 0 ? 'right' : 'left'}. Please face the camera more directly.`,
      };
    }

    if (Math.abs(angle.pitch) > maxPitch) {
      return {
        suitable: false,
        message: `Face is tilted too far ${angle.pitch > 0 ? 'down' : 'up'}. Please look straight at the camera.`,
      };
    }

    if (Math.abs(angle.roll) > maxRoll) {
      return {
        suitable: false,
        message: 'Head is tilted. Please keep your head level.',
      };
    }

    return { suitable: true, message: 'Face angle is suitable for processing.' };
  }

  /**
   * Generate UV coordinates for face texture mapping
   */
  generateFaceUVCoordinates(
    landmarks: FaceLandmark[],
    imageWidth: number,
    imageHeight: number
  ): { u: number; v: number }[] {
    return landmarks.map((landmark) => ({
      u: landmark.x / imageWidth,
      v: 1 - landmark.y / imageHeight, // Flip V for OpenGL convention
    }));
  }
}

export const faceDetectionService = new FaceDetectionService();
export default faceDetectionService;
