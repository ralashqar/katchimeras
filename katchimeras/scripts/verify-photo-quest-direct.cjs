require('tsx/cjs');

const { evaluatePhotoForQuest } = require('../utils/quests/photo-evaluation.ts');

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function memory(quality) {
  return {
    sourceType: 'photo', sourceId: 'file:///camera/city.jpg', qualities: quality ? [quality] : [],
  };
}

const skylo = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.93, centrality: 'primary', status: 'inferred' }), 'quest-photo-city');
check('Skylo accepts a clear primary city photo', skylo.status === 'ready', JSON.stringify(skylo));
check('direct result retains exact source evidence id', skylo.evidenceId === 'photo:file:///camera/city.jpg', skylo.evidenceId);

const supporting = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.8, centrality: 'supporting', status: 'inferred' }), 'quest-photo-city');
check('Skylo accepts clearly visible supporting city evidence', supporting.status === 'ready', JSON.stringify(supporting));

const incidental = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 0.93, centrality: 'incidental', status: 'inferred' }), 'quest-photo-city');
check('Skylo rejects incidental city evidence', incidental.status === 'no_match', JSON.stringify(incidental));

const rejected = evaluatePhotoForQuest(memory({ qualityId: 'place.city', score: 1, centrality: 'primary', status: 'rejected' }), 'quest-photo-city');
check('a user-rejected quality cannot pass', rejected.status === 'no_match', JSON.stringify(rejected));

if (failures) process.exit(1);
console.log('\nAll direct photo-quest checks passed.');
