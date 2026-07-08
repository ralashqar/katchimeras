import ExpoModulesCore
import Vision
import Photos
import CoreGraphics
import UIKit
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

    // Resized JPEG (base64) of a photo, for the day-comic generator — reliable
    // where Skia/JS can't read HEIC / iCloud photos (Apple decode, downloads from
    // iCloud if needed since this is a deliberate share action). Returns null when
    // the asset or its image can't be read.
    AsyncFunction("thumbnailBase64Async") { (assetId: String, maxSize: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.thumbnailBase64(assetId: assetId, maxSize: maxSize, promise: promise)
      }
    }

    // Combines several photos into ONE grid image (JPEG base64) — for sending the
    // comic generator a single combined reference instead of N separate ones.
    AsyncFunction("combineThumbnailsBase64Async") { (assetIds: [String], maxSize: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.combineThumbnails(assetIds: assetIds, maxSize: maxSize, promise: promise)
      }
    }
  }

  // Synchronous PHAsset → UIImage (downloads from iCloud if needed). Shared by the
  // single-thumbnail and the grid functions.
  private func loadThumbnailUIImage(assetId: String, maxSize: Int) -> UIImage? {
    let localId = assetId.hasPrefix("ph://") ? String(assetId.dropFirst(5)) : assetId
    let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil)
    guard let asset = fetch.firstObject else {
      return nil
    }
    let options = PHImageRequestOptions()
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = true   // a share artifact — OK to fetch from iCloud
    options.isSynchronous = true
    let side = CGFloat(min(max(maxSize, 64), 1536))
    var result: UIImage?
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: side, height: side),
      contentMode: .aspectFit,
      options: options
    ) { image, _ in
      if result == nil, let image = image {
        result = image
      }
    }
    return result
  }

  private func thumbnailBase64(assetId: String, maxSize: Int, promise: Promise) {
    if let image = loadThumbnailUIImage(assetId: assetId, maxSize: maxSize),
       let data = image.jpegData(compressionQuality: 0.72) {
      promise.resolve(data.base64EncodedString())
    } else {
      promise.resolve(NSNull())
    }
  }

  private func combineThumbnails(assetIds: [String], maxSize: Int, promise: Promise) {
    var images: [UIImage] = []
    for assetId in assetIds.prefix(9) {
      if let image = loadThumbnailUIImage(assetId: assetId, maxSize: maxSize) {
        images.append(image)
      }
    }
    guard !images.isEmpty else {
      promise.resolve(NSNull())
      return
    }

    let count = images.count
    let cols = Int(ceil(Double(count).squareRoot()))
    let rows = Int(ceil(Double(count) / Double(cols)))
    let cell = CGFloat(min(max(maxSize, 256), 1536)) / CGFloat(cols)
    let canvas = CGSize(width: cell * CGFloat(cols), height: cell * CGFloat(rows))

    let renderer = UIGraphicsImageRenderer(size: canvas)
    let combined = renderer.image { context in
      UIColor.white.setFill()
      context.fill(CGRect(origin: .zero, size: canvas))
      for (index, image) in images.enumerated() {
        let column = index % cols
        let row = index / cols
        let rect = CGRect(x: CGFloat(column) * cell, y: CGFloat(row) * cell, width: cell, height: cell)
        // Aspect-fill each cell (scale to cover, clip the overflow).
        let scale = max(rect.width / image.size.width, rect.height / image.size.height)
        let drawnWidth = image.size.width * scale
        let drawnHeight = image.size.height * scale
        let drawRect = CGRect(
          x: rect.midX - drawnWidth / 2,
          y: rect.midY - drawnHeight / 2,
          width: drawnWidth,
          height: drawnHeight
        )
        context.cgContext.saveGState()
        context.cgContext.clip(to: rect)
        image.draw(in: drawRect)
        context.cgContext.restoreGState()
      }
    }

    if let data = combined.jpegData(compressionQuality: 0.78) {
      promise.resolve(data.base64EncodedString())
    } else {
      promise.resolve(NSNull())
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
