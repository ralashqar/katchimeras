require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'KatchimeraMapSearch'
  s.version = package['version']
  s.summary = 'Apple Maps local place search for journal location suggestions.'
  s.description = 'Grounds an extracted journal place name with MKLocalSearch. Search results stay ephemeral until the user confirms a location.'
  s.license = 'UNLICENSED'
  s.author = 'Katchimeras'
  s.homepage = 'https://example.invalid/katchimeras'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'CoreLocation'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
