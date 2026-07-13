require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KatchimeraSemantic'
  s.version = package['version']
  s.summary = 'On-device Natural Language semantic fallback for Katchimeras.'
  s.description = 'Uses Apple Natural Language embeddings to map Vision labels and notes into canonical memory categories on devices without Foundation Models.'
  s.license = 'UNLICENSED'
  s.author = 'Katchimeras'
  s.homepage = 'https://example.invalid/katchimeras'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
