import ExpoModulesCore
import Vision
import Photos
import CoreGraphics
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

    // Reliable brightness read for "is this frame black / single-colour junk?".
    // Reads the LOCAL thumbnail (always present, even for iCloud-optimised photos
    // — no download), decoded by Apple's pipeline (handles HEIC), then computes
    // mean luminance + tonal range (max-min), 0-255. The Skia path was returning
    // null for these photos; this does not. Resolves null only if the asset or
    // its thumbnail truly can't be read.
    AsyncFunction("imageLuminanceAsync") { (assetId: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.imageLuminance(assetId: assetId, promise: promise)
      }
    }
  }

  private func imageLuminance(assetId: String, promise: Promise) {
    let localId = assetId.hasPrefix("ph://") ? String(assetId.dropFirst(5)) : assetId
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
    guard let asset = fetch.firstObject else {
      promise.resolve(NSNull())
      return
    }

    let options = PHImageRequestOptions()
    options.deliveryMode = .fastFormat        // local thumbnail, fast
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = false    // never wait on iCloud — thumb is local
    options.isSynchronous = true

    var resolved = false
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: 32, height: 32),
      contentMode: .aspectFill,
      options: options
    ) { image, _ in
      if !resolved, let cgImage = image?.cgImage, let stats = self.luminanceStats(cgImage) {
        resolved = true
        promise.resolve(stats)
      }
    }
    if !resolved {
      promise.resolve(NSNull())
    }
  }

  // Mean luminance + (max-min) range across a small decoded thumbnail.
  private func luminanceStats(_ cgImage: CGImage) -> [String: Any]? {
    let width = min(cgImage.width, 32)
    let height = min(cgImage.height, 32)
    guard width > 0, height > 0 else { return nil }

    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

    var sum = 0.0
    var minL = 255.0
    var maxL = 0.0
    let count = width * height
    for i in 0..<count {
      let r = Double(pixels[i * 4])
      let g = Double(pixels[i * 4 + 1])
      let b = Double(pixels[i * 4 + 2])
      let l = 0.299 * r + 0.587 * g + 0.114 * b
      sum += l
      if l < minL { minL = l }
      if l > maxL { maxL = l }
    }
    if count == 0 { return nil }
    return ["meanLuminance": sum / Double(count), "luminanceRange": maxL - minL]
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
