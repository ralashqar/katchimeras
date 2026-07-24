import CoreLocation
import ExpoModulesCore
import Foundation
import MapKit

public final class KatchimeraMapSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KatchimeraMapSearch")

    Function("isAvailable") { () -> Bool in true }

    AsyncFunction("searchAsync") {
      (query: String, latitude: Double?, longitude: Double?, radiusMeters: Double, promise: Promise) in
      let cleanQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !cleanQuery.isEmpty else {
        promise.resolve([[String: Any]]())
        return
      }

      Task { @MainActor in
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = cleanQuery
        request.resultTypes = [.pointOfInterest, .address]

        var anchor: CLLocation?
        if let latitude, let longitude,
           CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: latitude, longitude: longitude)) {
          let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
          let radius = min(max(radiusMeters, 1_000), 100_000)
          request.region = MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: radius * 2,
            longitudinalMeters: radius * 2
          )
          anchor = CLLocation(latitude: latitude, longitude: longitude)
        }

        do {
          let response = try await MKLocalSearch(request: request).start()
          let results = response.mapItems.prefix(8).enumerated().map { index, item -> [String: Any] in
            let coordinate = item.placemark.coordinate
            let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            let name = item.name?.trimmingCharacters(in: .whitespacesAndNewlines)
            let address = item.placemark.title?.trimmingCharacters(in: .whitespacesAndNewlines)
            let stableName = (name?.isEmpty == false ? name! : address) ?? cleanQuery
            let stableAddress = address == stableName ? nil : address
            let rawId = "\(stableName)|\(coordinate.latitude),\(coordinate.longitude)"
            var result: [String: Any] = [
              "id": rawId,
              "name": stableName,
              "latitude": coordinate.latitude,
              "longitude": coordinate.longitude,
              "rank": index,
            ]
            if let stableAddress, !stableAddress.isEmpty { result["address"] = stableAddress }
            if let category = item.pointOfInterestCategory?.rawValue { result["category"] = category }
            if let anchor { result["distanceMeters"] = anchor.distance(from: location) }
            return result
          }
          promise.resolve(results)
        } catch {
          // Location enrichment is optional. Resolve an empty set so a Maps or
          // network failure never blocks saving the journal entry.
          promise.resolve([[String: Any]]())
        }
      }
    }

    AsyncFunction("resolveNearbyPlacesAsync") {
      (latitude: Double, longitude: Double, radiusMeters: Double, promise: Promise) in
      let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      guard CLLocationCoordinate2DIsValid(coordinate),
            abs(latitude) > 0.0001 || abs(longitude) > 0.0001 else {
        promise.resolve([
          "candidates": [[String: Any]](),
          "lookupMetadata": [
            "searchRadiusMeters": radiusMeters,
            "candidateCount": 0,
          ],
          "errors": ["INVALID_COORDINATE"],
        ])
        return
      }

      Task { @MainActor in
        let boundedRadius = min(max(radiusMeters, 40), 200)
        let anchor = CLLocation(latitude: latitude, longitude: longitude)
        var candidates = [[String: Any]]()
        var areaCandidates = [[String: Any]]()
        var address: [String: Any]?
        var errors = [String]()

        do {
          let request = MKLocalPointsOfInterestRequest(center: coordinate, radius: boundedRadius)
          let response = try await MKLocalSearch(request: request).start()
          candidates = response.mapItems.prefix(25).enumerated().map { index, item in
            self.nearbyCandidate(item: item, anchor: anchor, rank: index)
          }
        } catch {
          errors.append(self.stableErrorCode(error, fallback: "MAP_LOOKUP_FAILED"))
        }

        do {
          address = try await self.reverseGeocode(location: anchor)
        } catch {
          errors.append(self.stableErrorCode(error, fallback: "GEOCODING_FAILED"))
        }

        let areaNames = address?["areasOfInterest"] as? [String] ?? []
        if !areaNames.isEmpty {
          areaCandidates = await self.resolveAreasOfInterest(
            areaNames,
            coordinate: coordinate,
            anchor: anchor
          )
        }

        var result: [String: Any] = [
          "candidates": candidates,
          "areaCandidates": areaCandidates,
          "lookupMetadata": [
            "searchRadiusMeters": boundedRadius,
            "candidateCount": candidates.count,
            "areaOfInterestCount": areaNames.count,
            "areaCandidateCount": areaCandidates.count,
          ],
        ]
        if let address { result["address"] = address }
        if !errors.isEmpty { result["errors"] = Array(Set(errors)) }
        promise.resolve(result)
      }
    }
  }

  @MainActor
  private func resolveAreasOfInterest(
    _ areaNames: [String],
    coordinate: CLLocationCoordinate2D,
    anchor: CLLocation
  ) async -> [[String: Any]] {
    var resolved = [[String: Any]]()
    for (areaIndex, areaName) in areaNames.prefix(3).enumerated() {
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = areaName
      request.region = MKCoordinateRegion(
        center: coordinate,
        latitudinalMeters: 10_000,
        longitudinalMeters: 10_000
      )
      request.resultTypes = [.pointOfInterest, .physicalFeature]

      do {
        let response = try await MKLocalSearch(request: request).start()
        let ranked = response.mapItems.prefix(12).enumerated().compactMap {
          (rank, item) -> (score: Double, match: Double, rank: Int, item: MKMapItem)? in
          let itemCoordinate = item.placemark.coordinate
          let distance = anchor.distance(
            from: CLLocation(
              latitude: itemCoordinate.latitude,
              longitude: itemCoordinate.longitude
            )
          )
          guard distance <= 10_000 else { return nil }
          let match = self.areaNameMatchScore(areaName, item.name ?? "")
          guard match >= 0.72 else { return nil }
          let proximity = exp(-distance / 5_000)
          let apiRank = 1.0 / Double(max(1, rank + 1))
          return (
            score: match * 0.82 + proximity * 0.12 + apiRank * 0.06,
            match: match,
            rank: rank,
            item: item
          )
        }.sorted { left, right in
          if left.score == right.score { return left.rank < right.rank }
          return left.score > right.score
        }

        guard let best = ranked.first else { continue }
        var candidate = self.nearbyCandidate(
          item: best.item,
          anchor: anchor,
          rank: areaIndex
        )
        candidate["areaName"] = areaName
        candidate["nameMatchScore"] = best.match
        candidate["associatedWithCoordinate"] = true
        resolved.append(candidate)
      } catch {
        // Area enrichment is optional. The original reverse-geocoded name is
        // still returned so JavaScript can show that resolution was attempted.
        continue
      }
    }
    return resolved
  }

  @MainActor
  private func nearbyCandidate(item: MKMapItem, anchor: CLLocation, rank: Int) -> [String: Any] {
    let coordinate = item.placemark.coordinate
    let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    let name = item.name?.trimmingCharacters(in: .whitespacesAndNewlines)
    let address = item.placemark.title?.trimmingCharacters(in: .whitespacesAndNewlines)
    let stableName = (name?.isEmpty == false ? name! : address) ?? "Nearby place"
    let rawCategory = item.pointOfInterestCategory?.rawValue
    var result: [String: Any] = [
      "id": "\(stableName)|\(coordinate.latitude),\(coordinate.longitude)",
      "name": stableName,
      "latitude": coordinate.latitude,
      "longitude": coordinate.longitude,
      "distanceMeters": anchor.distance(from: location),
      "normalizedCategory": normalizedCategory(item.pointOfInterestCategory),
      "rank": rank,
    ]
    if let rawCategory { result["rawCategory"] = rawCategory }
    if let address, address != stableName { result["address"] = address }
    if let phone = item.phoneNumber, !phone.isEmpty { result["phoneNumber"] = phone }
    if let url = item.url?.absoluteString { result["websiteUrl"] = url }
    if #available(iOS 18.0, *), let identifier = item.identifier {
      result["applePlaceId"] = identifier.rawValue
      result["id"] = identifier.rawValue
      let alternates = item.alternateIdentifiers.map(\.rawValue)
      if !alternates.isEmpty { result["alternateApplePlaceIds"] = alternates }
    }
    return result
  }

  @MainActor
  private func reverseGeocode(location: CLLocation) async throws -> [String: Any]? {
    if #available(iOS 26.0, *) {
      guard let request = MKReverseGeocodingRequest(location: location) else { return nil }
      let items = try await request.mapItems
      guard let item = items.first else { return nil }
      var result = [String: Any]()
      if let full = item.address?.fullAddress { result["formattedAddress"] = full }
      if let city = item.placemark.locality { result["city"] = city }
      if let code = item.placemark.isoCountryCode { result["countryCode"] = code }
      let areas = cleanAreaNames(item.placemark.areasOfInterest)
      if !areas.isEmpty { result["areasOfInterest"] = areas }
      return result.isEmpty ? nil : result
    }

    let placemarks = try await CLGeocoder().reverseGeocodeLocation(location)
    guard let placemark = placemarks.first else { return nil }
    var result = [String: Any]()
    let street = [placemark.subThoroughfare, placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
    let formatted = [street, placemark.locality, placemark.administrativeArea, placemark.postalCode, placemark.country]
      .compactMap { $0?.isEmpty == false ? $0 : nil }
      .joined(separator: ", ")
    if !formatted.isEmpty { result["formattedAddress"] = formatted }
    if !street.isEmpty { result["street"] = street }
    if let city = placemark.locality { result["city"] = city }
    if let area = placemark.administrativeArea { result["administrativeArea"] = area }
    if let postalCode = placemark.postalCode { result["postalCode"] = postalCode }
    if let countryCode = placemark.isoCountryCode { result["countryCode"] = countryCode }
    let areas = cleanAreaNames(placemark.areasOfInterest)
    if !areas.isEmpty { result["areasOfInterest"] = areas }
    return result.isEmpty ? nil : result
  }

  private func cleanAreaNames(_ values: [String]?) -> [String] {
    var seen = Set<String>()
    return (values ?? []).compactMap { value in
      let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !clean.isEmpty else { return nil }
      let key = clean.folding(
        options: [.caseInsensitive, .diacriticInsensitive],
        locale: Locale(identifier: "en_US_POSIX")
      )
      guard seen.insert(key).inserted else { return nil }
      return clean
    }.prefix(5).map { $0 }
  }

  private func areaNameMatchScore(_ left: String, _ right: String) -> Double {
    let leftText = normalizedPlaceName(left)
    let rightText = normalizedPlaceName(right)
    guard !leftText.isEmpty, !rightText.isEmpty else { return 0 }
    if leftText == rightText { return 1 }
    if leftText.contains(rightText) || rightText.contains(leftText) { return 0.9 }
    let leftTokens = Set(leftText.split(separator: " ").map(String.init))
    let rightTokens = Set(rightText.split(separator: " ").map(String.init))
    let overlap = leftTokens.intersection(rightTokens).count
    return (2 * Double(overlap)) / Double(max(1, leftTokens.count + rightTokens.count))
  }

  private func normalizedPlaceName(_ value: String) -> String {
    let folded = value.folding(
      options: [.caseInsensitive, .diacriticInsensitive],
      locale: Locale(identifier: "en_US_POSIX")
    )
    return folded
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  private func normalizedCategory(_ category: MKPointOfInterestCategory?) -> String {
    guard let category else { return "unknown" }
    switch category {
    case .cafe: return "cafe"
    case .restaurant: return "restaurant"
    case .bakery: return "bakery"
    case .brewery, .nightlife: return "bar"
    case .museum: return "museum"
    case .library: return "library"
    case .movieTheater: return "cinema"
    case .theater: return "theatre"
    case .park, .nationalPark: return "park"
    case .beach: return "beach"
    case .fitnessCenter: return "gym"
    case .stadium: return "sports"
    case .store: return "shop"
    case .foodMarket: return "supermarket"
    case .hotel: return "hotel"
    case .school: return "school"
    case .university: return "university"
    case .hospital: return "hospital"
    case .pharmacy: return "pharmacy"
    case .airport: return "airport"
    case .publicTransport: return "transport"
    case .marina: return "nature"
    default: return "unknown"
    }
  }

  private func stableErrorCode(_ error: Error, fallback: String) -> String {
    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorNotConnectedToInternet {
      return "NETWORK_UNAVAILABLE"
    }
    return fallback
  }
}
