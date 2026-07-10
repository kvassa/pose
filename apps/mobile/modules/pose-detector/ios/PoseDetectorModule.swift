import ExpoModulesCore
import UIKit
import VisionCamera

public class PoseDetectorModule: Module {
  private static var isPluginRegistered = false

  public func definition() -> ModuleDefinition {
    Name("PoseDetector")

    OnCreate {
      if !PoseDetectorModule.isPluginRegistered {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, options in
          PoseFrameProcessorPlugin(proxy: proxy, options: options)
        }
        PoseDetectorModule.isPluginRegistered = true
      }
    }

    Function("isReady") {
      return PoseLandmarkerHelper.shared.isReady()
    }

    AsyncFunction("detect") { (imageData: Data) -> [NSNumber]? in
      guard let image = UIImage(data: imageData) else { return nil }
      return PoseLandmarkerHelper.shared.detect(image: image)
    }
  }
}
