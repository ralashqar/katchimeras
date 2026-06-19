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
      You help a gentle journaling app label what a photo meant to the person who took it.
      You receive the things an on-device vision model detected in the photo.
      Return exactly four options, one for each feeling: calm, energy, together, meaningful.
      Each option's label is 1–3 warm everyday words that fit BOTH the photo and that feeling
      (e.g. for a meal: "Comfort"/calm, "A treat"/energy, "Shared"/together, "Worth savoring"/meaningful).
      No punctuation, no emoji, no hashtags. Keep it human and specific to the photo.
      """
    )
    let session = LanguageModelSession(instructions: instructions)

    var described = tags.filter { !$0.isEmpty }.joined(separator: ", ")
    if described.isEmpty { described = "an everyday moment" }
    if faceCount >= 2 {
      described += "; people are together in the photo"
    } else if faceCount == 1 {
      described += "; a person is in the photo"
    }
    let prompt = Prompt("The photo shows: \(described). Suggest the four options now.")

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
  @Guide(description: "A warm 1–3 word label for what the moment meant")
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
