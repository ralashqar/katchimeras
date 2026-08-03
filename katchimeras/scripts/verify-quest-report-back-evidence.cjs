const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-report-back-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const originalResolveFilename = require('module')._resolveFilename;
const studioDetectPath = transpile('utils/studio-detect.ts', 'studio-detect.js');
const memoryDisplayPath = transpile('utils/memory-display.ts', 'memory-display.js');
const qualityRegistryPath = transpile('utils/intelligence/quality-registry.ts', 'quality-registry.js');
const journalTemplatesPath = transpile('utils/quests/journal-templates.ts', 'journal-templates.js');
const manualJournalRegistryPath = transpile('utils/manual-journal-registry.ts', 'manual-journal-registry.js');
const bespokeQuestCataloguePath = transpile(
  'constants/katchimera-bespoke-quests.ts',
  'katchimera-bespoke-quests.js'
);
const bespokeQuestDefinitionsPath = transpile(
  'utils/quests/bespoke-family-packs.ts',
  'bespoke-family-packs.js'
);
const batchOneQuestVariantsPath = transpile(
  'constants/batch-one-quest-variants.ts',
  'batch-one-quest-variants.js'
);
const batchTwoQuestVariantsPath = transpile(
  'constants/batch-two-quest-variants.ts',
  'batch-two-quest-variants.js'
);
const batchThreeQuestVariantsPath = transpile(
  'constants/batch-three-quest-variants.ts',
  'batch-three-quest-variants.js'
);
const batchFourQuestVariantsPath = transpile(
  'constants/batch-four-quest-variants.ts',
  'batch-four-quest-variants.js'
);
const batchFiveQuestVariantsPath = transpile(
  'constants/batch-five-quest-variants.ts',
  'batch-five-quest-variants.js'
);
const batchSixQuestVariantsPath = transpile(
  'constants/batch-six-quest-variants.ts',
  'batch-six-quest-variants.js'
);
const qualityDataPath = path.join(projectRoot, 'data/intelligence/memory-qualities.json');
require('module')._resolveFilename = function resolveVerificationModule(request, parent, isMain, options) {
  if (request === '@/utils/studio-detect') return studioDetectPath;
  if (request === '@/utils/memory-display') return memoryDisplayPath;
  if (request === '@/utils/intelligence/quality-registry') return qualityRegistryPath;
  if (request === '@/utils/quests/journal-templates') return journalTemplatesPath;
  if (request === '@/utils/manual-journal-registry') return manualJournalRegistryPath;
  if (request === '@/constants/katchimera-bespoke-quests') return bespokeQuestCataloguePath;
  if (request === '@/utils/quests/bespoke-family-packs') return bespokeQuestDefinitionsPath;
  if (request === '@/constants/batch-one-quest-variants') return batchOneQuestVariantsPath;
  if (request === '@/constants/batch-two-quest-variants') return batchTwoQuestVariantsPath;
  if (request === '@/constants/batch-three-quest-variants') return batchThreeQuestVariantsPath;
  if (request === '@/constants/batch-four-quest-variants') return batchFourQuestVariantsPath;
  if (request === '@/constants/batch-five-quest-variants') return batchFiveQuestVariantsPath;
  if (request === '@/constants/batch-six-quest-variants') return batchSixQuestVariantsPath;
  if (request === '@/data/intelligence/memory-qualities.json') return qualityDataPath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

transpile('utils/quests/definitions.ts', 'definitions.js');
const reportBackPath = transpile('utils/quests/report-back-evidence.ts', 'report-back-evidence.js');

const { buildQuestReportBackItems, buildQuestSubmissionItems } = require(reportBackPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const baseDay = {
  id: 'day-2026-07-07',
  isoDate: '2026-07-07',
  moments: [],
};

const photoItems = buildQuestReportBackItems(
  {
    ...baseDay,
    evidence: [
      {
        id: 'photo:park-1',
        sourceType: 'photo',
        sourceId: 'park-1',
        observedAt: '2026-07-07T12:00:00.000Z',
        provider: 'appleVision',
        confidence: 0.9,
        thumbnailUri: 'file://park.jpg',
        explanation: 'Detected park from photo.',
        signals: [],
      },
    ],
    capturedMeanings: [
      {
        sourceId: 'park-1',
        label: 'Green corner',
        archetype: 'calm',
        thumbnailUri: 'file://park.jpg',
        createdAt: '2026-07-07T12:00:00.000Z',
      },
    ],
  },
  { complete: true, questId: 'quest-new-park', matchedEvidenceIds: ['photo:park-1'] }
);
check('photo evidence previews the captured label', photoItems[0]?.title === 'Green corner', photoItems[0]?.title);
check('photo evidence carries a thumbnail', photoItems[0]?.thumbnailUri === 'file://park.jpg', photoItems[0]?.thumbnailUri);
check('photo evidence uses photo kind', photoItems[0]?.kind === 'photo', photoItems[0]?.kind);

const voiceItems = buildQuestReportBackItems(
  {
    ...baseDay,
    evidence: [
      {
        id: 'note:voice-1',
        sourceType: 'voice_note',
        sourceId: 'voice-1',
        observedAt: '2026-07-07T20:00:00.000Z',
        provider: 'deterministic',
        confidence: 0.85,
        explanation: 'Matched movie note.',
        signals: [],
      },
    ],
    notes: [
      {
        id: 'voice-1',
        kind: 'voice',
        text: 'I watched a movie tonight and loved the soundtrack.',
        audioUri: 'file://voice.m4a',
        durationMs: 42000,
        label: 'Movie voice note',
        archetype: 'wonder',
        createdAt: '2026-07-07T20:00:00.000Z',
      },
    ],
  },
  { complete: true, questId: 'quest-watch-film', matchedEvidenceIds: ['note:voice-1'] }
);
check('voice evidence previews voice note title', voiceItems[0]?.title === 'Movie voice note', voiceItems[0]?.title);
check('voice evidence includes transcript context', voiceItems[0]?.body?.includes('watched a movie'), voiceItems[0]?.body);
check('voice evidence uses voice kind', voiceItems[0]?.kind === 'voice', voiceItems[0]?.kind);

const studioItems = buildQuestReportBackItems(
  {
    ...baseDay,
    studioMoments: [
      {
        id: 'studio-1',
        mediaType: 'film',
        label: 'Late film log',
        detail: 'Watched a quiet cinema drama.',
        rating: 'liked',
        source: 'note',
        noteId: 'note-1',
      },
    ],
  },
  { complete: true, questId: 'quest-watch-film', matchedEvidenceIds: [] }
);
check('fact-only studio completion falls back to studio moment', studioItems[0]?.title === 'Late film log', studioItems[0]?.title);
check('studio fallback keeps detail context', studioItems[0]?.body === 'Watched a quiet cinema drama.', studioItems[0]?.body);
check('studio fallback uses studio kind', studioItems[0]?.kind === 'studio', studioItems[0]?.kind);

const cheerletItems = buildQuestReportBackItems(
  {
    ...baseDay,
    notes: [
      {
        id: 'plain-note',
        kind: 'text',
        text: 'A quiet ordinary note.',
        audioUri: null,
        durationMs: null,
        label: 'Plain note',
        archetype: 'calm',
        createdAt: '2026-07-07T19:00:00.000Z',
      },
      {
        id: 'celebration-voice',
        kind: 'voice',
        text: 'I finally finished the project and it felt worth celebrating.',
        audioUri: 'file://celebration.m4a',
        durationMs: 21000,
        label: 'Finished the project',
        archetype: 'meaningful',
        createdAt: '2026-07-07T20:30:00.000Z',
      },
    ],
    bigMoments: [
      {
        id: 'bm-1',
        type: 'achievement',
        label: 'Finished the project',
        subject: null,
        noteId: 'celebration-voice',
        createdAt: '2026-07-07T20:30:00.000Z',
      },
    ],
  },
  { complete: true, questId: 'quest-celebrate-note', matchedEvidenceIds: [] }
);
check('celebration quest report-back prefers the Big Moment voice note', cheerletItems[0]?.id === 'celebration-voice', cheerletItems[0]?.id);
check('celebration quest report-back shows voice context', cheerletItems[0]?.kind === 'voice' && cheerletItems[0]?.body?.includes('worth celebrating'), JSON.stringify(cheerletItems[0]));
check('celebration quest report-back labels Big Moment voice note', cheerletItems[0]?.subtitle.includes('Big Moment'), cheerletItems[0]?.subtitle);

const incompleteItems = buildQuestReportBackItems(baseDay, {
  complete: false,
  questId: 'quest-watch-film',
  matchedEvidenceIds: [],
});
check('incomplete quests do not preview report-back items', incompleteItems.length === 0, String(incompleteItems.length));

const projectedPossibleItems = buildQuestSubmissionItems(
  {
    ...baseDay,
    classifiedMemories: [{
      id: 'memory-city-photo',
      sourceType: 'photo',
      sourceId: 'city-photo',
      dominantDomain: 'place',
      observations: [],
      facets: [],
      qualities: [{
        qualityId: 'place.city',
        score: 0.64,
        centrality: 'supporting',
        status: 'inferred',
        sources: [{ provider: 'appleVision', confidence: 0.7, weight: 0.9 }],
        reasons: ['Vision city signal'],
      }],
      confirmations: [],
      entityIds: [],
      assignments: [],
      promptState: { status: 'pending', answeredNodeIds: [], graphVersion: 1 },
      createdAt: '2026-07-07T09:00:00.000Z',
      schemaVersion: 2,
    }],
    capturedMeanings: [{
      sourceId: 'city-photo',
      label: 'City view',
      archetype: 'energy',
      thumbnailUri: 'file://city.jpg',
      createdAt: '2026-07-07T09:00:00.000Z',
    }],
  },
  {
    complete: false,
    readyToSubmit: false,
    questId: 'quest-photo-city',
    matchedEvidenceIds: [],
    possibleEvidenceIds: ['photo:city-photo'],
  },
  {
    questId: 'quest-photo-city',
    creatureId: 'creature-skylo',
    title: 'City sighting',
    hint: 'Snap the city.',
    acceptedAt: Date.parse('2026-07-07T10:00:00.000Z'),
    acceptedDayId: '2026-07-07',
  },
  []
);
check('projected possible quality resolves back to an actionable photo', projectedPossibleItems[0]?.sourceId === 'city-photo', JSON.stringify(projectedPossibleItems));
check('projected possible photo retains its thumbnail', projectedPossibleItems[0]?.thumbnailUri === 'file://city.jpg', JSON.stringify(projectedPossibleItems));

const submissionQuest = {
  questId: 'quest-photo-dog',
  creatureId: 'creature-dog',
  title: 'Good dog',
  hint: 'Snap a dog.',
  acceptedAt: Date.parse('2026-07-07T10:00:00.000Z'),
  acceptedDayId: '2026-07-07',
};
const submissionRuntime = {
  complete: false,
  readyToSubmit: true,
  questId: 'quest-photo-dog',
  matchedEvidenceIds: ['photo:old-dog', 'photo:new-dog'],
};
const submissionDay = {
  ...baseDay,
  evidence: [
    {
      id: 'photo:old-dog',
      sourceType: 'photo',
      sourceId: 'old-dog',
      observedAt: '2026-07-07T09:00:00.000Z',
      provider: 'appleVision',
      confidence: 0.9,
      thumbnailUri: 'file://old-dog.jpg',
      explanation: 'Detected dog.',
      signals: [],
    },
    {
      id: 'photo:new-dog',
      sourceType: 'photo',
      sourceId: 'new-dog',
      observedAt: '2026-07-07T11:00:00.000Z',
      provider: 'appleVision',
      confidence: 0.9,
      thumbnailUri: 'file://new-dog.jpg',
      explanation: 'Detected dog.',
      signals: [],
    },
  ],
};
const eligibleSubmissionItems = buildQuestSubmissionItems(submissionDay, submissionRuntime, submissionQuest, []);
check('same-day candidates can be reused even when captured before quest acceptance', eligibleSubmissionItems.length === 2, JSON.stringify(eligibleSubmissionItems));
check('submission candidates include the new eligible evidence', eligibleSubmissionItems.some((item) => item.sourceId === 'new-dog'), JSON.stringify(eligibleSubmissionItems));
const carriedQuestItems = buildQuestSubmissionItems(
  { ...submissionDay, id: 'day-2026-07-08', isoDate: '2026-07-08' },
  submissionRuntime,
  submissionQuest,
  []
);
check('active quest accepted on an earlier day can submit today photo', carriedQuestItems.length === 2, JSON.stringify(carriedQuestItems));
const reusedSubmissionItems = buildQuestSubmissionItems(submissionDay, submissionRuntime, submissionQuest, [
  {
    id: 'submitted-new-dog',
    questId: 'quest-photo-dog',
    creatureId: 'creature-dog',
    dayId: '2026-07-07',
    sourceType: 'photo',
    sourceId: 'new-dog',
    evidenceId: 'photo:new-dog',
    submittedAt: Date.parse('2026-07-07T11:05:00.000Z'),
  },
]);
check('submission candidates exclude already submitted entries', reusedSubmissionItems.length === 1 && reusedSubmissionItems[0]?.sourceId === 'old-dog', JSON.stringify(reusedSubmissionItems));

const foodSubmissionQuest = {
  questId: 'quest-photo-food',
  creatureId: 'creature-food',
  title: 'Feast for the eyes',
  hint: 'Snap a photo of food.',
  acceptedAt: Date.parse('2026-07-07T10:00:00.000Z'),
  acceptedDayId: '2026-07-07',
};
const foodSubmissionItems = buildQuestSubmissionItems(
  {
    ...baseDay,
    evidence: [
      {
        id: 'photo:banana',
        sourceType: 'photo',
        sourceId: 'banana',
        observedAt: '2026-07-07T12:00:00.000Z',
        provider: 'appleVision',
        confidence: 0.9,
        thumbnailUri: 'file://banana.jpg',
        explanation: 'Detected food from photo.',
        signals: [{ key: 'food', confidence: 0.9, provider: 'appleVision', source: 'vision' }],
      },
    ],
    capturedMeanings: [
      {
        sourceId: 'banana',
        label: 'Banana',
        archetype: 'calm',
        thumbnailUri: 'file://banana.jpg',
        createdAt: '2026-07-07T12:00:00.000Z',
      },
    ],
  },
  {
    complete: false,
    readyToSubmit: true,
    questId: 'quest-photo-food',
    matchedEvidenceIds: ['photo:banana'],
  },
  foodSubmissionQuest,
  []
);
check('food photo submission previews the live captured photo', foodSubmissionItems[0]?.thumbnailUri === 'file://banana.jpg', JSON.stringify(foodSubmissionItems[0]));
check('food photo submission uses the captured label', foodSubmissionItems[0]?.title === 'Banana', foodSubmissionItems[0]?.title);

console.log(failures === 0 ? '\nAll quest report-back evidence checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
