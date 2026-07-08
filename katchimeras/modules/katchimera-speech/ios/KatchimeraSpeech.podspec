require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KatchimeraSpeech'
  s.version = package['version']
  s.summary = 'On-device Apple Speech transcription for Katchimera voice notes.'
  s.description = 'Transcribes short voice notes fully on-device with Apple\'s Speech framework (SFSpeechRecognizer). Audio never leaves the phone; JS falls back to the server path on older / unsupported devices.'
  s.license = 'UNLICENSED'
  s.author = 'Katchimeras'
  s.homepage = 'https://example.invalid/katchimeras'
  s.platforms = {
    :ios => '15.1'
  }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,swift}'
end
