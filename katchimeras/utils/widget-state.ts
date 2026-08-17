import { Platform } from 'react-native';

import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveHatchHour } from '@/game/days';
import { WISPS_BY_ID } from '@/constants/wisps';

const APP_GROUP = 'group.com.daruk.katchimeras';

// Mirrors today's state into the App Group so the home-screen widget can
// render it. The native module only exists in builds that include the widget
// target, so everything is best-effort behind a dynamic import.
export async function syncWidgetState(state: StoredHomeState, profile: OnboardingProfile) {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const { ExtensionStorage } = await import('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    const today = state.today;
    const creature = today.creature;
    const wisp = today.dailyHatch ? WISPS_BY_ID.get(today.dailyHatch.primaryWispId) : null;
    const hatchHour = resolveHatchHour(profile);
    const hourLabel = hatchHour > 12 ? `${hatchHour - 12} PM` : `${hatchHour} AM`;

    if (wisp) {
      storage.set('kw_status', 'hatched');
      storage.set('kw_title', wisp.name);
      storage.set('kw_subtitle', today.card?.dayLine ?? 'Today left a little Wisp behind');
      storage.set('kw_image', `wisp:${wisp.id}`);
    } else if (creature) {
      storage.set('kw_status', 'hatched');
      storage.set('kw_title', creature.name);
      storage.set('kw_subtitle', creature.motifTags[0] ?? 'Today became someone');
      storage.set('kw_image', creature.visualKey);
    } else if (today.state === 'ready_to_hatch') {
      storage.set('kw_status', 'ready');
      storage.set('kw_title', 'Ready to hatch');
      storage.set('kw_subtitle', 'Tonight is waiting for you');
      storage.set('kw_image', 'egg');
    } else {
      storage.set('kw_status', 'forming');
      storage.set('kw_title', 'Gathering shape');
      storage.set('kw_subtitle', `Hatches at ${hourLabel}`);
      storage.set('kw_image', 'egg');
    }

    ExtensionStorage.reloadWidget();
  } catch {
    // Older build without the widget target, or web/dev environment.
  }
}
