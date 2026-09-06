const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
let failures = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

function readPng(relativePath) {
  const absolutePath = contentPath(projectRoot, relativePath);
  const bytes = readVerificationSource(absolutePath);
  const signature = bytes.subarray(0, 8).toString('hex');
  check(`${path.basename(relativePath)} has a PNG signature`, signature === '89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

const frame = readPng('assets/images/katchimeras/cards/daily-card-back-frame.png');
const watermark = readPng('assets/images/katchimeras/cards/daily-card-back-watermark.png');
const layoutSource = readVerificationSource(contentPath(projectRoot, 'utils/daily-card-layout.ts'), 'utf8');
const viewerSource = readVerificationSource(contentPath(projectRoot, 'components/katchadeck/cards/daily-card-viewer.tsx'), 'utf8');
const frameSource = readVerificationSource(contentPath(projectRoot, 'components/katchadeck/cards/daily-card-back-frame.tsx'), 'utf8');

check('back frame matches the 941x1672 front-card canvas', frame.width === 941 && frame.height === 1672, `${frame.width}x${frame.height}`);
check('back frame carries an alpha channel', frame.colorType === 6, `PNG color type ${frame.colorType}`);
check('K watermark is normalized to 720x720', watermark.width === 720 && watermark.height === 720, `${watermark.width}x${watermark.height}`);
check('K watermark carries an alpha channel', watermark.colorType === 6, `PNG color type ${watermark.colorType}`);
check('back layout declares a viewport over 1000 design pixels tall', /moments:\s*\{[^}]*height:\s*1005/.test(layoutSource));
check('card back renders through its dedicated frame component', viewerSource.includes('<DailyCardBackFrame') && !viewerSource.includes('<OrnateCardFrame'));
check('dedicated frame loads both generated assets', frameSource.includes('daily-card-back-frame.png') && frameSource.includes('daily-card-back-watermark.png'));
check('Moments viewport remains a nested vertical scroller', viewerSource.includes('nestedScrollEnabled') && viewerSource.includes('directionalLockEnabled'));
check('card-wide flip pan yields the back face to Moments scrolling', viewerSource.includes(".enabled(!reduceMotion && face === 'front')"));
check('flip pan begins only after horizontal activation', viewerSource.includes('.onStart(() => {'));

console.log(failures === 0 ? '\nAll daily-card back asset checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
