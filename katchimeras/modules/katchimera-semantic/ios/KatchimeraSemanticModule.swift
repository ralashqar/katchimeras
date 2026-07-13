import ExpoModulesCore
import Foundation
import NaturalLanguage

public final class KatchimeraSemanticModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KatchimeraSemantic")

    Function("availability") { (languageCode: String) -> [String: Any] in
      let language = Self.language(languageCode)
      let word = NLEmbedding.wordEmbedding(for: language)
      let sentence = NLEmbedding.sentenceEmbedding(for: language)
      var result: [String: Any] = [
        "wordEmbeddingAvailable": word != nil,
        "sentenceEmbeddingAvailable": sentence != nil,
        "language": languageCode,
      ]
      if let word { result["wordRevision"] = word.revision }
      if let sentence { result["sentenceRevision"] = sentence.revision }
      if word == nil && sentence == nil { result["reason"] = "language_embeddings_unavailable" }
      return result
    }

    AsyncFunction("compareLabelsAsync") { (labels: [[String: Any]], categories: [[String: Any]], languageCode: String) -> [[String: Any]] in
      let language = Self.language(languageCode)
      guard let embedding = NLEmbedding.wordEmbedding(for: language) else { return [] }
      return categories.compactMap { category in
        guard let id = category["id"] as? String else { return nil }
        let anchors = category["wordAnchors"] as? [String] ?? []
        var best = 0.0
        var matches: [[String: Any]] = []
        for label in labels {
          guard let text = label["text"] as? String else { continue }
          let confidence = label["confidence"] as? Double ?? 0
          let prominence = label["prominence"] as? Double ?? 1
          for anchor in anchors {
            guard let similarity = Self.similarity(text, anchor, embedding) else { continue }
            let weighted = similarity * max(0, min(1, confidence)) * max(0.45, min(1, prominence))
            if weighted > best { best = weighted }
            if similarity >= 0.45 {
              matches.append(["input": text, "anchor": anchor, "score": Self.round(similarity), "kind": "word"])
            }
          }
        }
        return Self.result(id, best, nil, nil, matches)
      }
    }

    AsyncFunction("compareTextAsync") { (text: String, categories: [[String: Any]], languageCode: String) -> [[String: Any]] in
      let language = Self.language(languageCode)
      let wordEmbedding = NLEmbedding.wordEmbedding(for: language)
      let sentenceEmbedding = NLEmbedding.sentenceEmbedding(for: language)
      let terms = Self.contentTerms(text, language)
      return categories.compactMap { category in
        guard let id = category["id"] as? String else { return nil }
        let words = category["wordAnchors"] as? [String] ?? []
        let positives = category["positiveSentences"] as? [String] ?? []
        let negatives = category["negativeSentences"] as? [String] ?? []
        var wordBest = 0.0
        var sentenceBest = 0.0
        var negativeBest = 0.0
        var matches: [[String: Any]] = []
        if let wordEmbedding {
          for term in terms {
            for anchor in words {
              guard let value = Self.similarity(term, anchor, wordEmbedding) else { continue }
              if value > wordBest { wordBest = value }
              if value >= 0.52 { matches.append(["input": term, "anchor": anchor, "score": Self.round(value), "kind": "word"]) }
            }
          }
        }
        if let sentenceEmbedding {
          for anchor in positives {
            guard let value = Self.similarity(text, anchor, sentenceEmbedding) else { continue }
            if value > sentenceBest { sentenceBest = value }
            if value >= 0.45 { matches.append(["input": text, "anchor": anchor, "score": Self.round(value), "kind": "sentence"]) }
          }
          for anchor in negatives {
            guard let value = Self.similarity(text, anchor, sentenceEmbedding) else { continue }
            if value > negativeBest { negativeBest = value }
            if value >= 0.55 { matches.append(["input": text, "anchor": anchor, "score": Self.round(value), "kind": "negative"]) }
          }
        }
        return Self.result(id, wordEmbedding == nil ? nil : wordBest, sentenceEmbedding == nil ? nil : sentenceBest, sentenceEmbedding == nil ? nil : negativeBest, matches)
      }
    }
  }

  private static func result(_ id: String, _ word: Double?, _ sentence: Double?, _ negative: Double?, _ matches: [[String: Any]]) -> [String: Any] {
    var result: [String: Any] = ["categoryId": id, "matchedAnchors": matches.sorted { ($0["score"] as? Double ?? 0) > ($1["score"] as? Double ?? 0) }.prefix(8).map { $0 }]
    result["wordScore"] = word.map(round) ?? NSNull()
    result["sentenceScore"] = sentence.map(round) ?? NSNull()
    result["negativeScore"] = negative.map(round) ?? NSNull()
    return result
  }

  private static func similarity(_ left: String, _ right: String, _ embedding: NLEmbedding) -> Double? {
    let lhs = left.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    let rhs = right.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    guard !lhs.isEmpty, !rhs.isEmpty else { return nil }
    if lhs == rhs { return 1 }
    let distance = embedding.distance(between: lhs, and: rhs, distanceType: .cosine)
    guard distance.isFinite else { return nil }
    return max(0, min(1, 1 - Double(distance)))
  }

  private static func contentTerms(_ text: String, _ language: NLLanguage) -> [String] {
    let tagger = NLTagger(tagSchemes: [.lexicalClass, .lemma])
    tagger.string = text
    tagger.setLanguage(language, range: text.startIndex..<text.endIndex)
    var terms: [String] = []
    let options: NLTagger.Options = [.omitWhitespace, .omitPunctuation, .joinNames]
    tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .lexicalClass, options: options) { tag, range in
      if tag == .noun || tag == .verb || tag == .adjective || tag == .otherWord {
        let token = String(text[range]).lowercased()
        if token.count > 1 { terms.append(token) }
      }
      return true
    }
    return Array(Set(terms)).prefix(24).map { $0 }
  }

  private static func language(_ code: String) -> NLLanguage {
    switch code.lowercased().split(separator: "-").first.map(String.init) {
    case "fr": return .french
    case "de": return .german
    case "es": return .spanish
    case "it": return .italian
    case "pt": return .portuguese
    case "zh": return .simplifiedChinese
    case "ja": return .japanese
    case "ko": return .korean
    default: return .english
    }
  }

  private static func round(_ value: Double) -> Double { (value * 10000).rounded() / 10000 }
}
