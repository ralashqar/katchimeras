import ExpoModulesCore
import Vision
import Foundation

// On-device photo read with Apple's Vision framework: scene/object labels, OCR
// text, and a face count — all computed locally, nothing leaves the device.
// Mirrors the JS contract in utils/photo-vision.ts: analyzePhotoAsync(uri) ->
// { labels: [{ name, confidence }], text: [String], faceCount: Int }.
public final class KatchimeraVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KatchimeraVision")

    AsyncFunction("analyzePhotoAsync") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.analyzePhoto(uri: uri, promise: promise)
      }
    }
  }

  private func analyzePhoto(uri: String, promise: Promise) {
    guard let url = resolveURL(from: uri) else {
      promise.resolve(emptyResult())
      return
    }

    let handler = VNImageRequestHandler(url: url, options: [:])

    let classifyRequest = VNClassifyImageRequest()
    let textRequest = VNRecognizeTextRequest()
    textRequest.recognitionLevel = .fast
    textRequest.usesLanguageCorrection = false
    let faceRequest = VNDetectFaceRectanglesRequest()

    do {
      try handler.perform([classifyRequest, textRequest, faceRequest])
    } catch {
      promise.resolve(emptyResult())
      return
    }

    var labels: [[String: Any]] = []
    if let observations = classifyRequest.results {
      labels = observations
        .filter { $0.confidence >= 0.1 }
        .prefix(15)
        .map { ["name": $0.identifier, "confidence": Double($0.confidence)] }
    }

    var text: [String] = []
    if let observations = textRequest.results {
      text = observations.compactMap { $0.topCandidates(1).first?.string }
    }

    var faceCount = 0
    if let observations = faceRequest.results {
      faceCount = observations.count
    }

    promise.resolve([
      "labels": labels,
      "text": text,
      "faceCount": faceCount
    ])
  }

  private func resolveURL(from uri: String) -> URL? {
    if let url = URL(string: uri), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private func emptyResult() -> [String: Any] {
    return ["labels": [], "text": [], "faceCount": 0]
  }
}
