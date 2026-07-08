require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KatchimeraFoundation'
  s.version = package['version']
  s.summary = 'On-device Apple Foundation Models meaning suggestions for Katchimeras.'
  s.description = 'Turns a photo\'s on-device vision tags into fitting "what did this mean" options using the iOS 26 Foundation Models on-device LLM. Falls back to rules on older devices.'
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
