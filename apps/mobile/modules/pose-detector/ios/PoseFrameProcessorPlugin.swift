import UIKit
import VisionCamera

@objc(PoseFrameProcessorPlugin)
public class PoseFrameProcessorPlugin: FrameProcessorPlugin {
  public override func callback(_ frame: Frame, withArguments _: [AnyHashable: Any]?) -> Any? {
    return PoseLandmarkerHelper.shared.detect(sampleBuffer: frame.buffer)
  }
}
