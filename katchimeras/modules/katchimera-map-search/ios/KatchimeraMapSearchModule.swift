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
  }
}
