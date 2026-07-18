import ExpoModulesCore
import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

// On-device "what did this mean?" suggestions via Apple's Foundation Models
// (iOS 26+, Apple-Intelligence devices). Given the photo's on-device vision tags
// it returns up to four short options, each tied to one of four feeling
// archetypes (calm / energy / together / meaningful) so the JS side maps them
// straight onto its capture-energy model. Everything runs locally — the tags
// never leave the device. On any older device / unsupported state it reports
// unavailable and resolves [], and JS falls back to the rule-based set.
public final class KatchimeraFoundationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KatchimeraFoundation")

    Function("isAvailable") { () -> Bool in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        if case .available = SystemLanguageModel.default.availability {
          return true
        }
      }
      #endif
      return false
    }

    // Stable runtime-schema bridge. JavaScript supplies the prompt and a bounded
    // flat string/enum schema as JSON, so future task and output-shape changes do
    // not require another native build.
    AsyncFunction("generateStructuredAsync") { (requestJson: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          promise.resolve(await Self.generateStructured(requestJson: requestJson))
        }
        return
      }
      #endif
      promise.resolve(Self.structuredBridgeJson([
        "status": "unavailable",
        "errorCode": "framework_unavailable",
        "bridgeVersion": "1",
      ]))
    }

    // Preserve Apple's concrete availability reason for diagnostics and UI.
    // The boolean API above remains for compatibility with older JS bundles.
    Function("availabilityInfo") { () -> [String: String] in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        let model = SystemLanguageModel.default
        let locale = Locale.current
        let localeDetails = [
           "locale": locale.identifier,
           "localeSupported": model.supportsLocale(locale) ? "true" : "false",
           "noteSchemaVersion": JournalNoteRouteCatalog.schemaVersion,
          "photoSchemaVersion": JournalNoteRouteCatalog.photoSchemaVersion,
          "structuredBridgeVersion": "1",
        ]
        switch model.availability {
        case .available:
          return localeDetails.merging(["status": "available", "reason": "available"]) { _, new in new }
        case .unavailable(.appleIntelligenceNotEnabled):
          return localeDetails.merging(["status": "unavailable", "reason": "apple_intelligence_not_enabled"]) { _, new in new }
        case .unavailable(.deviceNotEligible):
          return localeDetails.merging(["status": "unavailable", "reason": "device_not_eligible"]) { _, new in new }
        case .unavailable(.modelNotReady):
          return localeDetails.merging(["status": "unavailable", "reason": "model_not_ready"]) { _, new in new }
        case .unavailable:
          return localeDetails.merging(["status": "unavailable", "reason": "unknown_unavailable_reason"]) { _, new in new }
        }
      }
      return ["status": "unavailable", "reason": "ios_version_unsupported"]
      #else
      return ["status": "unavailable", "reason": "framework_not_linked"]
      #endif
    }

    AsyncFunction("suggestMeaningsAsync") { (tags: [String], faceCount: Int, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let options = await Self.suggest(tags: tags, faceCount: faceCount)
          promise.resolve(options)
        }
        return
      }
      #endif
      promise.resolve([[String: String]]())
    }

    // Title + feeling for a voice-note transcript, fully on-device. Returns
    // { "label": ..., "archetype": ... } or {} on any failure → JS falls back.
    AsyncFunction("interpretNoteAsync") { (transcript: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.interpretNote(transcript: transcript)
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Focused route-only retry for a generic, ambiguous, or low-confidence first
    // pass. Kept separate so JS can enforce one shared latency budget and retain
    // both raw decisions in developer diagnostics.
    AsyncFunction("classifyNoteRouteAsync") { (transcript: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.classifyNoteRoute(transcript: transcript)
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Photo routing uses a runtime enum containing only routes supported by the
    // supplied Apple Vision evidence. It never reuses the note-prose classifier,
    // never maps numeric indexes, and never asks the model to invent confidence.
    AsyncFunction("classifyPhotoRouteAsync") { (evidence: String, candidateRouteKeys: [String], candidateDescriptions: [String], specificEvidenceKeys: [String], specificEvidenceDescriptions: [String], promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.classifyPhotoRoute(
            evidence: evidence,
            candidateRouteKeys: candidateRouteKeys,
            candidateDescriptions: candidateDescriptions,
            specificEvidenceKeys: specificEvidenceKeys,
            specificEvidenceDescriptions: specificEvidenceDescriptions
          )
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // A compact semantic pass between raw Vision evidence and journal routing.
    // Runtime string enums restrict the model to concept keys supplied by JS;
    // the result contains no route and no model-authored confidence.
    AsyncFunction("interpretPhotoSemanticsAsync") { (evidence: String, primaryEvidenceKeys: [String], backgroundEvidenceKeys: [String], evidenceDescriptions: [String], promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          promise.resolve(await Self.interpretPhotoSemantics(
            evidence: evidence,
            primaryEvidenceKeys: primaryEvidenceKeys,
            backgroundEvidenceKeys: backgroundEvidenceKeys,
            evidenceDescriptions: evidenceDescriptions
          ))
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Unified structured read used by the current intelligence pipeline. Sensitive
    // relationship and ownership fields are deliberately absent: those always
    // come from a user confirmation in the clarification graph.
    AsyncFunction("readMemoryAsync") { (tags: [String], ocrLines: [String], faceCount: Int, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.readMemory(tags: tags, ocrLines: ocrLines, faceCount: faceCount, spatialCandidates: [])
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Spatially-aware memory read. Kept as a separate bridge method so older
    // native clients continue to use readMemoryAsync without an arity mismatch.
    AsyncFunction("readMemoryV2Async") { (tags: [String], ocrLines: [String], faceCount: Int, spatialCandidates: [String], promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.readMemory(tags: tags, ocrLines: ocrLines, faceCount: faceCount, spatialCandidates: spatialCandidates)
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Photo schema v2 deliberately separates visual classification from OCR.
    // The first pass cannot see printed names or titles, so depicted text cannot
    // turn a book cover into a real-world People memory.
    AsyncFunction("classifyPhotoAnchorAsync") { (labels: [String], confidences: [Double], faceCount: Int, humanCount: Int, documentDetected: Bool, dominantSubjectCoverage: Double, spatialCandidates: [String], promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.classifyPhotoAnchor(
            labels: labels,
            confidences: confidences,
            faceCount: faceCount,
            humanCount: humanCount,
            documentDetected: documentDetected,
            dominantSubjectCoverage: dominantSubjectCoverage,
            spatialCandidates: spatialCandidates
          )
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // The second pass receives a locked route and can only identify or describe
    // that already-selected subject. Its schema contains no category field.
    AsyncFunction("enrichPhotoOcrAsync") { (routeKey: String, representation: String, container: String, visualSubject: String, ocrLines: [String], ocrConfidences: [Double], ocrRegions: [String], promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.enrichPhotoOcr(
            routeKey: routeKey,
            representation: representation,
            container: container,
            visualSubject: visualSubject,
            ocrLines: ocrLines,
            ocrConfidences: ocrConfidences,
            ocrRegions: ocrRegions
          )
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Stable photo-journal bridge. Candidate IDs, descriptions, task instructions,
    // and evidence are supplied by JavaScript; the native schema returns only
    // bounded candidate indexes. Taxonomy and prompt changes therefore do not
    // require another native rebuild.
    AsyncFunction("rankPhotoJournalCandidatesAsync") { (stage: String, taskInstructions: String, evidence: String, candidateIds: [String], candidateDescriptions: [String], routePrefix: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          promise.resolve(await Self.rankPhotoJournalCandidates(
            stage: stage,
            taskInstructions: taskInstructions,
            evidence: evidence,
            candidateIds: candidateIds,
            candidateDescriptions: candidateDescriptions,
            routePrefix: routePrefix.isEmpty ? nil : routePrefix
          ))
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Enrichment receives a user/model-selected journal route. Its generated
    // schema has no route field, so OCR can fill an editor but never reroute it.
    AsyncFunction("enrichPhotoJournalAsync") { (routeKey: String, fieldLabel: String, visualSubject: String, ocrLines: [String], ocrConfidences: [Double], ocrRegions: [String], taskInstructions: String, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          promise.resolve(await Self.enrichPhotoJournal(
            routeKey: routeKey,
            fieldLabel: fieldLabel,
            visualSubject: visualSubject,
            ocrLines: ocrLines,
            ocrConfidences: ocrConfidences,
            ocrRegions: ocrRegions,
            taskInstructions: taskInstructions
          ))
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Deep hierarchical scene read: classify the photo into ONE top-level scene
    // type, and — only when the photo is OF a work of media (a book cover, a
    // film poster, an album) — also identify the work from the OCR'd cover text
    // plus the model's own knowledge. Returns { type, subject, mediaKind, title,
    // creator } or {} on any failure → JS falls back. Nothing leaves the device.
    AsyncFunction("readSceneAsync") { (tags: [String], ocrLines: [String], faceCount: Int, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.readScene(tags: tags, ocrLines: ocrLines, faceCount: faceCount)
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }

    // Hierarchical scene read: from the photo's on-device vision tags, classify
    // the single best top-level scene type + a specific subject phrase. Returns
    // { "type": ..., "subject": ... } or {} on any failure → JS falls back to the
    // rule-based classifier. Tags never leave the device.
    AsyncFunction("classifySceneAsync") { (tags: [String], faceCount: Int, promise: Promise) in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        Task {
          let result = await Self.classifyScene(tags: tags, faceCount: faceCount)
          promise.resolve(result)
        }
        return
      }
      #endif
      promise.resolve([String: String]())
    }
  }

  #if canImport(FoundationModels)
  private struct StructuredBridgeRequest: Decodable {
    let bridgeVersion: Int
    let taskId: String
    let instructions: String
    let prompt: String
    let fields: [StructuredBridgeField]
  }

  private struct StructuredBridgeField: Decodable {
    let name: String
    let description: String
    let kind: String
    let values: [String]?
  }

  @available(iOS 26.0, *)
  private static func generateStructured(requestJson: String) async -> String {
    let startedAt = Date()
    guard case .available = SystemLanguageModel.default.availability else {
      return structuredBridgeJson(["status": "unavailable", "errorCode": "model_unavailable", "bridgeVersion": "1"])
    }
    guard requestJson.utf8.count <= 64_000,
          let data = requestJson.data(using: .utf8),
          let request = try? JSONDecoder().decode(StructuredBridgeRequest.self, from: data) else {
      return structuredBridgeJson(["status": "invalid_request", "errorCode": "request_decode_failed", "bridgeVersion": "1"])
    }
    guard request.bridgeVersion == 1,
          !request.taskId.isEmpty, request.taskId.count <= 80,
          !request.instructions.isEmpty, request.instructions.count <= 16_000,
          !request.prompt.isEmpty, request.prompt.count <= 32_000,
          !request.fields.isEmpty, request.fields.count <= 16 else {
      return structuredBridgeJson(["status": "invalid_request", "errorCode": "request_bounds_failed", "bridgeVersion": "1", "taskId": request.taskId])
    }
    let fieldNames = request.fields.map(\.name)
    guard Set(fieldNames).count == fieldNames.count,
          request.fields.allSatisfy({ field in
            !field.name.isEmpty && field.name.count <= 64
              && field.description.count <= 400
              && (field.kind == "string" || field.kind == "enum")
              && (field.kind != "enum" || (!(field.values ?? []).isEmpty && (field.values ?? []).count <= 128))
              && (field.values ?? []).allSatisfy({ !$0.isEmpty && $0.count <= 160 })
          }) else {
      return structuredBridgeJson(["status": "invalid_request", "errorCode": "field_schema_invalid", "bridgeVersion": "1", "taskId": request.taskId])
    }
    let properties = request.fields.map { field in
      let fieldSchema = field.kind == "enum"
        ? DynamicGenerationSchema(name: field.name, anyOf: field.values ?? [])
        : DynamicGenerationSchema(type: String.self)
      return DynamicGenerationSchema.Property(
        name: field.name,
        description: field.description,
        schema: fieldSchema
      )
    }
    let root = DynamicGenerationSchema(
      name: "KatchimeraStructuredBridgeResult",
      description: "A bounded structured result for \(request.taskId)",
      properties: properties
    )
    do {
      let schema = try GenerationSchema(root: root, dependencies: [])
      let session = LanguageModelSession(instructions: Instructions(request.instructions))
      let response = try await session.respond(to: Prompt(request.prompt), schema: schema)
      var result: [String: String] = [
        "status": "succeeded",
        "bridgeVersion": "1",
        "taskId": request.taskId,
        "durationMs": String(Int(Date().timeIntervalSince(startedAt) * 1000)),
      ]
      for field in request.fields {
        let value: String = try response.content.value(forProperty: field.name)
        result[field.name] = value
      }
      return structuredBridgeJson(result)
    } catch {
      return structuredBridgeJson([
        "status": "failed",
        "errorCode": "generation_failed",
        "errorDescription": String(describing: error),
        "bridgeVersion": "1",
        "taskId": request.taskId,
        "durationMs": String(Int(Date().timeIntervalSince(startedAt) * 1000)),
      ])
    }
  }
  #endif

  private static func structuredBridgeJson(_ value: [String: String]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
          let json = String(data: data, encoding: .utf8) else {
      return "{\"status\":\"failed\",\"errorCode\":\"response_encode_failed\",\"bridgeVersion\":\"1\"}"
    }
    return json
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func rankPhotoJournalCandidates(
    stage: String,
    taskInstructions: String,
    evidence: String,
    candidateIds: [String],
    candidateDescriptions: [String],
    routePrefix: String?
  ) async -> [String: String] {
    guard stage == "route" || stage == "flow" || stage == "category" else {
      return photoJournalFailure(stage: stage, code: "invalid_stage", description: "Stage must be route, flow or category")
    }
    guard !candidateIds.isEmpty, candidateIds.count <= 128, Set(candidateIds).count == candidateIds.count else {
      return photoJournalFailure(stage: stage, code: "invalid_candidates", description: "Candidate IDs must be 1-128 distinct values")
    }
    guard case .available = SystemLanguageModel.default.availability else {
      return photoJournalFailure(stage: stage, code: "model_unavailable", description: "Apple Foundation model is unavailable")
    }
    let cleanEvidence = evidence.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanEvidence.isEmpty else { return photoJournalNoEvidence(stage: stage) }
    let candidates = candidateIds.enumerated().map { index, id in
      let description = index < candidateDescriptions.count ? candidateDescriptions[index] : id
      return "[\(index)] \(id): \(description)"
    }.joined(separator: "\n")
    let instructions = Instructions(
      """
      Rank candidates for a photo-journal classification task. Return zero-based
      indexes from the supplied list, never IDs. Use -1 when a second or third
      candidate is not genuinely plausible. Candidate indexes must be distinct
      and ordered by calibrated score. Do not invent evidence.

      App-supplied task rules:
      \(taskInstructions)

      Candidates:
      \(candidates)
      """
    )
    return await runPhotoJournalStage(
      stage: stage,
      candidateIds: candidateIds,
      evidence: cleanEvidence,
      instructions: instructions,
      routePrefix: routePrefix
    )
  }

  @available(iOS 26.0, *)
  private static func enrichPhotoJournal(
    routeKey: String,
    fieldLabel: String,
    visualSubject: String,
    ocrLines: [String],
    ocrConfidences: [Double],
    ocrRegions: [String],
    taskInstructions: String
  ) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    if routeKey.hasPrefix("people.") {
      return ["disposition": "skipped", "specific": "", "confidence": "0", "usedOcrIndexes": "", "reason": "people_routes_do_not_infer_identity_from_printed_text", "promptVersion": "photo-journal-ocr-v5-ios26", "lockedRouteKey": routeKey]
    }
    let lines = ocrLines.prefix(16).enumerated().compactMap { index, line -> String? in
      let clean = line.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clean.isEmpty else { return nil }
      let score = index < ocrConfidences.count ? max(0, min(1, ocrConfidences[index])) : 0
      let region = index < ocrRegions.count ? ocrRegions[index] : ""
      return "[\(index)] \(clean) confidence \(String(format: "%.3f", score))\(region.isEmpty ? "" : "; \(region)")"
    }
    guard !lines.isEmpty else { return [:] }
    let instructions = Instructions(
      """
      Fill one editable manual-journal field from OCR for an already selected
      route. The route is immutable. Interpret all OCR lines as a group before
      choosing a value appropriate for the supplied field label: for example a
      book title, venue name, dish name, or project name. OCR order is not semantic
      priority. Reassemble split lines only when every meaningful word is present.
      World knowledge may distinguish which supplied span is a title, author, or
      promotional phrase, but never complete or add absent text. Discard mangled,
      generic, unrelated, or unsupported text. Printed names never establish a
      relationship.

      App-supplied field rules:
      \(taskInstructions)
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    let prompt = "Locked journal route: \(routeKey). Editable field: \(fieldLabel). Visual subject: \(visualSubject). OCR: \(lines.joined(separator: " | "))."
    do {
      if routeKey == "studio.book" {
        let first = try await session.respond(to: Prompt(prompt), generating: PhotoJournalBookFieldEnrichment.self).content
        let firstResult = validatedBookJournalEnrichment(first, routeKey: routeKey, ocrLines: ocrLines, promptVersion: "photo-journal-book-ocr-v5-ios26")
        if firstResult.issue == nil { return firstResult.response }
        let repairPrompt = """
        \(prompt)
        The first extraction was rejected because: \(firstResult.issue!). Re-evaluate
        every OCR line, keep author, subtitle, and marketing indexes separate from
        title indexes, and return the official main title only. If no defensible
        title remains, discard it.
        """
        let repaired = try await session.respond(to: Prompt(repairPrompt), generating: PhotoJournalBookFieldEnrichment.self).content
        let repairedResult = validatedBookJournalEnrichment(repaired, routeKey: routeKey, ocrLines: ocrLines, promptVersion: "photo-journal-book-ocr-v5-ios26-repair")
        return repairedResult.response
      }
      let content = try await session.respond(to: Prompt(prompt), generating: PhotoJournalFieldEnrichment.self).content
      let combinedOCR = ocrLines.joined(separator: " ")
      let supported = ocrValueIsSupported(content.specific, by: combinedOCR) ? content.specific : ""
      let disposition = content.disposition == "discard" || supported.isEmpty ? "discard" : content.disposition
      return [
        "disposition": disposition,
        "specific": disposition == "discard" ? "" : supported,
        "confidence": String(content.confidence),
        "usedOcrIndexes": disposition == "discard" ? "" : content.usedOcrIndexes,
        "reason": content.reason,
        "promptVersion": "photo-journal-ocr-v5-ios26",
        "lockedRouteKey": routeKey,
      ]
    } catch {
      return [:]
    }
  }

  private struct PhotoJournalNativeDecision {
    let candidateIndex: Int
    let candidateScore: Double
    let alternativeIndex: Int
    let alternativeScore: Double
    let thirdIndex: Int
    let thirdScore: Double
    let visualSubject: String

    @available(iOS 26.0, *)
    init(_ content: PhotoJournalCandidateDecision) {
      candidateIndex = content.candidateIndex
      candidateScore = content.candidateScore
      alternativeIndex = content.alternativeIndex
      alternativeScore = content.alternativeScore
      thirdIndex = content.thirdIndex
      thirdScore = content.thirdScore
      visualSubject = content.visualSubject
    }
  }

  @available(iOS 26.0, *)
  private static func runPhotoJournalStage(
    stage: String,
    candidateIds: [String],
    evidence: String,
    instructions: Instructions,
    routePrefix: String? = nil
  ) async -> [String: String] {
    var attempts = [[String: String]]()
    let primarySession = LanguageModelSession(instructions: instructions)
    let primaryStartedAt = Date()
    do {
      let content = try await primarySession.respond(to: Prompt(evidence), generating: PhotoJournalCandidateDecision.self).content
      let decision = PhotoJournalNativeDecision(content)
      if let issue = photoJournalDecisionIssue(decision, candidateCount: candidateIds.count) {
        let broken = photoJournalDecisionJson(decision)
        attempts.append(photoJournalAttempt(kind: "primary", status: "invalid", errorCode: "validation_failure", errorDescription: issue, rawOutput: broken, durationMs: photoJournalDuration(since: primaryStartedAt)))
        let repairInstructions = Instructions(
          """
          Repair a classification object. Do not reconsider the photo and do not
          add new meaning. Valid candidate indexes are 0 through \(candidateIds.count - 1),
          plus -1 for an absent alternative. Return distinct indexes ordered by score.
          """
        )
        let repairSession = LanguageModelSession(instructions: repairInstructions)
        let repairStartedAt = Date()
        do {
          let repairedContent = try await repairSession.respond(
            to: Prompt("Invalid object: \(broken). Validation problem: \(issue). Repair only this object."),
            generating: PhotoJournalCandidateDecision.self
          ).content
          let repaired = PhotoJournalNativeDecision(repairedContent)
          if photoJournalDecisionIssue(repaired, candidateCount: candidateIds.count) == nil {
            attempts.append(photoJournalAttempt(kind: "repair", status: "succeeded", rawOutput: photoJournalDecisionJson(repaired), durationMs: photoJournalDuration(since: repairStartedAt)))
            return photoJournalStageResult(stage: stage, decision: repaired, candidateIds: candidateIds, attempts: attempts, source: "appleFoundationRepair", routePrefix: routePrefix)
          }
          attempts.append(photoJournalAttempt(kind: "repair", status: "invalid", errorCode: "validation_failure", errorDescription: "Repaired object remained invalid", rawOutput: photoJournalDecisionJson(repaired), durationMs: photoJournalDuration(since: repairStartedAt)))
        } catch {
          attempts.append(photoJournalAttempt(kind: "repair", status: "failed", errorCode: photoJournalErrorCode(error), errorDescription: String(describing: error), durationMs: photoJournalDuration(since: repairStartedAt)))
        }
        return photoJournalFailure(stage: stage, code: "validation_failure", description: "Primary and repair outputs were invalid", attempts: attempts)
      }
      attempts.append(photoJournalAttempt(kind: "primary", status: "succeeded", rawOutput: photoJournalDecisionJson(decision), durationMs: photoJournalDuration(since: primaryStartedAt)))
      return photoJournalStageResult(stage: stage, decision: decision, candidateIds: candidateIds, attempts: attempts, source: "appleFoundation", routePrefix: routePrefix)
    } catch {
      let code = photoJournalErrorCode(error)
      attempts.append(photoJournalAttempt(kind: "primary", status: "failed", errorCode: code, errorDescription: String(describing: error), durationMs: photoJournalDuration(since: primaryStartedAt)))
      guard photoJournalErrorIsRetryable(code) else {
        return photoJournalFailure(stage: stage, code: code, description: String(describing: error), attempts: attempts)
      }
      return await simplifiedPhotoJournalRetry(stage: stage, candidateIds: candidateIds, evidence: evidence, instructions: instructions, routePrefix: routePrefix, attempts: attempts)
    }
  }

  @available(iOS 26.0, *)
  private static func simplifiedPhotoJournalRetry(
    stage: String,
    candidateIds: [String],
    evidence: String,
    instructions: Instructions,
    routePrefix: String?,
    attempts: [[String: String]]
  ) async -> [String: String] {
    var trace = attempts
    let retrySession = LanguageModelSession(instructions: instructions)
    let retryStartedAt = Date()
    do {
      let content = try await retrySession.respond(
        to: Prompt("Return only the best candidate index, one alternative index if real, their scores, and a short visual subject. Valid indexes: 0 through \(candidateIds.count - 1). Evidence: \(evidence)"),
        generating: PhotoJournalCandidateDecision.self
      ).content
      let decision = PhotoJournalNativeDecision(content)
      guard photoJournalDecisionIssue(decision, candidateCount: candidateIds.count) == nil else {
        trace.append(photoJournalAttempt(kind: "simplified_retry", status: "invalid", errorCode: "validation_failure", errorDescription: "Simplified result was invalid", rawOutput: photoJournalDecisionJson(decision), durationMs: photoJournalDuration(since: retryStartedAt)))
        return photoJournalFailure(stage: stage, code: "validation_failure", description: "All classification attempts were invalid", attempts: trace)
      }
      trace.append(photoJournalAttempt(kind: "simplified_retry", status: "succeeded", rawOutput: photoJournalDecisionJson(decision), durationMs: photoJournalDuration(since: retryStartedAt)))
      return photoJournalStageResult(stage: stage, decision: decision, candidateIds: candidateIds, attempts: trace, source: "appleFoundationRetry", routePrefix: routePrefix)
    } catch {
      let code = photoJournalErrorCode(error)
      trace.append(photoJournalAttempt(kind: "simplified_retry", status: "failed", errorCode: code, errorDescription: String(describing: error), durationMs: photoJournalDuration(since: retryStartedAt)))
      return photoJournalFailure(stage: stage, code: code, description: String(describing: error), attempts: trace)
    }
  }

  @available(iOS 26.0, *)
  private static func photoJournalDecisionIssue(_ decision: PhotoJournalNativeDecision, candidateCount: Int) -> String? {
    guard decision.candidateIndex >= 0 && decision.candidateIndex < candidateCount else { return "Top candidate index is outside the supplied list" }
    let alternatives = [decision.alternativeIndex, decision.thirdIndex].filter { $0 >= 0 }
    if alternatives.contains(where: { $0 >= candidateCount }) { return "An alternative index is outside the supplied list" }
    let indexes = [decision.candidateIndex] + alternatives
    if Set(indexes).count != indexes.count { return "Candidate indexes must be distinct" }
    if decision.alternativeIndex >= 0 && decision.alternativeScore > decision.candidateScore { return "Alternative score exceeds the top score" }
    if decision.thirdIndex >= 0 && decision.thirdScore > decision.alternativeScore { return "Third score exceeds the alternative score" }
    return nil
  }

  @available(iOS 26.0, *)
  private static func photoJournalStageResult(stage: String, decision: PhotoJournalNativeDecision, candidateIds: [String], attempts: [[String: String]], source: String, routePrefix: String?) -> [String: String] {
    let candidate = { (index: Int) -> String in
      guard index >= 0 && index < candidateIds.count else { return "" }
      let id = candidateIds[index]
      return routePrefix.map { "\($0).\(id)" } ?? id
    }
    return [
      "schemaVersion": JournalNoteRouteCatalog.photoSchemaVersion,
      "stage": stage,
      "status": "ranked",
      "candidateId": candidate(decision.candidateIndex),
      "candidateScore": String(decision.candidateScore),
      "alternativeId": candidate(decision.alternativeIndex),
      "alternativeScore": String(decision.alternativeScore),
      "thirdId": candidate(decision.thirdIndex),
      "thirdScore": String(decision.thirdScore),
      "visualSubject": decision.visualSubject,
      "source": source,
      "attemptsJson": photoJournalJson(attempts),
    ]
  }

  @available(iOS 26.0, *)
  private static func photoJournalNoEvidence(stage: String) -> [String: String] {
    return ["schemaVersion": JournalNoteRouteCatalog.photoSchemaVersion, "stage": stage, "status": "no_evidence", "attemptsJson": "[]"]
  }

  @available(iOS 26.0, *)
  private static func photoJournalFailure(stage: String, code: String, description: String, attempts: [[String: String]] = []) -> [String: String] {
    return ["schemaVersion": JournalNoteRouteCatalog.photoSchemaVersion, "stage": stage, "status": "technical_failure", "errorCode": code, "errorDescription": description, "attemptsJson": photoJournalJson(attempts)]
  }

  private static func photoJournalAttempt(kind: String, status: String, errorCode: String = "", errorDescription: String = "", rawOutput: String = "", durationMs: Int = 0) -> [String: String] {
    return ["kind": kind, "status": status, "errorCode": errorCode, "errorDescription": errorDescription, "rawOutput": String(rawOutput.prefix(2000)), "durationMs": String(durationMs)]
  }

  private static func photoJournalDuration(since start: Date) -> Int {
    return max(0, Int(Date().timeIntervalSince(start) * 1000))
  }

  @available(iOS 26.0, *)
  private static func photoJournalDecisionJson(_ decision: PhotoJournalNativeDecision) -> String {
    return photoJournalJson(["candidateIndex": String(decision.candidateIndex), "candidateScore": String(decision.candidateScore), "alternativeIndex": String(decision.alternativeIndex), "alternativeScore": String(decision.alternativeScore), "thirdIndex": String(decision.thirdIndex), "thirdScore": String(decision.thirdScore), "visualSubject": decision.visualSubject])
  }

  private static func photoJournalJson(_ value: Any) -> String {
    guard JSONSerialization.isValidJSONObject(value), let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) else { return "" }
    return text
  }

  private static func photoJournalErrorCode(_ error: Error) -> String {
    let text = String(describing: error).lowercased()
    if text.contains("decod") || text.contains("pars") { return "decoding_failure" }
    if text.contains("timeout") { return "timeout" }
    if text.contains("rate") { return "rate_limited" }
    if text.contains("refus") { return "refusal" }
    if text.contains("guardrail") { return "guardrail_violation" }
    if text.contains("context") { return "context_exceeded" }
    if text.contains("unsupported") || text.contains("guide") { return "unsupported_guide" }
    if text.contains("concurrent") { return "concurrent_request" }
    return "generation_failure"
  }

  private static func photoJournalErrorIsRetryable(_ code: String) -> Bool {
    return code == "decoding_failure" || code == "generation_failure"
  }

  @available(iOS 26.0, *)
  private static func classifyPhotoAnchor(
    labels: [String],
    confidences: [Double],
    faceCount: Int,
    humanCount: Int,
    documentDetected: Bool,
    dominantSubjectCoverage: Double,
    spatialCandidates: [String]
  ) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let evidence = labels.prefix(12).enumerated().compactMap { index, label -> String? in
      let clean = label.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clean.isEmpty else { return nil }
      let score = index < confidences.count ? max(0, min(1, confidences[index])) : 0
      return "\(index + 1). \(clean) confidence \(String(format: "%.3f", score))"
    }
    guard !evidence.isEmpty else { return [:] }
    let instructions = Instructions(
      """
      Classify the dominant subject of a personal photo using only scored visual
      observations. OCR is intentionally withheld and must not be imagined.
      Confidence, saliency, region coverage, document detection, and human evidence
      determine what the camera was pointed at. Weak background labels must not
      outrank a strong dominant label.

      Return one atomic routeKey. Use media.book when a physical book or book cover
      is dominant; document is for receipts, signs, forms, menus, or plain pages that
      are not an identifiable work. A printed or depicted person is not a People
      memory. The people route is forbidden unless faceCount or humanCount is above
      zero, or a supplied spatial candidate explicitly describes a human region.
      Likewise, objects depicted inside books, posters, artwork, or screens are
      content of that container, not physical objects in the user's moment.

      Choose representation and container consistently with the atomic route. Name
      the visual subject in 2-5 words without inventing identity. Set ocrPurpose to
      identity for media covers and named documents, context when text may add a
      useful detail without changing the route, or ignore when OCR is irrelevant.
      Alternatives and supporting subjects must come from meaningful visual evidence,
      never from a weak guess.
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    let spatial = spatialCandidates.prefix(4).joined(separator: " | ")
    var prompt = "Visual labels in confidence order: \(evidence.joined(separator: "; ")). Faces: \(faceCount). Humans: \(humanCount). Document detected: \(documentDetected ? "yes" : "no"). Dominant subject coverage: \(String(format: "%.3f", max(0, min(1, dominantSubjectCoverage))))."
    if !spatial.isEmpty { prompt += " Spatial evidence: \(spatial)." }
    do {
      let first = try await session.respond(to: Prompt(prompt), generating: PhotoVisualAnchor.self).content
      if let issue = photoAnchorValidationIssue(first, faceCount: faceCount, humanCount: humanCount, spatialCandidates: spatialCandidates) {
        let retryPrompt = Prompt("The previous structured result was invalid: \(issue). Reclassify from the same visual evidence. Keep OCR and printed identities out of this decision.")
        let retry = try await session.respond(to: retryPrompt, generating: PhotoVisualAnchor.self).content
        guard photoAnchorValidationIssue(retry, faceCount: faceCount, humanCount: humanCount, spatialCandidates: spatialCandidates) == nil else { return [:] }
        return photoAnchorResult(retry, promptVersion: "photo-anchor-v2-ios26-retry")
      }
      return photoAnchorResult(first, promptVersion: "photo-anchor-v2-ios26")
    } catch {
      return [:]
    }
  }

  @available(iOS 26.0, *)
  private static func enrichPhotoOcr(
    routeKey: String,
    representation: String,
    container: String,
    visualSubject: String,
    ocrLines: [String],
    ocrConfidences: [Double],
    ocrRegions: [String]
  ) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let lines = ocrLines.prefix(16).enumerated().compactMap { index, line -> String? in
      let clean = line.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clean.isEmpty else { return nil }
      let score = index < ocrConfidences.count ? max(0, min(1, ocrConfidences[index])) : 0
      let region = index < ocrRegions.count ? ocrRegions[index] : ""
      return "[\(index)] \(clean) confidence \(String(format: "%.3f", score))\(region.isEmpty ? "" : "; \(region)")"
    }
    guard !lines.isEmpty else { return [:] }
    let instructions = Instructions(
      """
      Enrich the identity of an already classified photo subject from OCR. The
      route is locked and cannot be changed. Printed names belong to the locked
      book, poster, artwork, screen, sign, package, or document; they never prove
      that a person was physically present.

      Reassemble split OCR lines only when the supplied words clearly support the
      result. You may normalize capitalization and punctuation, but every meaningful
      title and creator word must be present in the OCR. Do not complete partial
      works from world knowledge. If text is mangled, generic, or unrelated, return
      discard and empty title/creator. Return the zero-based OCR line indexes used.
      The subject may become more specific, but must remain an instance of the
      locked route.

      When the locked route is media.book, first separate the cover into official
      main title, optional subtitle, author, and endorsement or marketing copy.
      Bestseller claims, review quotes, publisher slogans, and fragments such as
      "the phenomenal" are not titles. OCR order is not semantic priority. Return
      the official main title rather than the first or shortest cover phrase.
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    let prompt = "Locked route: \(routeKey). Representation: \(representation). Container: \(container). Visual subject: \(visualSubject). OCR lines: \(lines.joined(separator: " | ")). Enrich without reclassifying."
    do {
      if routeKey == "media.book" {
        let content = try await session.respond(to: Prompt(prompt), generating: PhotoJournalBookFieldEnrichment.self).content
        let combinedOCR = ocrLines.joined(separator: " ")
        let supportedTitle = ocrValueIsSupported(content.title, by: combinedOCR) ? content.title : ""
        let normalizedTitle = normalizedOcrComparisonValue(supportedTitle)
        let duplicatesAuthor = !normalizedTitle.isEmpty && normalizedTitle == normalizedOcrComparisonValue(content.author)
        let duplicatesMarketing = !normalizedTitle.isEmpty && normalizedTitle == normalizedOcrComparisonValue(content.marketingCopy)
        let acceptedTitle = duplicatesAuthor || duplicatesMarketing ? "" : supportedTitle
        let supportedAuthor = ocrValueIsSupported(content.author, by: combinedOCR) ? content.author : ""
        let disposition = content.disposition == "discard" || acceptedTitle.isEmpty ? "discard" : content.disposition
        return [
          "disposition": disposition,
          "subject": disposition == "discard" ? "" : acceptedTitle,
          "title": disposition == "discard" ? "" : acceptedTitle,
          "creator": disposition == "discard" ? "" : supportedAuthor,
          "confidence": String(content.confidence),
          "usedOcrIndexes": disposition == "discard" ? "" : content.usedTitleOcrIndexes,
          "reason": content.reason,
          "semanticRole": disposition == "discard" ? "none" : "official_book_title",
          "rejectedMarketingCopy": ocrValueIsSupported(content.marketingCopy, by: combinedOCR) ? content.marketingCopy : "",
          "promptVersion": "photo-book-ocr-v3-ios26",
        ]
      }
      let content = try await session.respond(to: Prompt(prompt), generating: PhotoOcrEnrichment.self).content
      let combinedOCR = ocrLines.joined(separator: " ")
      let supportedSubject = ocrValueIsSupported(content.subject, by: combinedOCR) ? content.subject : ""
      let supportedTitle = ocrValueIsSupported(content.title, by: combinedOCR) ? content.title : ""
      let supportedCreator = ocrValueIsSupported(content.creator, by: combinedOCR) ? content.creator : ""
      let disposition = content.disposition == "discard" || (supportedSubject.isEmpty && supportedTitle.isEmpty && supportedCreator.isEmpty) ? "discard" : content.disposition
      return [
        "disposition": disposition,
        "subject": disposition == "discard" ? "" : supportedSubject,
        "title": disposition == "discard" ? "" : supportedTitle,
        "creator": disposition == "discard" ? "" : supportedCreator,
        "confidence": String(content.confidence),
        "usedOcrIndexes": disposition == "discard" ? "" : content.usedOcrIndexes,
        "reason": content.reason,
        "promptVersion": "photo-ocr-v2-ios26",
      ]
    } catch {
      return [:]
    }
  }

  @available(iOS 26.0, *)
  private static func photoAnchorValidationIssue(_ content: PhotoVisualAnchor, faceCount: Int, humanCount: Int, spatialCandidates: [String]) -> String? {
    let hasHumanRegion = spatialCandidates.contains { $0.lowercased().contains("human") || $0.lowercased().contains("face") }
    if content.routeKey == "people" && faceCount == 0 && humanCount == 0 && !hasHumanRegion {
      return "people requires face or human visual evidence"
    }
    if content.routeKey == "media.book" && content.container != "book" && content.container != "document" {
      return "media.book requires a book or document container"
    }
    return nil
  }

  @available(iOS 26.0, *)
  private static func photoAnchorResult(_ content: PhotoVisualAnchor, promptVersion: String) -> [String: String] {
    return [
      "routeKey": content.routeKey,
      "representation": content.representation,
      "container": content.container,
      "subject": content.subject,
      "confidence": String(content.confidence),
      "alternativeRouteKey": content.alternativeRouteKey,
      "ocrPurpose": content.ocrPurpose,
      "supportingSubjects": content.supportingSubjects,
      "promptVersion": promptVersion,
      "photoSchemaVersion": "2",
    ]
  }

  private static func ocrValueIsSupported(_ value: String, by ocr: String) -> Bool {
    let tokens = value.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { $0.count > 2 }
    if tokens.isEmpty { return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    let normalizedOCR = ocr.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
    return tokens.allSatisfy { normalizedOCR.contains($0) }
  }

  private static func normalizedOcrComparisonValue(_ value: String) -> String {
    return value.lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  @available(iOS 26.0, *)
  private static func validatedBookJournalEnrichment(
    _ content: PhotoJournalBookFieldEnrichment,
    routeKey: String,
    ocrLines: [String],
    promptVersion: String
  ) -> (response: [String: String], issue: String?) {
    let titleIndexes = validOcrIndexes(content.usedTitleOcrIndexes, count: ocrLines.count)
    let authorIndexes = validOcrIndexes(content.usedAuthorOcrIndexes, count: ocrLines.count)
    let subtitleIndexes = validOcrIndexes(content.usedSubtitleOcrIndexes, count: ocrLines.count)
    let marketingIndexes = validOcrIndexes(content.usedMarketingOcrIndexes, count: ocrLines.count)
    let indexedTitleText = titleIndexes.map { ocrLines[$0] }.joined(separator: " ")
    let combinedOCR = ocrLines.joined(separator: " ")
    let normalizedTitle = normalizedOcrComparisonValue(content.title)
    let roleIndexes = Set(authorIndexes + subtitleIndexes + marketingIndexes)
    var issue: String? = nil
    if content.disposition == "discard" || normalizedTitle.isEmpty {
      issue = "no_official_title_returned"
    } else if titleIndexes.isEmpty || !ocrValueIsSupported(content.title, by: indexedTitleText) {
      issue = "title_not_grounded_in_declared_ocr_indexes"
    } else if !Set(titleIndexes).isDisjoint(with: roleIndexes) {
      issue = "title_indexes_overlap_author_subtitle_or_marketing"
    } else if normalizedTitle == normalizedOcrComparisonValue(content.author) {
      issue = "title_duplicates_author"
    } else if normalizedTitle == normalizedOcrComparisonValue(content.subtitle) {
      issue = "title_is_subtitle_only"
    } else if normalizedTitle == normalizedOcrComparisonValue(content.marketingCopy) || bookTitleLooksLikeMarketing(content.title) {
      issue = "title_is_marketing_copy"
    } else if !ocrValueIsSupported(content.title, by: combinedOCR) {
      issue = "title_contains_words_absent_from_ocr"
    }
    let accepted = issue == nil
    return ([
      "disposition": accepted ? content.disposition : "discard",
      "specific": accepted ? content.title : "",
      "confidence": String(content.confidence),
      "usedOcrIndexes": accepted ? content.usedTitleOcrIndexes : "",
      "usedAuthorOcrIndexes": content.usedAuthorOcrIndexes,
      "usedSubtitleOcrIndexes": content.usedSubtitleOcrIndexes,
      "usedMarketingOcrIndexes": content.usedMarketingOcrIndexes,
      "reason": accepted ? content.reason : (issue ?? content.reason),
      "semanticRole": accepted ? "official_book_title" : "none",
      "author": ocrValueIsSupported(content.author, by: combinedOCR) ? content.author : "",
      "subtitle": ocrValueIsSupported(content.subtitle, by: combinedOCR) ? content.subtitle : "",
      "rejectedMarketingCopy": ocrValueIsSupported(content.marketingCopy, by: combinedOCR) ? content.marketingCopy : "",
      "promptVersion": promptVersion,
      "lockedRouteKey": routeKey,
      "validationIssue": issue ?? "",
    ], issue)
  }

  private static func validOcrIndexes(_ value: String, count: Int) -> [Int] {
    let parsed = value.split(separator: ",").compactMap { part in
      Int(part.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    guard !parsed.isEmpty, parsed.allSatisfy({ $0 >= 0 && $0 < count }) else { return [] }
    return Array(Set(parsed)).sorted()
  }

  private static func bookTitleLooksLikeMarketing(_ value: String) -> Bool {
    let normalized = normalizedOcrComparisonValue(value)
    let marketingTerms = ["bestseller", "best selling", "award winning", "major film", "phenomenal"]
    return marketingTerms.contains { normalized.contains($0) }
  }

  @available(iOS 26.0, *)
  private static func readMemory(tags: [String], ocrLines: [String], faceCount: Int, spatialCandidates: [String]) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let cleaned = tags.filter { !$0.isEmpty }
    let cleanedOCR = ocrLines.filter { !$0.isEmpty }
    guard !cleaned.isEmpty || !cleanedOCR.isEmpty else { return [:] }
    let instructions = Instructions(
      """
      Organize a personal photo from on-device visual observations, independently
      classified salient regions, and OCR. Observation order is confidence order,
      not proof of the main subject. Use region coverage and saliency to distinguish
      dominant, supporting, and incidental subjects. When two significant regions
      are comparable, keep the result uncertain and return the other subject as an
      alternative instead of forcing a winner.
      First classify representation as physical_scene, physical_artwork,
      physical_document, device_showing_content, native_digital_image, screenshot,
      or unknown. Classify its container as none, book, screen, frame_or_canvas,
      poster_or_print, document, packaging, or unknown. A container is what was
      photographed; objects shown inside it are depicted content.
      Choose exactly one dominant domain: animal, people, food, media, movement, place, work,
      nature, life_event, or other. Name the specific subject in 2-5 words.
      If it is media, identify mediaKind as book, film, show, game, music, or art
      and only provide title/creator when directly supported by OCR. Never complete
      partial titles or creators from world knowledge. If it is food, name
      the dish or drink. First distinguish a real physical scene from a screenshot,
      game, cartoon, illustration, app interface, or content displayed on a screen.
      Depicted food, animals, people, and places are not real-life food, pet, people,
      or place memories; classify the work as media when identifiable, otherwise other.
      A photographed television showing sport, news, or another live event is media
      being watched, never the user's work or physical movement. Describe the broadcast
      specifically only when the observations or OCR support that detail. Never guess a
      particular sport; use "live sport on TV" when the sport itself is uncertain, and
      use show as its mediaKind when no more specific supported media kind exists.
      If it is movement, use walk, run, hike, cycle, workout,
      transit, commute, drive, travel, or mixed. Never infer identity, ownership,
      gender, age, family relationship, or whether an animal is someone's pet.
      Return up to four other clearly visible subjects as a comma-separated list,
      excluding the dominant subject. Do not include weak guesses.
      Give a zero-to-one confidence for the dominant classification and a short
      comma-separated list of plausible alternatives when evidence is ambiguous.
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    let observations = cleaned.prefix(12).joined(separator: ", ")
    let text = cleanedOCR.prefix(12).joined(separator: " / ")
    var prompt = "Observations: \(observations). Faces detected: \(faceCount)."
    let spatial = spatialCandidates.prefix(3).joined(separator: " | ")
    if !spatial.isEmpty { prompt += " Spatial candidates: \(spatial)." }
    if !text.isEmpty { prompt += " OCR: \"\(text)\"." }
    do {
      let response = try await session.respond(to: Prompt(prompt), generating: MemoryRead.self)
      return memoryResult(response.content, promptVersion: "memory-read-v1-ios26")
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func memoryResult(_ content: MemoryRead, promptVersion: String) -> [String: String] {
    return [
      "domain": content.domain,
      "subject": content.subject,
      "animalKind": content.animalKind,
      "mediaKind": content.mediaKind,
      "title": content.title,
      "creator": content.creator,
      "food": content.food,
      "activity": content.activity,
      "representation": content.representation,
      "container": content.container,
      "confidence": String(content.confidence),
      "alternatives": content.alternatives,
      "supportingSubjects": content.supportingSubjects,
      "promptVersion": promptVersion,
    ]
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func interpretNote(transcript: String) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else {
      return [:]
    }
    let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return [:]
    }

    let instructions = Instructions(
      """
      You read a short personal journal note (typed or a voice transcript) for a gentle journaling app.
      Return:
      - title: a short, warm 2-4 word title for the moment (under 24 characters),
        specific to what the person said. No punctuation, no emoji, no quotes.
      - feeling: the single dominant feeling of the note, one of:
        calm, energy, together, meaningful.
      - mediaKind: when the note mentions taking in media — reading a book,
        watching a film/show/sports broadcast/news/online video, playing a video game,
        listening to an album or podcast, or seeing art — classify it as book, film,
        show, game, music, art, or other. Use other for watched sport, news, podcasts,
        livestreams, and consumed media outside the six specific kinds. Watching a
        person in real life is not media. Otherwise use none.
      - mediaTitle: the mentioned work's full official title with correct capitalization.
        Transcripts are often lowercase — use your knowledge of the work to restore the
        real title (for example "the way of kings" is the book "The Way of Kings").
        Empty when no work was named or mediaKind is none.
      - mediaCreator: that work's author, director, or artist when you are confident.
        Empty otherwise.
      - food: when the note is about eating or drinking something specific, a short
        1-4 word name of the dish or drink (for example "a bowl of ramen"). Empty otherwise.
      - routeKey: choose one atomic destination from the taxonomy below. Prefer a
        specific destination whenever the note supports it. Use general.other only
        when no specific destination fits, and ambiguous only when two destinations
        remain genuinely tied after considering their definitions and exclusions.
      - alternativeRouteKey: the second plausible destination only when it is close;
        otherwise empty. Give calibrated confidence values for both decisions.
      - specific: a concise name explicitly present or safely extracted from the note, such
        as a person, place, activity, dish, work, project, or event. Empty rather than guessing.
      - context: only a taxonomy option ID clearly stated by the note; otherwise empty.
      - journalFeeling: only a feeling option ID clearly expressed by the note; otherwise empty.
        Do not infer sensitive relationships beyond the user's words.

      Journal taxonomy:
      \(JournalNoteRouteCatalog.promptTaxonomy)
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    let prompt = Prompt("The note says: \"\(trimmed)\". Give the title, feeling, and classification now.")

    do {
      let response = try await session.respond(to: prompt, generating: NoteRead.self)
      return [
        "label": response.content.title,
        "archetype": response.content.feeling,
        "mediaKind": response.content.mediaKind,
        "mediaTitle": response.content.mediaTitle,
        "mediaCreator": response.content.mediaCreator,
        "food": response.content.food,
        "routeKey": response.content.routeKey,
        "alternativeRouteKey": response.content.alternativeRouteKey,
        "routeConfidence": String(response.content.routeConfidence),
        "alternativeRouteConfidence": String(response.content.alternativeRouteConfidence),
        "specific": response.content.specific,
        "context": response.content.context,
        "journalFeeling": response.content.journalFeeling,
        "noteSchemaVersion": JournalNoteRouteCatalog.schemaVersion,
      ]
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func classifyNoteRoute(transcript: String) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return [:] }
    let instructions = Instructions(
      """
      Classify one personal journal note into exactly one atomic journal route.
      Consider the definitions, examples, and exclusions carefully. Prefer a
      specific route over general.other. Use ambiguous only for a genuine tie.
      Return a close alternative only when one exists, with calibrated confidence.

      Journal taxonomy:
      \(JournalNoteRouteCatalog.promptTaxonomy)
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    do {
      let response = try await session.respond(
        to: Prompt("The note says: \"\(trimmed)\". Select the best route now."),
        generating: NoteRouteDecision.self
      )
      return [
        "routeKey": response.content.routeKey,
        "alternativeRouteKey": response.content.alternativeRouteKey,
        "routeConfidence": String(response.content.routeConfidence),
        "alternativeRouteConfidence": String(response.content.alternativeRouteConfidence),
        "noteSchemaVersion": JournalNoteRouteCatalog.schemaVersion,
      ]
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func classifyPhotoRoute(
    evidence: String,
    candidateRouteKeys: [String],
    candidateDescriptions: [String],
    specificEvidenceKeys: [String],
    specificEvidenceDescriptions: [String]
  ) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let trimmedEvidence = evidence.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedEvidence.isEmpty else { return [:] }
    guard candidateRouteKeys.count == candidateDescriptions.count else { return [:] }
    guard specificEvidenceKeys.count == specificEvidenceDescriptions.count else { return [:] }

    var seen = Set<String>()
    let candidates = zip(candidateRouteKeys, candidateDescriptions).compactMap { routeKey, description -> (String, String)? in
      let cleanKey = routeKey.trimmingCharacters(in: .whitespacesAndNewlines)
      let cleanDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
      guard JournalNoteRouteCatalog.routeKeys.contains(cleanKey), !seen.contains(cleanKey) else { return nil }
      seen.insert(cleanKey)
      return (cleanKey, cleanDescription)
    }
    guard !candidates.isEmpty else { return [:] }

    var seenEvidence = Set<String>()
    let specificEvidence = zip(specificEvidenceKeys, specificEvidenceDescriptions).compactMap { evidenceKey, description -> (String, String)? in
      let cleanKey = evidenceKey.trimmingCharacters(in: .whitespacesAndNewlines)
      let cleanDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !cleanKey.isEmpty, !cleanDescription.isEmpty, !seenEvidence.contains(cleanKey) else { return nil }
      seenEvidence.insert(cleanKey)
      return (cleanKey, cleanDescription)
    }

    let allowedRouteKeys = candidates.map(\.0) + ["ambiguous"]
    let allowedSpecificEvidenceKeys = ["none"] + specificEvidence.map(\.0)
    let allowedSpecificEvidenceRoles = ["concrete_subject", "generic_class", "container", "not_applicable"]
    let decisionSchema = DynamicGenerationSchema(
      name: "PhotoRouteDecision",
      description: "A journal route grounded in the supplied visual evidence",
      properties: [
        DynamicGenerationSchema.Property(
          name: "routeKey",
          description: "Best visually supported route, or ambiguous when the evidence cannot distinguish the candidates",
          schema: DynamicGenerationSchema(name: "routeKey", anyOf: allowedRouteKeys)
        ),
        DynamicGenerationSchema.Property(
          name: "specificEvidenceKey",
          description: "One supplied visible Essence evidence key useful for the editable Food field, or none",
          schema: DynamicGenerationSchema(name: "specificEvidenceKey", anyOf: allowedSpecificEvidenceKeys)
        ),
        DynamicGenerationSchema.Property(
          name: "specificEvidenceRole",
          description: "Whether that evidence is a concrete food subject, generic class, container, or not applicable",
          schema: DynamicGenerationSchema(name: "specificEvidenceRole", anyOf: allowedSpecificEvidenceRoles)
        )
      ]
    )

    let choices = candidates.map { "\($0.0): \($0.1)" }.joined(separator: "\n")
    let evidenceChoices = specificEvidence.map { "\($0.0): \($0.1)" }.joined(separator: "\n")
    let isFoodFlow = candidates.allSatisfy { $0.0.hasPrefix("food.") }
    let instructions = Instructions(
      """
      Classify structured Apple Vision observations for one personal photo.
      The broad journal flow and principal subject have already been resolved.
      Select only among the supplied children of that locked flow. The input is
      visual evidence, never journal prose. Classify the photographed subject's
      ordinary journal meaning: for example, a single ready-to-eat fruit normally
      fits snack; a plated substantial dish fits meal. Do not choose an "other"
      child merely because its label repeats the broad domain word. Use ambiguous
      when the evidence cannot distinguish children. A screen device does not
      prove a book, film, show, game, news, or sport subtype. Printed or televised
      people do not establish a real relationship.

      Also classify one supplied visible Essence evidence key for an editable
      field. Only for the Food flow, choose a useful concrete photographed food
      or drink identity and mark it concrete_subject. Broad classes such as food,
      fruit, meal, or drink are generic_class. Serving objects and packaging such
      as cups, plates, bowls, or bottles are container. For every non-Food flow,
      or when no useful concrete identity is present, return none and
      not_applicable. Never invent text and never select an evidence key that was
      not supplied.
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    do {
      let schema = try GenerationSchema(root: decisionSchema, dependencies: [])
      let prompt = Prompt(
        """
        Apple Vision evidence:
        \(trimmedEvidence)

        Evidence-supported route choices:
        \(choices)

        Visible Essence evidence eligible for a Food field:
        \(evidenceChoices.isEmpty ? "none" : evidenceChoices)

        Locked flow is Food: \(isFoodFlow ? "yes" : "no")

        Select the best supported route or ambiguous, plus the grounded field evidence.
        """
      )
      let response = try await session.respond(to: prompt, schema: schema)
      let routeKey: String = try response.content.value(forProperty: "routeKey")
      let specificEvidenceKey: String = try response.content.value(forProperty: "specificEvidenceKey")
      let specificEvidenceRole: String = try response.content.value(forProperty: "specificEvidenceRole")
      guard allowedRouteKeys.contains(routeKey) else { return [:] }
      guard allowedSpecificEvidenceKeys.contains(specificEvidenceKey), allowedSpecificEvidenceRoles.contains(specificEvidenceRole) else { return [:] }
      return [
        "routeKey": routeKey,
        "specificEvidenceKey": specificEvidenceKey,
        "specificEvidenceRole": specificEvidenceRole,
        "photoSchemaVersion": JournalNoteRouteCatalog.photoSchemaVersion,
      ]
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func interpretPhotoSemantics(
    evidence: String,
    primaryEvidenceKeys: [String],
    backgroundEvidenceKeys: [String],
    evidenceDescriptions: [String]
  ) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else { return [:] }
    let cleanEvidence = evidence.trimmingCharacters(in: .whitespacesAndNewlines)
    let allEvidenceKeys = primaryEvidenceKeys + backgroundEvidenceKeys
    guard !cleanEvidence.isEmpty, !primaryEvidenceKeys.isEmpty, allEvidenceKeys.count <= 8 else { return [:] }
    guard allEvidenceKeys.count == evidenceDescriptions.count, Set(allEvidenceKeys).count == allEvidenceKeys.count else { return [:] }

    let allowedSupporting = ["none"] + allEvidenceKeys
    let allowedAlternativeEvidence = ["none"] + primaryEvidenceKeys
    let allowedAlternativeDomains = ["none", "animal", "people", "food", "media", "movement", "place", "work", "nature", "life_event", "other"]
    let allowedAlternativeFlows = ["none", "went_somewhere", "food", "studio", "movement", "people", "work", "big_event", "general"]
    let decisionSchema = DynamicGenerationSchema(
      name: "PhotoSemanticInterpretation",
      description: "A visual-only semantic frame grounded in supplied concept keys",
      properties: [
        DynamicGenerationSchema.Property(
          name: "primaryEvidenceKey",
          description: "Dominant evidence key; must come from the eligible-primary list",
          schema: DynamicGenerationSchema(name: "primaryEvidenceKey", anyOf: primaryEvidenceKeys)
        ),
        DynamicGenerationSchema.Property(
          name: "supportingEvidenceKey1",
          description: "First supplied supporting evidence key, or none",
          schema: DynamicGenerationSchema(name: "supportingEvidenceKey1", anyOf: allowedSupporting)
        ),
        DynamicGenerationSchema.Property(
          name: "supportingEvidenceKey2",
          description: "Second supplied supporting evidence key, or none",
          schema: DynamicGenerationSchema(name: "supportingEvidenceKey2", anyOf: allowedSupporting)
        ),
        DynamicGenerationSchema.Property(
          name: "alternativeEvidenceKey",
          description: "A genuinely close competing visible Essence evidence key from another journal flow, or none",
          schema: DynamicGenerationSchema(name: "alternativeEvidenceKey", anyOf: allowedAlternativeEvidence)
        ),
        DynamicGenerationSchema.Property(
          name: "alternativeDomain",
          description: "Broad domain of alternativeEvidenceKey, or none",
          schema: DynamicGenerationSchema(name: "alternativeDomain", anyOf: allowedAlternativeDomains)
        ),
        DynamicGenerationSchema.Property(
          name: "alternativeFlowKey",
          description: "Different broad journal flow supported by alternativeEvidenceKey, or none",
          schema: DynamicGenerationSchema(name: "alternativeFlowKey", anyOf: allowedAlternativeFlows)
        ),
        DynamicGenerationSchema.Property(
          name: "representation",
          description: "How the photographed content is represented",
          schema: DynamicGenerationSchema(name: "representation", anyOf: ["physical_scene", "physical_artwork", "physical_document", "device_showing_content", "native_digital_image", "screenshot", "unknown"])
        ),
        DynamicGenerationSchema.Property(
          name: "container",
          description: "Container holding depicted content",
          schema: DynamicGenerationSchema(name: "container", anyOf: ["none", "book", "screen", "frame_or_canvas", "poster_or_print", "document", "packaging", "unknown"])
        ),
        DynamicGenerationSchema.Property(
          name: "domain",
          description: "Broad domain of the primary supplied concept",
          schema: DynamicGenerationSchema(name: "domain", anyOf: ["animal", "people", "food", "media", "movement", "place", "work", "nature", "life_event", "other"])
        ),
        DynamicGenerationSchema.Property(
          name: "flowKey",
          description: "Broad journal flow for the primary physical subject, or ambiguous",
          schema: DynamicGenerationSchema(name: "flowKey", anyOf: ["went_somewhere", "food", "studio", "movement", "people", "work", "big_event", "general", "ambiguous"])
        ),
        DynamicGenerationSchema.Property(
          name: "unresolvedFacet",
          description: "Important fact the visual evidence cannot establish",
          schema: DynamicGenerationSchema(name: "unresolvedFacet", anyOf: ["none", "media_type", "device_activity", "primary_subject", "relationship"])
        )
      ]
    )
    let concepts = zip(allEvidenceKeys, evidenceDescriptions).map { "\($0.0): \($0.1)" }.joined(separator: "\n")
    let instructions = Instructions(
      """
      Build a compact semantic frame from weighted Apple Vision evidence. OCR is
      withheld. The eligible-primary labels are the same Essence labels shown to
      the user. Select the primary only from that list. Background-only evidence
      may support context but can never become primary. Interpret corroborating
      labels together rather than treating label order as meaning. Prefer the
      most specific corroborated subject over a generic representation label:
      apple over food, television over screen content. A television/monitor/
      computer cluster outweighs one isolated book or document label, which may
      describe content displayed on that screen. A clear fruit or food object
      belongs to the food flow even when an incidental book-like label exists.
      Representation and container take precedence over objects depicted inside
      them. A television or monitor alone leaves media_type or device_activity
      unresolved. Printed or televised people never establish a physical
      relationship. The primary evidence, domain, and flow must form one coherent
      branch: food uses the food flow, media uses the studio flow, and place uses
      went_somewhere. The container must describe that same branch. In particular,
      when a visible eligible book is selected with a book container, use the book
      as the media/studio primary rather than promoting unrelated tableware or
      utensil labels. A physical book has no unresolved media_type. Return no
      confidence and no atomic child route.

      When two different broad journal meanings are both strongly and directly
      supported, return one grounded alternative branch using another eligible-
      primary Essence key, its domain, and its different flow. Do not use a weak,
      incidental, background, or merely possible label as an alternative. A
      dominant corroborated cluster such as food + banana + fruit must not become
      ambiguous because of a much weaker book label. Return none for all three
      alternative fields unless the user genuinely needs to choose between the
      two broad meanings. When an alternative is returned, flowKey remains the
      best primary flow rather than ambiguous.
      """
    )
    let session = LanguageModelSession(instructions: instructions)
    do {
      let schema = try GenerationSchema(root: decisionSchema, dependencies: [])
      let response = try await session.respond(
        to: Prompt("Evidence: \(cleanEvidence)\nSupplied evidence keys:\n\(concepts)\nResolve the broad semantic frame."),
        schema: schema
      )
      let primary: String = try response.content.value(forProperty: "primaryEvidenceKey")
      let supporting1: String = try response.content.value(forProperty: "supportingEvidenceKey1")
      let supporting2: String = try response.content.value(forProperty: "supportingEvidenceKey2")
      let alternativeEvidence: String = try response.content.value(forProperty: "alternativeEvidenceKey")
      let alternativeDomain: String = try response.content.value(forProperty: "alternativeDomain")
      let alternativeFlow: String = try response.content.value(forProperty: "alternativeFlowKey")
      guard primaryEvidenceKeys.contains(primary), allowedSupporting.contains(supporting1), allowedSupporting.contains(supporting2), allowedAlternativeEvidence.contains(alternativeEvidence), allowedAlternativeDomains.contains(alternativeDomain), allowedAlternativeFlows.contains(alternativeFlow) else { return [:] }
      return [
        "primaryEvidenceKey": primary,
        "supportingEvidenceKey1": supporting1,
        "supportingEvidenceKey2": supporting2,
        "alternativeEvidenceKey": alternativeEvidence,
        "alternativeDomain": alternativeDomain,
        "alternativeFlowKey": alternativeFlow,
        "representation": try response.content.value(forProperty: "representation"),
        "container": try response.content.value(forProperty: "container"),
        "domain": try response.content.value(forProperty: "domain"),
        "flowKey": try response.content.value(forProperty: "flowKey"),
        "unresolvedFacet": try response.content.value(forProperty: "unresolvedFacet"),
        "photoSchemaVersion": JournalNoteRouteCatalog.photoSchemaVersion,
      ]
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func suggest(tags: [String], faceCount: Int) async -> [[String: String]] {
    guard case .available = SystemLanguageModel.default.availability else {
      return []
    }

    let instructions = Instructions(
      """
      You help a gentle journaling app name what a photo meant to the person who took it.
      You receive what an on-device vision model detected, with the MAIN subject listed first.
      Anchor every option to that main subject — it is what the photo is mostly about.
      Return exactly four options, one for each feeling: calm, energy, together, meaningful.
      Each label is a short present-tense phrase (2–4 words) for what the person is doing or
      savouring in the moment, fitting BOTH the main subject and that feeling.
      Examples for a cup of coffee: "A slow sip"/calm, "A quick pick-me-up"/energy,
      "Catching up"/together, "My little ritual"/meaningful.
      Examples for a trail: "Soaking in the calm"/calm, "Pushing onward"/energy,
      "Walking it together"/together, "Worth the climb"/meaningful.
      Keep each label under 24 characters. No punctuation, no emoji, no hashtags. Be specific.
      """
    )
    let session = LanguageModelSession(instructions: instructions)

    let cleaned = tags.filter { !$0.isEmpty }
    let primary = cleaned.first ?? "an everyday moment"
    let rest = cleaned.dropFirst().prefix(6).joined(separator: ", ")
    var described = "mainly \(primary)"
    if !rest.isEmpty { described += " (also in frame: \(rest))" }
    if faceCount >= 2 {
      described += "; people are together in the photo"
    } else if faceCount == 1 {
      described += "; a person is in the photo"
    }
    let prompt = Prompt("The photo is \(described). Suggest the four options now, each anchored to \(primary).")

    do {
      let response = try await session.respond(to: prompt, generating: MeaningOptionList.self)
      return response.content.options.map { ["label": $0.label, "archetype": $0.archetype] }
    } catch {
      return []
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func readScene(tags: [String], ocrLines: [String], faceCount: Int) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else {
      return [:]
    }
    let cleaned = tags.filter { !$0.isEmpty }
    let cleanedOCR = ocrLines.filter { !$0.isEmpty }
    guard !cleaned.isEmpty || !cleanedOCR.isEmpty else {
      return [:]
    }

    let instructions = Instructions(
      """
      You classify what a personal photo is mainly about, for a gentle journaling app.
      You receive what an on-device vision model detected (MAIN subject first) and any
      text it read in the photo. Decide what the photo is MAINLY OF — the thing the
      person pointed the camera at — not incidental textures or background objects.
      Before choosing the subject, distinguish a physical scene from a screenshot,
      game, cartoon, illustration, app interface, or other screen content. Objects
      depicted in digital content are not physical memories: an illustrated/game egg
      is not food, a cartoon dog is not a pet, and a game landscape is not a place.
      Choose the single best top-level category:
      - media: the photo is OF a work — a book cover, a film or TV poster, a screen
        showing an identifiable film/show, a video game box or gameplay, an album
        cover or vinyl, artwork in a gallery. ONLY when the work is the main subject
        the camera was pointed at (a close-up that fills much of the frame). A book,
        screen, or poster that merely appears somewhere in a wider scene is NOT
        media — classify the scene by its real subject instead.
      - food: real physical food — a photographed meal, drink, snack, dessert, or
        cooking (still food when packaging or a menu is partly visible). Never use
        food for an icon, cartoon, illustration, screenshot, or game object.
      - social: people together — a gathering, party, friends, or family
      - screen: a device itself — TV, monitor, phone, laptop — with no identifiable work on it
      - nature: the outdoors — landscapes, plants, sky, water, weather, wild animals
      - pet: a pet cat, dog, or companion animal
      - activity: a sport, concert, workout, hobby, or performance
      - place: a notable building, interior, street, or venue (no clear people or food)
      - document: plain text — a receipt, a menu, a sign, a screenshot, a page of writing
      - other: anything that does not fit the above
      Then give a short, specific 2-5 word 'subject' phrase for the main thing
      (e.g. "a bowl of ramen", "friends at dinner", "a worn paperback"). No emoji, no quotes.
      Only when the category is media, also identify the work:
      - mediaKind: book, film, show, game, music, or art
      - title: the work's full official title. Use the text read in the photo plus your
        own knowledge of the work — cover text is often partial or split across lines
        (author, title fragments, publisher). Only name a title the photo's text actually
        supports; if the text is fragmentary, unrelated to any work you know, or reads
        like random scene text rather than a cover, leave title empty — never assemble
        a title by guessing.
      - creator: the work's author / director / artist, if you are confident.
      When the category is not media, set mediaKind to none and leave title and creator empty.
      """
    )
    let session = LanguageModelSession(instructions: instructions)

    let primary = cleaned.first ?? "an everyday moment"
    let rest = cleaned.dropFirst().prefix(8).joined(separator: ", ")
    var described = "mainly \(primary)"
    if !rest.isEmpty { described += " (also in frame: \(rest))" }
    if faceCount >= 2 {
      described += "; multiple people are in the photo"
    } else if faceCount == 1 {
      described += "; one person is in the photo"
    }
    let text = cleanedOCR.prefix(12).joined(separator: " / ")
    var prompt = "The photo shows \(described)."
    if !text.isEmpty {
      prompt += " Text read in the photo: \"\(text)\"."
    }
    prompt += " Classify it now."

    do {
      let response = try await session.respond(to: Prompt(prompt), generating: SceneDeepRead.self)
      return [
        "type": response.content.type,
        "subject": response.content.subject,
        "mediaKind": response.content.mediaKind,
        "title": response.content.title,
        "creator": response.content.creator,
      ]
    } catch {
      return [:]
    }
  }
  #endif

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func classifyScene(tags: [String], faceCount: Int) async -> [String: String] {
    guard case .available = SystemLanguageModel.default.availability else {
      return [:]
    }
    let cleaned = tags.filter { !$0.isEmpty }
    guard !cleaned.isEmpty else {
      return [:]
    }

    let instructions = Instructions(
      """
      You classify what a personal photo is mainly about, for a gentle journaling app.
      You receive what an on-device vision model detected, with the MAIN subject first.
      First distinguish real physical scenes from screenshots, games, cartoons,
      illustrations, app interfaces, and screen content. Depicted objects are not
      real-life memories: an illustrated/game egg is not food and a cartoon dog is
      not a pet. Choose screen or document for unidentified digital content.
      Choose the single best top-level category:
      - food: a real photographed meal, drink, snack, dessert, or cooking — never
        an icon, illustration, cartoon, screenshot, or video-game object
      - social: people together — a gathering, party, friends, or family
      - screen: a TV, monitor, phone, laptop, or video game shown in the photo
      - nature: the outdoors — landscapes, plants, sky, water, weather, wild animals
      - pet: a pet cat, dog, or companion animal
      - activity: a sport, concert, workout, hobby, or performance
      - place: a notable building, interior, street, or venue (no clear people or food)
      - document: text, a sign, a menu, a screenshot, or a page
      - other: anything that does not fit the above
      Then give a short, specific 2-5 word 'subject' phrase for the main thing
      (e.g. "a bowl of ramen", "friends at dinner", "a match on TV"). No emoji, no quotes.
      """
    )
    let session = LanguageModelSession(instructions: instructions)

    let primary = cleaned.first ?? "an everyday moment"
    let rest = cleaned.dropFirst().prefix(8).joined(separator: ", ")
    var described = "mainly \(primary)"
    if !rest.isEmpty { described += " (also in frame: \(rest))" }
    if faceCount >= 2 {
      described += "; multiple people are in the photo"
    } else if faceCount == 1 {
      described += "; one person is in the photo"
    }
    let prompt = Prompt("The photo shows \(described). Classify it now.")

    do {
      let response = try await session.respond(to: prompt, generating: SceneClassification.self)
      return ["type": response.content.type, "subject": response.content.subject]
    } catch {
      return [:]
    }
  }
  #endif
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct PhotoVisualAnchor {
  @Guide(description: "Atomic dominant photo route", .anyOf(["animal.dog", "animal.cat", "animal.other", "people", "food", "media.book", "media.film", "media.show", "media.game", "media.music", "media.art", "media.other", "movement", "place", "work", "nature", "life_event", "document", "screen", "other"]))
  let routeKey: String

  @Guide(description: "How the image itself is represented", .anyOf(["physical_scene", "physical_artwork", "physical_document", "device_showing_content", "native_digital_image", "screenshot", "unknown"]))
  let representation: String

  @Guide(description: "The physical or digital container holding depicted content", .anyOf(["none", "book", "screen", "frame_or_canvas", "poster_or_print", "document", "packaging", "unknown"]))
  let container: String

  @Guide(description: "A visual-only 2-5 word subject with no identity invented from text")
  let subject: String

  @Guide(description: "Confidence in the dominant visual route", .range(0.0...1.0))
  let confidence: Double

  @Guide(description: "One plausible alternative atomic route, or empty")
  let alternativeRouteKey: String

  @Guide(description: "How a later OCR pass may enrich the locked route", .anyOf(["identity", "context", "ignore"]))
  let ocrPurpose: String

  @Guide(description: "Up to four other visually supported subjects, comma-separated, or empty")
  let supportingSubjects: String
}

@available(iOS 26.0, *)
@Generable
struct PhotoOcrEnrichment {
  @Guide(description: "Whether OCR was usable", .anyOf(["used", "partial", "discard"]))
  let disposition: String

  @Guide(description: "A refined subject that remains within the locked route, or empty")
  let subject: String

  @Guide(description: "OCR-supported official title, or empty")
  let title: String

  @Guide(description: "OCR-supported creator or author, or empty")
  let creator: String

  @Guide(description: "Confidence in the OCR identity", .range(0.0...1.0))
  let confidence: Double

  @Guide(description: "Zero-based OCR line indexes used, comma-separated, or empty")
  let usedOcrIndexes: String

  @Guide(description: "Short reason for using or discarding the OCR")
  let reason: String
}

@available(iOS 26.0, *)
@Generable
struct PhotoJournalFieldEnrichment {
  @Guide(description: "Whether OCR produced a supported field value", .anyOf(["used", "partial", "discard"]))
  let disposition: String

  @Guide(description: "A concise OCR-supported value for the selected journal field, or empty")
  let specific: String

  @Guide(description: "Confidence in the field value", .range(0.0...1.0))
  let confidence: Double

  @Guide(description: "Zero-based OCR line indexes used, comma-separated, or empty")
  let usedOcrIndexes: String

  @Guide(description: "Short reason for using or discarding the OCR")
  let reason: String
}

@available(iOS 26.0, *)
@Generable
struct PhotoJournalBookFieldEnrichment {
  @Guide(description: "Whether the OCR supports an official book title", .anyOf(["used", "partial", "discard"]))
  let disposition: String

  @Guide(description: "The official main book title using only supplied OCR words; never an endorsement, bestseller claim, review quote, author, subtitle alone, or publisher slogan")
  let title: String

  @Guide(description: "The author name from OCR, kept separate from the title, or empty")
  let author: String

  @Guide(description: "The optional subtitle from OCR, kept separate from the main title, or empty")
  let subtitle: String

  @Guide(description: "Promotional or endorsement text rejected as not being the title, or empty")
  let marketingCopy: String

  @Guide(description: "Confidence that title is the official main book title", .range(0.0...1.0))
  let confidence: Double

  @Guide(description: "Zero-based OCR line indexes used for the title only, comma-separated, or empty")
  let usedTitleOcrIndexes: String

  @Guide(description: "Zero-based OCR line indexes used for the author only, comma-separated, or empty")
  let usedAuthorOcrIndexes: String

  @Guide(description: "Zero-based OCR line indexes used for the subtitle only, comma-separated, or empty")
  let usedSubtitleOcrIndexes: String

  @Guide(description: "Zero-based OCR line indexes used for marketing or endorsement copy only, comma-separated, or empty")
  let usedMarketingOcrIndexes: String

  @Guide(description: "Short explanation distinguishing title from author and marketing copy")
  let reason: String
}

@available(iOS 26.0, *)
@Generable
struct MemoryRead {
  @Guide(description: "How the image itself is represented", .anyOf(["physical_scene", "physical_artwork", "physical_document", "device_showing_content", "native_digital_image", "screenshot", "unknown"]))
  let representation: String

  @Guide(description: "The physical or digital container holding the depicted content", .anyOf(["none", "book", "screen", "frame_or_canvas", "poster_or_print", "document", "packaging", "unknown"]))
  let container: String

  @Guide(description: "Confidence in the dominant classification", .range(0.0...1.0))
  let confidence: Double

  @Guide(description: "Up to three plausible alternative domain or subject labels, comma-separated, or empty")
  let alternatives: String

  @Guide(description: "The dominant memory domain", .anyOf(["animal", "people", "food", "media", "movement", "place", "work", "nature", "life_event", "other"]))
  let domain: String

  @Guide(description: "A short specific 2-5 word subject phrase with no punctuation")
  let subject: String

  @Guide(description: "Up to four other clearly visible subjects, comma-separated, or empty")
  let supportingSubjects: String

  @Guide(description: "The animal kind, or none", .anyOf(["none", "dog", "cat", "other"]))
  let animalKind: String

  @Guide(description: "The media kind, or none", .anyOf(["none", "book", "film", "show", "game", "music", "art"]))
  let mediaKind: String

  @Guide(description: "The OCR-supported official media title, or empty")
  let title: String

  @Guide(description: "The confidently known creator, or empty")
  let creator: String

  @Guide(description: "A short dish or drink name, or empty")
  let food: String

  @Guide(description: "The movement kind, or none", .anyOf(["none", "walk", "run", "hike", "cycle", "workout", "transit", "commute", "drive", "travel", "mixed"]))
  let activity: String
}

@available(iOS 26.0, *)
@Generable
struct MeaningOption {
  @Guide(description: "A short present-tense phrase (2–4 words, under 24 characters) for what the person is doing or savouring in the moment, anchored to the photo's main subject")
  let label: String

  @Guide(description: "The feeling this option expresses", .anyOf(["calm", "energy", "together", "meaningful"]))
  let archetype: String
}

@available(iOS 26.0, *)
@Generable
struct MeaningOptionList {
  @Guide(description: "Exactly four options, one per feeling", .count(4))
  let options: [MeaningOption]
}

@available(iOS 26.0, *)
@Generable
struct SceneDeepRead {
  @Guide(
    description: "The single best top-level category for what the photo is mainly about",
    .anyOf(["media", "food", "social", "screen", "nature", "pet", "activity", "place", "document", "other"])
  )
  let type: String

  @Guide(description: "A short specific 2-5 word phrase naming the main subject (e.g. 'a bowl of ramen', 'friends at dinner'). No punctuation, no emoji, no quotes")
  let subject: String

  @Guide(
    description: "The kind of work when type is media, otherwise none",
    .anyOf(["none", "book", "film", "show", "game", "music", "art"])
  )
  let mediaKind: String

  @Guide(description: "The work's full official title when type is media and the photo's text identifies it (complete partial cover text using knowledge of the work). Empty otherwise. No quotes")
  let title: String

  @Guide(description: "The work's author, director, or artist when confidently known. Empty otherwise. No quotes")
  let creator: String
}

@available(iOS 26.0, *)
@Generable
struct SceneClassification {
  @Guide(
    description: "The single best top-level category for what the photo is mainly about",
    .anyOf(["food", "social", "screen", "nature", "pet", "activity", "place", "document", "other"])
  )
  let type: String

  @Guide(description: "A short specific 2-5 word phrase naming the main subject (e.g. 'a bowl of ramen', 'friends at dinner'). No punctuation, no emoji, no quotes")
  let subject: String
}
#endif
