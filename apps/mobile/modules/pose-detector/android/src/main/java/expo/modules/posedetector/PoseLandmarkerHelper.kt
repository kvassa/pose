package expo.modules.posedetector

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.ImageProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerOptions
import com.mrousavy.camera.frameprocessors.Frame
import java.io.ByteArrayOutputStream

object PoseLandmarkerHelper {
  private const val LANDMARK_COUNT = 33
  private var landmarker: PoseLandmarker? = null
  private val lock = Any()

  private fun ensureLandmarker(context: Context): PoseLandmarker? {
  synchronized(lock) {
      if (landmarker != null) return landmarker

      return try {
        val modelPath = copyModelAsset(context)
        val options = PoseLandmarkerOptions.builder()
          .setBaseOptions(BaseOptions.builder().setModelAssetPath(modelPath).build())
          .setRunningMode(RunningMode.IMAGE)
          .setNumPoses(1)
          .build()
        PoseLandmarker.createFromOptions(context, options).also { landmarker = it }
      } catch (_: Exception) {
        null
      }
    }
  }

  private fun copyModelAsset(context: Context): String {
    val fileName = "pose_landmarker_lite.task"
    val outFile = java.io.File(context.cacheDir, fileName)
    if (!outFile.exists()) {
      context.assets.open(fileName).use { input ->
        outFile.outputStream().use { output -> input.copyTo(output) }
      }
    }
    return outFile.absolutePath
  }

  fun detect(context: Context, bitmap: Bitmap): List<Map<String, Any>>? {
    val detector = ensureLandmarker(context) ?: return null
    synchronized(lock) {
      return try {
        val mpImage = BitmapImageBuilder(bitmap).build()
        val result = detector.detect(mpImage)
        val landmarks = result.landmarks().firstOrNull() ?: return null
        if (landmarks.size != LANDMARK_COUNT) return null
        landmarks.map { landmark ->
          val visibility = landmark.visibility().orElse(landmark.presence().orElse(1.0f)).toDouble()
          mapOf(
            "x" to landmark.x().toDouble(),
            "y" to landmark.y().toDouble(),
            "z" to landmark.z().toDouble(),
            "visibility" to visibility,
          )
        }
      } catch (_: Exception) {
        null
      }
    }
  }

  fun detect(context: Context, imageBytes: ByteArray): List<Map<String, Any>>? {
    val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size) ?: return null
  return detect(context, bitmap)
  }

  fun detect(context: Context, frame: Frame): List<Map<String, Any>>? {
    val bitmap = PoseImageUtils.toBitmap(frame) ?: return null
    return detect(context, bitmap)
  }
}

object PoseImageUtils {
  fun toBitmap(frame: Frame): Bitmap? {
    return try {
      val imageProxy = frame.imageProxy
      val image = imageProxy.image ?: return null
      if (image.format != ImageFormat.YUV_420_888) return null

      val yBuffer = image.planes[0].buffer
      val uBuffer = image.planes[1].buffer
      val vBuffer = image.planes[2].buffer

      val ySize = yBuffer.remaining()
      val uSize = uBuffer.remaining()
      val vSize = vBuffer.remaining()

      val nv21 = ByteArray(ySize + uSize + vSize)
      yBuffer.get(nv21, 0, ySize)
      vBuffer.get(nv21, ySize, vSize)
      uBuffer.get(nv21, ySize + vSize, uSize)

      val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
      val out = ByteArrayOutputStream()
      yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 90, out)
      val jpegBytes = out.toByteArray()
      BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
    } catch (_: Exception) {
      null
    }
  }
}
