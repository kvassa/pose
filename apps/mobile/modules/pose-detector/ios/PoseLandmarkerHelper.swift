import CoreMedia
import CoreVideo
import Foundation
import MediaPipeTasksVision
import UIKit

final class PoseLandmarkerHelper {
  static let shared = PoseLandmarkerHelper()

  private let lock = NSLock()
  private var landmarker: PoseLandmarker?
  private var lastTimestampMs = 0
  private let ciContext = CIContext(options: nil)

  private init() {
    setupLandmarker()
  }

  private static func modelPath() -> String? {
    let bundles = [Bundle(for: PoseLandmarkerHelper.self), Bundle.main]

    for bundle in bundles {
      if let modelsBundlePath = bundle.path(forResource: "PoseDetectorModels", ofType: "bundle"),
         let modelsBundle = Bundle(path: modelsBundlePath),
         let path = modelsBundle.path(forResource: "pose_landmarker_lite", ofType: "task") {
        return path
      }

      if let path = bundle.path(forResource: "pose_landmarker_lite", ofType: "task") {
        return path
      }
    }

    return nil
  }

  private func setupLandmarker() {
    guard let modelPath = Self.modelPath() else { return }

    let options = PoseLandmarkerOptions()
    options.baseOptions.modelAssetPath = modelPath
    options.runningMode = .video
    options.numPoses = 1
    options.minPoseDetectionConfidence = 0.3
    options.minPosePresenceConfidence = 0.3
    options.minTrackingConfidence = 0.3

    do {
      landmarker = try PoseLandmarker(options: options)
    } catch {
      landmarker = nil
    }
  }

  func isReady() -> Bool {
    landmarker != nil
  }

  private func nextTimestampMs(from sampleBuffer: CMSampleBuffer) -> Int {
    let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let ms = max(0, Int((pts.seconds * 1000.0).rounded()))
    if ms > lastTimestampMs {
      lastTimestampMs = ms
      return ms
    }
    lastTimestampMs += 33
    return lastTimestampMs
  }

  private func landmarksToFlatArray(_ landmarks: [NormalizedLandmark]) -> [NSNumber] {
    landmarks.flatMap { landmark in
      let visibility = landmark.visibility ?? landmark.presence ?? 1.0
      return [
        NSNumber(value: Double(landmark.x)),
        NSNumber(value: Double(landmark.y)),
        NSNumber(value: Double(landmark.z)),
        NSNumber(value: Double(visibility)),
      ]
    }
  }

  private func detect(mpImage: MPImage, timestampMs: Int) -> [NSNumber]? {
    guard let landmarker else { return nil }

    do {
      let result = try landmarker.detect(videoFrame: mpImage, timestampInMilliseconds: timestampMs)
      guard let landmarks = result.landmarks.first, landmarks.count == 33 else { return nil }
      return landmarksToFlatArray(landmarks)
    } catch {
      return nil
    }
  }

  private func isBgra(_ pixelBuffer: CVPixelBuffer) -> Bool {
    let format = CVPixelBufferGetPixelFormatType(pixelBuffer)
    return format == kCVPixelFormatType_32BGRA || format == kCVPixelFormatType_Lossy_32BGRA
  }

  private func convertToBgra(_ source: CVPixelBuffer) -> CVPixelBuffer? {
    let width = CVPixelBufferGetWidth(source)
    let height = CVPixelBufferGetHeight(source)
    var destination: CVPixelBuffer?
    let attrs: [String: Any] = [
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32BGRA,
      attrs as CFDictionary,
      &destination
    )
    guard status == kCVReturnSuccess, let destination else { return nil }

    ciContext.render(CIImage(cvPixelBuffer: source), to: destination)
    return destination
  }

  private func mpImage(
    from sampleBuffer: CMSampleBuffer,
    orientation: UIImage.Orientation
  ) -> MPImage? {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return nil }

    if isBgra(pixelBuffer) {
      if let mpImage = try? MPImage(sampleBuffer: sampleBuffer, orientation: orientation) {
        return mpImage
      }
      if let mpImage = try? MPImage(pixelBuffer: pixelBuffer, orientation: orientation) {
        return mpImage
      }
    }

    guard let bgraBuffer = convertToBgra(pixelBuffer) else { return nil }
    return try? MPImage(pixelBuffer: bgraBuffer, orientation: orientation)
  }

  private func mpImage(from image: UIImage) -> MPImage? {
    try? MPImage(uiImage: image)
  }

  func detect(
    sampleBuffer: CMSampleBuffer,
    orientation: UIImage.Orientation,
    isMirrored: Bool
  ) -> [NSNumber]? {
    lock.lock()
    defer { lock.unlock() }

    let adjustedOrientation = Self.adjustedOrientation(orientation, isMirrored: isMirrored)
    guard let mpImage = mpImage(from: sampleBuffer, orientation: adjustedOrientation) else { return nil }
    return detect(mpImage: mpImage, timestampMs: nextTimestampMs(from: sampleBuffer))
  }

  func detect(image: UIImage) -> [NSNumber]? {
    lock.lock()
    defer { lock.unlock() }

    guard let mpImage = mpImage(from: image) else { return nil }
    lastTimestampMs += 33
    return detect(mpImage: mpImage, timestampMs: lastTimestampMs)
  }

  private static func adjustedOrientation(
    _ orientation: UIImage.Orientation,
    isMirrored: Bool
  ) -> UIImage.Orientation {
    guard isMirrored else { return orientation }

    switch orientation {
    case .up: return .upMirrored
    case .down: return .downMirrored
    case .left: return .leftMirrored
    case .right: return .rightMirrored
    case .upMirrored: return .up
    case .downMirrored: return .down
    case .leftMirrored: return .right
    case .rightMirrored: return .left
    @unknown default: return orientation
    }
  }
}
