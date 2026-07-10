require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PoseDetector'
  s.version        = package['version']
  s.summary        = 'On-device MediaPipe pose detection for Pose Match'
  s.license        = 'MIT'
  s.author         = 'Pose Match'
  s.homepage       = 'https://github.com/OmMistry25/pose'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'VisionCamera'
  s.dependency 'MediaPipeTasksVision', '0.10.14'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"

  model_source = File.expand_path('../assets/pose_landmarker_lite.task', __dir__)
  s.prepare_command = <<-CMD
    mkdir -p Resources
    cp -f "#{model_source}" Resources/pose_landmarker_lite.task
  CMD

  s.resource_bundles = {
    'PoseDetectorModels' => ['Resources/pose_landmarker_lite.task']
  }
end
