const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const swift = read('modules', 'katchimera-map-search', 'ios', 'KatchimeraMapSearchModule.swift');
const config = JSON.parse(read('modules', 'katchimera-map-search', 'expo-module.config.json'));
const podspec = read('modules', 'katchimera-map-search', 'ios', 'KatchimeraMapSearch.podspec');
const field = read('components', 'katchadeck', 'home', 'journal-location-field.tsx');
const composer = read('components', 'katchadeck', 'home', 'manual-journal-sheet.tsx');
const domain = read('utils', 'journal-domain.ts');
const mutation = read('game', 'days', 'mutations', 'manual-journal.ts');
const placeSearch = read('utils', 'journal-place-search.ts');

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.error(`FAIL  ${label}`); }
}

check('Expo autolinking registers the Apple module', config.platforms.includes('apple') && config.apple.modules.includes('KatchimeraMapSearchModule'));
check('pod links MapKit and CoreLocation', podspec.includes("s.frameworks = 'MapKit', 'CoreLocation'"));
check('native bridge uses grounded MKLocalSearch', swift.includes('MKLocalSearch.Request()') && swift.includes('naturalLanguageQuery') && swift.includes('MKLocalSearch(request: request).start()'));
check('nearby searches receive a bounded map region', swift.includes('MKCoordinateRegion(') && swift.includes('min(max(radiusMeters, 1_000), 100_000)'));
check('search failures stay optional', swift.includes('promise.resolve([[String: Any]]())'));
check('suggestions are displayed with an Apple map before confirmation', field.includes('<SuggestionMap') && field.includes("import('react-native-maps')") && field.includes('Optional · confirm before it is saved'));
check('user can choose current, manual, or no location', field.includes('Use current') && field.includes('Choose on map') && field.includes('No location'));
check(
  'location UI is restricted to the place flow',
  composer.includes("{flow.id === 'went_somewhere' ?") && composer.includes('location: flow.id ==='),
);
check('unnamed place categories provide search-only fallbacks', placeSearch.includes("museum: 'museum or gallery'") && placeSearch.includes("cafe: 'cafe'") && composer.includes('journalPlaceSearchQuery(specific'));
check('category fallback waits for named-place extraction', composer.includes("journalPlaceSearchQuery(specific, noteSpecificLoading ? '' : choice.id)"));
check('search uses meaningful non-home clusters from the journal day', placeSearch.includes("point.source === 'manual' || point.source === 'photo_attachment'") && placeSearch.includes('!hasAwayCluster || !cluster.home') && field.includes('searchApplePlacesAroundAnchors'));
check('the domain strips location from non-place routes', domain.includes("flow.adapter === 'place' ? sanitizeJournalLocation"));
check('confirmed locations project into day-map points', mutation.includes('journalRecordId: record.id') && mutation.includes('locations: record.location'));

if (failures) process.exit(1);
console.log('\nMap search native bridge verified.');
