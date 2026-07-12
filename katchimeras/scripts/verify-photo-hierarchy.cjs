require('tsx/cjs');

const { buildPhotoHierarchy } = require('../utils/intelligence/photo-hierarchy.ts');

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function subject(canonicalValue, domain, score = 0.85) {
  return { id: `subject:${canonicalValue}`, label: canonicalValue, canonicalValue, domain, role: 'primary', score, providers: ['appleVision'] };
}

const book = buildPhotoHierarchy({
  rawVision: { labels: [{ name: 'book cover', confidence: 0.9 }], text: ['THE TEST BOOK'], faceCount: 0, documentDetected: true, captureSource: 'camera' },
  scene: { type: 'media', label: 'An inspiration', media: { mediaType: 'book', title: 'The Test Book', creator: null }, source: 'rules' },
  observations: [{ key: 'signal', value: 'book', confidence: 0.9, provider: 'appleVision', raw: 'book cover' }],
  facets: [{ key: 'media_type', value: 'book', confidence: 0.9, confirmed: false, sensitive: false }],
  subjects: [subject('book', 'media')],
});
check('book cover is a book container', book.container.kind === 'book', book.container.kind);
check('book cover does not become depicted nature or people', book.hypotheses[0]?.path.includes('media'));

const screenArt = buildPhotoHierarchy({
  rawVision: { labels: [{ name: 'computer screen illustration', confidence: 0.88 }], text: [], faceCount: 0, captureSource: 'camera' },
  scene: { type: 'media', label: 'An inspiration', media: { mediaType: 'art', title: null, creator: null }, representation: 'screen_content', source: 'llm' },
  observations: [{ key: 'signal', value: 'art', confidence: 0.82, provider: 'appleFoundation', raw: 'digital illustration' }],
  facets: [{ key: 'media_type', value: 'art', confidence: 0.82, confirmed: false, sensitive: false }],
  subjects: [subject('art', 'media')],
});
check('photographed digital art retains screen container', screenArt.container.kind === 'screen', screenArt.container.kind);
check('art authorship remains unresolved', screenArt.unresolvedFacets.some((item) => item.key === 'authorship'));

const uncertain = buildPhotoHierarchy({ observations: [], facets: [], subjects: [subject('object', 'other', 0.55)] });
check('uncertain image asks representation first', uncertain.unresolvedFacets[0]?.key === 'representation', uncertain.unresolvedFacets[0]?.key);

if (failures) process.exit(1);
console.log('\nAll photo-hierarchy checks passed.');
