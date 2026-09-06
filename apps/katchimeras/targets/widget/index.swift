import WidgetKit
import SwiftUI

private let appGroup = "group.com.daruk.katchimeras"

struct KatchimeraEntry: TimelineEntry {
    let date: Date
    let status: String
    let title: String
    let subtitle: String
    let image: String
}

struct KatchimeraProvider: TimelineProvider {
    func placeholder(in context: Context) -> KatchimeraEntry {
        KatchimeraEntry(
            date: Date(),
            status: "forming",
            title: "Gathering shape",
            subtitle: "Live a little, then return",
            image: "egg"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (KatchimeraEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KatchimeraEntry>) -> Void) {
        let entry = loadEntry()
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())
            ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func loadEntry() -> KatchimeraEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        return KatchimeraEntry(
            date: Date(),
            status: defaults?.string(forKey: "kw_status") ?? "forming",
            title: defaults?.string(forKey: "kw_title") ?? "Gathering shape",
            subtitle: defaults?.string(forKey: "kw_subtitle") ?? "Live a little, then return",
            image: defaults?.string(forKey: "kw_image") ?? "egg"
        )
    }
}

struct KatchimeraWidgetView: View {
    var entry: KatchimeraEntry
    @Environment(\.widgetFamily) var family

    private let ember = Color(red: 1.0, green: 0.764, blue: 0.42)
    private let moon = Color(red: 0.965, green: 0.953, blue: 1.0)
    private let moonDim = Color(red: 0.565, green: 0.541, blue: 0.71)

    var body: some View {
        content
            .containerBackground(for: .widget) {
                LinearGradient(
                    colors: [
                        Color(red: 0.047, green: 0.039, blue: 0.078),
                        Color(red: 0.106, green: 0.078, blue: 0.188),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .widgetURL(URL(string: "katchimeras://"))
    }

    @ViewBuilder
    private var content: some View {
        if family == .systemMedium {
            mediumView
        } else {
            smallView
        }
    }

    private var smallView: some View {
        VStack(spacing: 5) {
            subjectImage(size: 78)
            Text(entry.title)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(moon)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(entry.subtitle)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(entry.status == "ready" ? ember : moonDim)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private var mediumView: some View {
        HStack(spacing: 14) {
            subjectImage(size: 104)
            VStack(alignment: .leading, spacing: 6) {
                Text(statusLabel)
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1.6)
                    .foregroundColor(entry.status == "ready" ? ember : moonDim)
                Text(entry.title)
                    .font(.system(size: 21, weight: .bold, design: .serif))
                    .italic()
                    .foregroundColor(moon)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(entry.subtitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(moonDim)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }

    private var statusLabel: String {
        switch entry.status {
        case "hatched":
            return "TODAY BECAME"
        case "ready":
            return "READY TO HATCH"
        default:
            return "FORMING"
        }
    }

    private func subjectImage(size: CGFloat) -> some View {
        Image(entry.image)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .shadow(color: ember.opacity(entry.status == "ready" ? 0.55 : 0.25), radius: 14)
    }
}

struct KatchimeraWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "KatchimeraWidget", provider: KatchimeraProvider()) { entry in
            KatchimeraWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's egg")
        .description("Your day, forming on the home screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct KatchimeraWidgetBundle: WidgetBundle {
    var body: some Widget {
        KatchimeraWidget()
    }
}
