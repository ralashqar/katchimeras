import type { PhotoVisionResult } from '@/types/home';

export type PhotoRealityKind = 'real_world' | 'screen_content' | 'unknown';

export type PhotoRealityAssessment = {
  kind: PhotoRealityKind;
  confidence: number;
  reasons: string[];
};

const SCREEN_CONTENT_PATTERN =
  /screen[_ ]content|screen ?shot|screen capture|video game|computer game|gameplay|computer graphics?|cgi|cartoon|anime|animation|illustration|digital art|graphic design|clip ?art|emoji|app icon|user interface|mobile app|web ?page|fictional character/i;

const SCREEN_DEVICE_PATTERN = /\bscreen\b|monitor|display|television|\btv\b|smartphone|mobile phone|computer/i;

const FOOD_PATTERN =
  /\bfood\b|\bmeal\b|\bdish\b|coffee|espresso|latte|tea|cake|dessert|pastry|ice ?cream|donut|cookie|pizza|sushi|ramen|noodles?|burger|fries|hot ?dog|taco|curry|salad|soup|sandwich|steak|seafood|rice|drink|beverage|breakfast|brunch|pancakes?|toast|\beggs?\b|fruit|apple|banana|bread|cheese/i;

const DEPICTED_WORLD_PATTERN =
  /\bdog\b|puppy|canine|retriever|terrier|poodle|labrador|\bcat\b|kitten|feline|\bbaby\b|infant|newborn|stroller|\bchild\b|\bchildren\b|\bkids?\b|toddler|young person|\bperson\b|\bpeople\b|crowd|family|friends|park|forest|garden|beach|mountain|waterfall|landscape|city|skyline|sunset|sunrise|snow|rain|storm|basketball|tennis|gym|workout|concert|festival|celebration|birthday|wedding|restaurant|cafe|building|street|airport/i;

export function assessPhotoReality(result: PhotoVisionResult): PhotoRealityAssessment {
  if (result.isScreenshot) {
    return { kind: 'screen_content', confidence: 1, reasons: ['Photos metadata marks this as a screenshot'] };
  }

  const labels = (result.labels ?? []).filter((label) => label.confidence >= 0.12);
  const labelText = labels.map((label) => label.name).join(' ');
  const strongScreenLabel = labels.find(
    (label) => label.confidence >= 0.18 && SCREEN_CONTENT_PATTERN.test(label.name)
  );
  if (strongScreenLabel) {
    return {
      kind: 'screen_content',
      confidence: Math.max(0.82, Math.min(1, strongScreenLabel.confidence)),
      reasons: [`Vision identified ${strongScreenLabel.name}`],
    };
  }

  // A photographed TV/monitor is still screen content for semantic filing: an
  // illustrated egg on it must not become a meal. Require either OCR or another
  // digital-content cue so an incidental monitor in a room does not dominate.
  if (
    SCREEN_DEVICE_PATTERN.test(labelText) &&
    ((result.text?.length ?? 0) >= 2 || /video game|gameplay|interface|software/i.test(labelText))
  ) {
    return { kind: 'screen_content', confidence: 0.78, reasons: ['Screen/device evidence is corroborated by visible content'] };
  }

  if (result.captureSource === 'camera') {
    return { kind: 'real_world', confidence: 0.88, reasons: ['Captured with the in-app camera'] };
  }
  if (result.hasLocation) {
    return { kind: 'real_world', confidence: 0.82, reasons: ['Photo carries a geographic capture location'] };
  }
  return { kind: 'unknown', confidence: 0.45, reasons: ['No decisive physical-world or screen-content metadata'] };
}

// Representation is evaluated before subject classification. For screen-based
// content, retain game/media/screen observations but remove depicted physical
// subjects that would otherwise create food, pet, child, or social memories.
export function guardPhotoVisionResult(result: PhotoVisionResult): PhotoVisionResult {
  const assessment = assessPhotoReality(result);
  if (assessment.kind === 'real_world') return { ...result, reality: assessment };

  // An unlocated camera-roll image with only one ambiguous object cue (notably
  // "egg") is not enough to auto-file a physical food memory. Strong dishes or
  // corroborating food/meal context still work; otherwise the user can add the
  // food manually without the app asserting it.
  if (assessment.kind === 'unknown' && hasCrediblePhysicalFoodEvidence(result)) {
    return { ...result, reality: assessment };
  }

  if (assessment.kind === 'unknown') {
    return {
      ...result,
      labels: (result.labels ?? []).filter((label) => !FOOD_PATTERN.test(label.name)),
      regionClassifications: result.regionClassifications?.map((item) => ({
        ...item,
        labels: item.labels.filter((label) => !FOOD_PATTERN.test(label.name)),
      })).filter((item) => item.labels.length > 0),
      text: (result.text ?? []).filter((token) => !FOOD_PATTERN.test(token)),
      reality: assessment,
    };
  }

  const labels = (result.labels ?? []).filter((label) => !isDepictedWorldTerm(label.name));
  const hasScreenMarker = labels.some((label) => /screen[_ ]content/i.test(label.name));
  return {
    ...result,
    labels: hasScreenMarker
      ? labels
      : [{ name: 'screen_content', confidence: assessment.confidence }, ...labels],
    text: (result.text ?? []).filter((token) => !isDepictedWorldTerm(token)),
    faceCount: 0,
    humanCount: 0,
    humans: [],
    faces: [],
    animals: [],
    regionClassifications: result.regionClassifications?.map((item) => ({
      ...item,
      labels: item.labels.filter((label) => !isDepictedWorldTerm(label.name)),
    })).filter((item) => item.labels.length > 0),
    reality: assessment,
  };
}

function isDepictedWorldTerm(value: string): boolean {
  return FOOD_PATTERN.test(value) || DEPICTED_WORLD_PATTERN.test(value);
}

function hasCrediblePhysicalFoodEvidence(result: PhotoVisionResult): boolean {
  const foodLabels = (result.labels ?? []).filter(
    (label) => label.confidence >= 0.22 && FOOD_PATTERN.test(label.name)
  );
  if (foodLabels.length >= 2) return true;
  return foodLabels.some(
    (label) =>
      label.confidence >= 0.5 &&
      /pizza|sushi|ramen|noodles?|burger|sandwich|taco|curry|salad|soup|steak|seafood|pasta|dessert|cake|pastry|ice ?cream|coffee|latte|meal|dish|plate|tableware/i.test(label.name)
  );
}

export function summaryIsScreenContent(details: readonly string[] | undefined): boolean {
  return (details ?? []).some((detail) => /screen[_ ]content|screenshot|gameplay|computer graphics?|cartoon|illustration|user interface/i.test(detail));
}
