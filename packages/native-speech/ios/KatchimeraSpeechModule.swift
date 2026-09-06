import ExpoModulesCore
import Foundation
import Speech

// On-device voice-note transcription via Apple's Speech framework. Given the file
// URI of a short recorded clip it returns the transcript, recognised entirely on
// the device (the audio never leaves the phone). On older / unsupported devices
// it reports unavailable and resolves "", and JS falls back to the server path.
public final class KatchimeraSpeechModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KatchimeraSpeech")

    Function("isAvailable") { () -> Bool in
      guard let recognizer = SFSpeechRecognizer() else { return false }
      if #available(iOS 13.0, *) {
        return recognizer.isAvailable && recognizer.supportsOnDeviceRecognition
      }
      return false
    }

    AsyncFunction("requestPermissionsAsync") { (promise: Promise) in
      SFSpeechRecognizer.requestAuthorization { status in
        switch status {
        case .authorized: promise.resolve("granted")
        case .denied: promise.resolve("denied")
        case .restricted: promise.resolve("restricted")
        case .notDetermined: promise.resolve("undetermined")
        @unknown default: promise.resolve("undetermined")
        }
      }
    }

    AsyncFunction("transcribeFileAsync") { (uri: String, locale: String, promise: Promise) in
      guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
        promise.resolve("")
        return
      }
      let identifier = locale.isEmpty ? "en-US" : locale
      let recognizer = SFSpeechRecognizer(locale: Locale(identifier: identifier)) ?? SFSpeechRecognizer()
      guard let recognizer = recognizer, recognizer.isAvailable else {
        promise.resolve("")
        return
      }
      guard let url = Self.fileURL(from: uri) else {
        promise.resolve("")
        return
      }

      let request = SFSpeechURLRecognitionRequest(url: url)
      request.shouldReportPartialResults = false
      if #available(iOS 13.0, *) {
        // Keep it on-device when the model is present (audio stays local).
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
      }

      // Guard against the task resolving more than once.
      var settled = false
      recognizer.recognitionTask(with: request) { result, error in
        if settled { return }
        if let result = result, result.isFinal {
          settled = true
          promise.resolve(result.bestTranscription.formattedString)
        } else if error != nil {
          settled = true
          promise.resolve("")
        }
      }
    }
  }

  private static func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    return URL(string: uri)
  }
}
