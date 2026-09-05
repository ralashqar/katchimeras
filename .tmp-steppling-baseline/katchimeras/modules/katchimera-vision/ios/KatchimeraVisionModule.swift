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
    let faceRequest = VNDetectFaceRectanglesRequest()
    let animalRequest = VNRecognizeAnimalsRequest()
    let humanRequest = VNDetectHumanRectanglesRequest()
    humanRequest.upperBodyOnly = false
    let saliencyRequest = VNGenerateAttentionBasedSaliencyImageRequest()

    do {
      // Keep the universal pass visual-only and quick. Accurate OCR is much
      // slower and is added below only for document/media candidates.
      try handler.perform([classifyRequest, faceRequest, animalRequest, humanRequest, saliencyRequest])
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
    var recognizedText: [[String: Any]] = []
    let labelsSuggestText = shouldRunTextRecognition(labels)
    // Classifier labels are unreliable for typographic covers: a close book
    // can be labelled textile/tableware and would previously skip OCR entirely.
    // Probe every image cheaply, then use accurate recognition for known text
    // candidates. This keeps ordinary photos fast while allowing visible title
    // text to rescue a missed book/document classification.
    do {
      let textRequest = VNRecognizeTextRequest()
      textRequest.recognitionLevel = labelsSuggestText ? .accurate : .fast
      textRequest.usesLanguageCorrection = labelsSuggestText
      try handler.perform([textRequest])
      if let observations = textRequest.results {
        recognizedText = observations.compactMap { observation in
          guard let candidate = observation.topCandidates(1).first else { return nil }
          return [
            "text": candidate.string,
            "confidence": Double(candidate.confidence),
            "region": regionDictionary(observation.boundingBox, confidence: candidate.confidence)
          ]
        }
        text = recognizedText.compactMap { $0["text"] as? String }
      }
    } catch {
      text = []
      recognizedText = []
    }

    var faceCount = 0
    var faces: [[String: Any]] = []
    if let observations = faceRequest.results {
      faceCount = observations.count
      faces = observations.map { regionDictionary($0.boundingBox, confidence: $0.confidence) }
    }

    var animals: [[String: Any]] = []
    if let observations = animalRequest.results {
      animals = observations.compactMap { observation in
        guard let label = observation.labels.first else { return nil }
        let identifier = label.identifier.lowercased()
        let kind = identifier.contains("dog") ? "dog" : identifier.contains("cat") ? "cat" : "unknown"
        return [
          "kind": kind,
          "confidence": Double(label.confidence),
          "region": regionDictionary(observation.boundingBox, confidence: label.confidence)
        ]
      }
    }

    let humanCount = humanRequest.results?.count ?? 0
    let humans = humanRequest.results?.map { regionDictionary($0.boundingBox, confidence: $0.confidence) } ?? []
    var dominantSubject: [String: Any]? = nil
    let salientSubjects = saliencyRequest.results?.first?.salientObjects?.prefix(4).map {
      regionDictionary($0.boundingBox, confidence: $0.confidence)
    } ?? []
    // Whole-image labels cannot tell us whether "book" belongs to the large
    // foreground object or a shelf in the background. Classify the strongest
    // salient regions independently so JS can compare like-for-like subject
    // prominence without category-specific precedence rules.
    let salientObjects = Array(saliencyRequest.results?.first?.salientObjects?.prefix(3) ?? [])
    var regionClassifications: [[String: Any]] = []
    // A single salient object is already represented by the whole-image pass.
    // Only pay for crop classification when spatial competition is possible.
    if salientObjects.count >= 2 {
      let regionRequests = salientObjects.map { object -> VNClassifyImageRequest in
        let request = VNClassifyImageRequest()
        request.regionOfInterest = object.boundingBox
        return request
      }
      do {
        try handler.perform(regionRequests)
        regionClassifications = zip(salientObjects, regionRequests).compactMap { pair in
          let (object, request) = pair
          let regionLabels: [[String: Any]] = (request.results ?? [])
            .filter { $0.confidence >= 0.1 }
            .prefix(6)
            .map { ["name": $0.identifier, "confidence": Double($0.confidence)] }
          guard !regionLabels.isEmpty else { return nil }
          return [
            "region": regionDictionary(object.boundingBox, confidence: object.confidence),
            "labels": regionLabels
          ]
        }
      } catch {
        regionClassifications = []
      }
    }
    if let object = saliencyRequest.results?.first?.salientObjects?.first {
      let box = object.boundingBox
      dominantSubject = [
        "x": Double(box.origin.x),
        "y": Double(box.origin.y),
        "width": Double(box.size.width),
        "height": Double(box.size.height),
        "confidence": Double(object.confidence)
      ]
    }

    var documentDetected = false
    if #available(iOS 15.0, *), shouldRunDocumentDetection(labels) || recognizedText.count >= 2 {
      let documentRequest = VNDetectDocumentSegmentationRequest()
      do {
        try handler.perform([documentRequest])
        documentDetected = !(documentRequest.results?.isEmpty ?? true)
      } catch {
        documentDetected = false
      }
    }

    promise.resolve([
      "labels": labels,
      "text": text,
      "recognizedText": recognizedText,
      "faceCount": faceCount,
      "faces": faces,
      "humanCount": humanCount,
      "humans": humans,
      "animals": animals,
      "dominantSubject": dominantSubject ?? NSNull(),
      "salientSubjects": salientSubjects,
      "regionClassifications": regionClassifications,
      "documentDetected": documentDetected
    ])
  }

  private func shouldRunTextRecognition(_ labels: [[String: Any]]) -> Bool {
    let text = labels.compactMap { $0["name"] as? String }.joined(separator: " ").lowercased()
    let cues = [
      "book", "publication", "document", "paper", "page", "text", "receipt",
      "menu", "sign", "poster", "screen", "television", "monitor", "album",
      "magazine", "newspaper", "whiteboard", "label", "art", "artwork",
      "painting", "drawing", "illustration", "canvas", "package", "box"
    ]
    return cues.contains { text.contains($0) }
  }

  private func shouldRunDocumentDetection(_ labels: [[String: Any]]) -> Bool {
    let text = labels.compactMap { $0["name"] as? String }.joined(separator: " ").lowercased()
    let cues = ["book", "publication", "document", "paper", "page", "receipt", "menu", "poster", "magazine", "newspaper", "whiteboard"]
    return cues.contains { text.contains($0) }
  }

  private func regionDictionary(_ box: CGRect, confidence: VNConfidence) -> [String: Any] {
    return [
      "x": Double(box.origin.x),
      "y": Double(box.origin.y),
      "width": Double(box.size.width),
      "height": Double(box.size.height),
      "confidence": Double(confidence)
    ]
  }

  private func resolveURL(from uri: String) -> URL? {
    if let url = URL(string: uri), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private func emptyResult() -> [String: Any] {
    return ["labels": [], "text": [], "recognizedText": [], "faceCount": 0, "faces": [], "humanCount": 0, "humans": [], "animals": [], "salientSubjects": [], "regionClassifications": [], "documentDetected": false]
  }
}
