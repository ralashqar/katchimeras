import ExpoModulesCore
import HealthKit

public final class KatchimeraHealthRoutesModule: Module {
  private let healthStore = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("KatchimeraHealthRoutes")

    AsyncFunction("getHealthRouteAvailabilityAsync") { (promise: Promise) in
      self.getHealthRouteAvailability(promise: promise)
    }

    AsyncFunction("requestHealthRoutePermissionAsync") { (promise: Promise) in
      self.requestHealthRoutePermission(promise: promise)
    }

    AsyncFunction("importRoutesForDayAsync") { (isoDate: String, promise: Promise) in
      self.importRoutesForDay(isoDate: isoDate, promise: promise)
    }
  }

  private func getHealthRouteAvailability(promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve([
        "platformSupported": false,
        "permissionState": "unavailable"
      ])
      return
    }

    healthStore.getRequestStatusForAuthorization(toShare: shareTypes(), read: readTypes()) { status, _ in
      promise.resolve([
        "platformSupported": true,
        "permissionState": self.mapAuthorizationStatus(status)
      ])
    }
  }

  private func requestHealthRoutePermission(promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve(["permissionState": "unavailable"])
      return
    }

    healthStore.requestAuthorization(toShare: shareTypes(), read: readTypes()) { success, _ in
      promise.resolve([
        "permissionState": success ? "granted" : "denied"
      ])
    }
  }

  private func importRoutesForDay(isoDate: String, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve(baseImportResult(status: "unavailable"))
      return
    }

    guard let dayWindow = resolveDayWindow(isoDate: isoDate) else {
      promise.resolve(baseImportResult(status: "error", message: "The selected day could not be parsed."))
      return
    }

    fetchWorkoutsIntersecting(dayWindow: dayWindow) { result in
      switch result {
      case .failure(let error):
        promise.resolve(self.baseImportResult(status: "error", message: error.localizedDescription))
      case .success(let workouts):
        let intersectingWorkouts = workouts.filter { workout in
          workout.endDate > dayWindow.start && workout.startDate < dayWindow.end
        }

        guard !intersectingWorkouts.isEmpty else {
          promise.resolve(self.baseImportResult(status: "no_data", message: "No workout route was found for this day."))
          return
        }

        self.fetchSegments(for: intersectingWorkouts, dayWindow: dayWindow) { fetchResult in
          switch fetchResult {
          case .failure(let error):
            promise.resolve(self.baseImportResult(status: "error", message: error.localizedDescription))
          case .success(let segments):
            guard !segments.isEmpty else {
              promise.resolve(
                self.baseImportResult(status: "no_data", message: "No workout route was found for this day.")
              )
              return
            }

            let workoutIds = Array(Set(segments.compactMap { $0["workoutId"] as? String })).sorted()
            let sampledPointCount = segments.reduce(0) { partialResult, item in
              partialResult + ((item["coordinates"] as? [[String: Any]])?.count ?? 0)
            }

            promise.resolve([
              "status": "success",
              "importedWorkoutCount": workoutIds.count,
              "sampledPointCount": sampledPointCount,
              "segmentCount": segments.count,
              "workoutIds": workoutIds,
              "segments": segments
            ])
          }
        }
      }
    }
  }

  private func fetchWorkoutsIntersecting(
    dayWindow: (start: Date, end: Date),
    completion: @escaping (Result<[HKWorkout], Error>) -> Void
  ) {
    let workoutType = HKObjectType.workoutType()
    let predicate = HKQuery.predicateForSamples(withStart: dayWindow.start, end: dayWindow.end, options: [])
    let sortDescriptors = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]

    let query = HKSampleQuery(
      sampleType: workoutType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: sortDescriptors
    ) { _, samples, error in
      if let error {
        completion(.failure(error))
        return
      }

      completion(.success((samples as? [HKWorkout]) ?? []))
    }

    healthStore.execute(query)
  }

  private func fetchSegments(
    for workouts: [HKWorkout],
    dayWindow: (start: Date, end: Date),
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    var collectedSegments: [[String: Any]] = []

    func processWorkout(at index: Int) {
      if index >= workouts.count {
        completion(.success(collectedSegments))
        return
      }

      let workout = workouts[index]
      fetchRouteSamples(for: workout) { routeResult in
        switch routeResult {
        case .failure(let error):
          completion(.failure(error))
        case .success(let routes):
          self.fetchSegmentsForRoutes(
            routes,
            workout: workout,
            dayWindow: dayWindow
          ) { segmentsResult in
            switch segmentsResult {
            case .failure(let error):
              completion(.failure(error))
            case .success(let segments):
              collectedSegments.append(contentsOf: segments)
              processWorkout(at: index + 1)
            }
          }
        }
      }
    }

    processWorkout(at: 0)
  }

  private func fetchRouteSamples(
    for workout: HKWorkout,
    completion: @escaping (Result<[HKWorkoutRoute], Error>) -> Void
  ) {
    let routeType = HKSeriesType.workoutRoute()
    let predicate = HKQuery.predicateForObjects(from: workout)

    let query = HKSampleQuery(
      sampleType: routeType,
      predicate: predicate,
      limit: HKObjectQueryNoLimit,
      sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
    ) { _, samples, error in
      if let error {
        completion(.failure(error))
        return
      }

      completion(.success((samples as? [HKWorkoutRoute]) ?? []))
    }

    healthStore.execute(query)
  }

  private func fetchSegmentsForRoutes(
    _ routes: [HKWorkoutRoute],
    workout: HKWorkout,
    dayWindow: (start: Date, end: Date),
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    var segments: [[String: Any]] = []

    func processRoute(at index: Int) {
      if index >= routes.count {
        completion(.success(segments))
        return
      }

      let route = routes[index]
      fetchLocations(for: route, dayWindow: dayWindow) { routeResult in
        switch routeResult {
        case .failure(let error):
          completion(.failure(error))
        case .success(let coordinates):
          if let firstCoordinate = coordinates.first,
             let lastCoordinate = coordinates.last {
            segments.append([
              "id": route.uuid.uuidString,
              "workoutId": workout.uuid.uuidString,
              "activityType": self.activityTypeLabel(for: workout.workoutActivityType),
              "startedAt": firstCoordinate["capturedAt"] ?? workout.startDate.toISOString(),
              "endedAt": lastCoordinate["capturedAt"] ?? workout.endDate.toISOString(),
              "coordinates": coordinates
            ])
          }
          processRoute(at: index + 1)
        }
      }
    }

    processRoute(at: 0)
  }

  private func fetchLocations(
    for route: HKWorkoutRoute,
    dayWindow: (start: Date, end: Date),
    completion: @escaping (Result<[[String: Any]], Error>) -> Void
  ) {
    var coordinates: [[String: Any]] = []

    let query = HKWorkoutRouteQuery(route: route) { _, locationsOrNil, done, error in
      if let error {
        completion(.failure(error))
        return
      }

      if let locations = locationsOrNil {
        coordinates.append(
          contentsOf: locations.compactMap { location in
            guard location.timestamp >= dayWindow.start && location.timestamp < dayWindow.end else {
              return nil
            }

            return [
              "latitude": location.coordinate.latitude,
              "longitude": location.coordinate.longitude,
              "capturedAt": location.timestamp.toISOString()
            ]
          }
        )
      }

      if done {
        completion(.success(coordinates))
      }
    }

    healthStore.execute(query)
  }

  private func readTypes() -> Set<HKObjectType> {
    return [
      HKObjectType.workoutType(),
      HKSeriesType.workoutRoute()
    ]
  }

  private func shareTypes() -> Set<HKSampleType> {
    return []
  }

  private func mapAuthorizationStatus(_ status: HKAuthorizationRequestStatus) -> String {
    switch status {
    case .unnecessary:
      return "granted"
    case .shouldRequest:
      return "unknown"
    case .unknown:
      return "unknown"
    @unknown default:
      return "unknown"
    }
  }

  private func resolveDayWindow(isoDate: String) -> (start: Date, end: Date)? {
    let formatter = DateFormatter()
    formatter.calendar = Calendar.current
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"

    guard let dayStart = formatter.date(from: isoDate) else {
      return nil
    }

    guard let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart) else {
      return nil
    }

    return (start: dayStart, end: dayEnd)
  }

  private func activityTypeLabel(for activityType: HKWorkoutActivityType) -> String {
    switch activityType {
    case .walking:
      return "walking"
    case .running:
      return "running"
    case .hiking:
      return "hiking"
    case .cycling:
      return "cycling"
    default:
      return "unknown"
    }
  }

  private func baseImportResult(status: String, message: String? = nil) -> [String: Any] {
    return [
      "status": status,
      "importedWorkoutCount": 0,
      "sampledPointCount": 0,
      "segmentCount": 0,
      "workoutIds": [],
      "message": message as Any
    ]
  }
}

private extension Date {
  func toISOString() -> String {
    return ISO8601DateFormatter().string(from: self)
  }
}
