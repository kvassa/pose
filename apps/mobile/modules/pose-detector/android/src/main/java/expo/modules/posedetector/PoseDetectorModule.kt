package expo.modules.posedetector

import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PoseDetectorModule : Module() {
  companion object {
  @Volatile
    private var isPluginRegistered = false
  }

  override fun definition() = ModuleDefinition {
    Name("PoseDetector")

    OnCreate {
      if (!isPluginRegistered) {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { _, _ ->
          PoseFrameProcessorPlugin(appContext)
        }
        isPluginRegistered = true
      }
    }

    AsyncFunction("detect") { imageBytes: ByteArray ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      PoseLandmarkerHelper.detect(context, imageBytes)
    }
  }
}
