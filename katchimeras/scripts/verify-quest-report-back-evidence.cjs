const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-report-back-'));

function transpile(relativeSourcePath, outName) {
  const source = fs.readFileSync(path.join(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

transpile('utils/quests/definitions.ts', 'definitions.js');
const reportBackPath = transpile('utils/quests/report-back-evidence.ts', 'report-back-evidence.js');

const { buildQuestReportBackItems } = require(reportBackPath);

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

console.log(failures === 0 ? '\nAll quest report-back evidence checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
