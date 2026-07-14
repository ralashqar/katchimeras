require('tsx/cjs');

const { evaluatePhotoForQuest } = require('../utils/quests/photo-evaluation.ts');

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function memory(quality, subject = null) {
  return {
    sourceType: 'photo', sourceId: 'file:///camera/city.jpg', qualities: quality ? [quality] : [],
    createdAt: '2026-07-14T12:00:00',
    photoAnalysis: subject ? { representation: { kind: 'real_world' }, subjects: [subject] } : undefined,
  };
}

const skylo = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.93, centrality: 'primary', status: 'inferred' }), 'quest-photo-city');
check('Skylo accepts a clear primary city photo', skylo.status === 'ready', JSON.stringify(skylo));
check('direct result retains exact source evidence id', skylo.evidenceId === 'photo:file:///camera/city.jpg', skylo.evidenceId);
check('direct result explains a strong primary match', skylo.reasonCode === 'strong_primary', JSON.stringify(skylo));

const supporting = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.8, centrality: 'supporting', status: 'inferred' }), 'quest-photo-city');
check('Skylo accepts clearly visible supporting city evidence', supporting.status === 'ready', JSON.stringify(supporting));

const mealRegion = { x: 0.5, y: 0.2, width: 0.38, height: 0.42, confidence: 0.84 };
const supportingMeal = evaluatePhotoForQuest(
  memory(
    { qualityId: 'subject.food', score: 0.82, centrality: 'supporting', status: 'inferred' },
    { id: 'subject:sushi', canonicalValue: 'sushi', domain: 'food', role: 'supporting', score: 0.82, region: mealRegion }
  ),
  'quest-photo-food'
);
check('a clearly visible supporting meal satisfies the meal quest', supportingMeal.status === 'ready', JSON.stringify(supportingMeal));
check('meal quest feedback identifies the matched spatial region', supportingMeal.matchedSubjectId === 'subject:sushi' && supportingMeal.matchedRegion === mealRegion, JSON.stringify(supportingMeal));

const incidental = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.93, centrality: 'incidental', status: 'inferred' }), 'quest-photo-city');
check('Skylo rejects incidental city evidence', incidental.status === 'no_match', JSON.stringify(incidental));
check('incidental evidence returns an explainable reason', incidental.reasonCode === 'incidental', JSON.stringify(incidental));

const rejected = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 1, centrality: 'primary', status: 'rejected' }), 'quest-photo-city');
check('a user-rejected quality cannot pass', rejected.status === 'no_match', JSON.stringify(rejected));

const smallHours = evaluatePhotoForQuest({ ...memory(null), createdAt: '2026-07-14T23:30:00' }, 'quest-late-capture');
check('direct quest camera accepts a photo captured after 11pm', smallHours.status === 'ready', JSON.stringify(smallHours));
check('direct time result explains its deterministic match', smallHours.reasonCode === 'time_window_match', JSON.stringify(smallHours));
const fiveAm = evaluatePhotoForQuest({ ...memory(null), createdAt: '2026-07-14T05:00:00' }, 'quest-late-capture');
check('direct quest camera excludes 5am from the small-hours window', fiveAm.status === 'no_match', JSON.stringify(fiveAm));

if (failures) process.exit(1);
console.log('\nAll direct photo-quest checks passed.');
