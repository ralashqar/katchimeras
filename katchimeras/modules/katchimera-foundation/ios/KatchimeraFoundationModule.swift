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

    // Unified structured read used by the v8 intelligence pipeline. Sensitive
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
struct NoteRead {
  @Guide(description: "A short warm 2-4 word title for the moment (under 24 characters), specific to the note. No punctuation, no emoji, no quotes")
  let title: String

  @Guide(description: "The dominant feeling of the note", .anyOf(["calm", "energy", "together", "meaningful"]))
  let feeling: String

  @Guide(
    description: "The kind of media the note mentions taking in; use other for watched sport/news, podcasts, livestreams, or another consumed format, otherwise none",
    .anyOf(["none", "book", "film", "show", "game", "music", "art", "other"])
  )
  let mediaKind: String

  @Guide(description: "The mentioned work's full official title with correct capitalization, completed from knowledge of the work when the transcript is lowercase or partial. Empty when no work was named or mediaKind is none. No quotes")
  let mediaTitle: String

  @Guide(description: "That work's author, director, or artist when confidently known. Empty otherwise. No quotes")
  let mediaCreator: String

  @Guide(description: "A short 1-4 word name of the dish or drink when the note is about eating or drinking something specific. Empty otherwise. No quotes")
  let food: String
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
