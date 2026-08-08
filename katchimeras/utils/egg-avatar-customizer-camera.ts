import { homeTabBarHeight } from '@/constants/home-loop-layout';

const CUSTOMIZER_CAMERA_SCALE = 1.18;

type EggAvatarCustomizerCameraInput = {
  bottomInset: number;
  subjectCenterY: number;
  topInset: number;
  viewportHeight: number;
};

export function eggAvatarCustomizerCamera({
  bottomInset,
  subjectCenterY,
  topInset,
  viewportHeight,
}: EggAvatarCustomizerCameraInput) {
  const panelHeight = Math.min(430, Math.max(320, viewportHeight * 0.46));
  const panelTop = viewportHeight - homeTabBarHeight(bottomInset) - panelHeight;
  const targetCenterY = topInset + (panelTop - topInset) / 2;

  // React Native scales around the viewport centre. Account for that movement
  // first, then translate the camera so the real egg lands in the exact centre
  // of the unobstructed region above the selector panel.
  const scaledSubjectCenterY = viewportHeight / 2
    + (subjectCenterY - viewportHeight / 2) * CUSTOMIZER_CAMERA_SCALE;

  return {
    panelTop,
    scale: CUSTOMIZER_CAMERA_SCALE,
    targetCenterY,
    translateY: targetCenterY - scaledSubjectCenterY,
  };
}
