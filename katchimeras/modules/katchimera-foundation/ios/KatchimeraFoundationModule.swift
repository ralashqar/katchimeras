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
  }

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
}

#if canImport(FoundationModels)
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
#endif
