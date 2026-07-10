package expo.modules.posedetector

import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import expo.modules.kotlin.AppContext

class PoseFrameProcessorPlugin(private val appContext: AppContext) : FrameProcessorPlugin() {
  override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
    val context = appContext.reactContext ?: return null
    return PoseLandmarkerHelper.detect(context, frame)
  }
}
