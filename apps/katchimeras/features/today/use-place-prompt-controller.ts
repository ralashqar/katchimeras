import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

import {
  PLACE_CATEGORIES,
  type PlaceCategory,
  type PlaceMeaning,
} from '@/components/katchadeck/world/place-prompt-sheet';
import type { DayInputTarget, DayMapNode, HomeDayRecord } from '@/types/home';
import { isPointAtHome, loadHomeAnchor, saveHomeAnchor } from '@/utils/home-location';
import { resolvePlaceName } from '@/utils/place-names';

type ConfirmPlaceInput = {
  id: string;
  category: string;
  archetype: string;
  label: string;
  meaningLabel?: string;
};

type ManualPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type ActivePlace = ManualPlace & {
  timeLabel: string | null;
  isNew: boolean;
};

type UsePlacePromptControllerParams = {
  formingDay: HomeDayRecord | null;
  formingTarget: DayInputTarget;
  unconfirmedPlace: DayMapNode | null;
  confirmPlace: (input: ConfirmPlaceInput, target?: DayInputTarget) => void;
  setPlacePromptOpen: (open: boolean) => void;
  setPlacesVaultOpen: (open: boolean) => void;
  pulseEgg: () => void;
  setMicrocopy: (message: string | null) => void;
  formatTimeRange: (start?: string, end?: string) => string | null;
};

export function usePlacePromptController({
  formingDay,
  formingTarget,
  unconfirmedPlace,
  confirmPlace,
  setPlacePromptOpen,
  setPlacesVaultOpen,
  pulseEgg,
  setMicrocopy,
  formatTimeRange,
}: UsePlacePromptControllerParams) {
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [manualPlace, setManualPlace] = useState<ManualPlace | null>(null);
  const [placeTarget, setPlaceTarget] = useState<ActivePlace | null>(null);

  useEffect(() => {
    if (!unconfirmedPlace) {
      setPlaceName(null);
      return;
    }

    let active = true;
    setPlaceName(null);
    void (async () => {
      const resolved = await resolvePlaceName(unconfirmedPlace.latitude, unconfirmedPlace.longitude);
      if (active) setPlaceName(resolved.locality ? `${resolved.primary} - ${resolved.locality}` : resolved.primary);
    })();

    return () => {
      active = false;
    };
  }, [unconfirmedPlace]);

  const activePlace = useMemo(() => {
    if (manualPlace) {
      return {
        id: manualPlace.id,
        name: manualPlace.name,
        timeLabel: 'Just now',
        isNew: true,
        latitude: manualPlace.latitude,
        longitude: manualPlace.longitude,
      };
    }
    if (placeTarget) return placeTarget;
    if (unconfirmedPlace) {
      return {
        id: unconfirmedPlace.id,
        name: placeName ?? 'A place you visited',
        timeLabel: null,
        isNew: (formingDay?.newPlaceCount ?? 0) > 0,
        latitude: unconfirmedPlace.latitude,
        longitude: unconfirmedPlace.longitude,
      };
    }
    return null;
  }, [formingDay?.newPlaceCount, manualPlace, placeName, placeTarget, unconfirmedPlace]);

  const placePreset = useMemo(() => {
    if (!activePlace) return undefined;
    const atHome = isPointAtHome(activePlace.latitude, activePlace.longitude, loadHomeAnchor());
    return atHome ? PLACE_CATEGORIES.find((category) => category.id === 'home') : undefined;
  }, [activePlace]);

  const handleAddCurrentPlace = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setMicrocopy('Location access is needed to add a place');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const resolved = await resolvePlaceName(latitude, longitude);
      const name = resolved.locality ? `${resolved.primary} - ${resolved.locality}` : resolved.primary;
      setManualPlace({
        id: `manual-${Math.round(position.timestamp ?? 0)}-${Math.round(latitude * 1000)}`,
        name,
        latitude,
        longitude,
      });
      setPlacePromptOpen(true);
    } catch {
      setMicrocopy("Couldn't read your location");
    }
  }, [setMicrocopy, setPlacePromptOpen]);

  const closePlacePrompt = useCallback(() => {
    setPlacePromptOpen(false);
    setManualPlace(null);
    setPlaceTarget(null);
  }, [setPlacePromptOpen]);

  const handleConfirmPlaceFromVault = useCallback(
    (node: DayMapNode, name: string) => {
      setPlacesVaultOpen(false);
      setManualPlace(null);
      setPlaceTarget({
        id: node.id,
        name,
        timeLabel: formatTimeRange(node.startedAt, node.endedAt),
        isNew: false,
        latitude: node.latitude,
        longitude: node.longitude,
      });
      setPlacePromptOpen(true);
    },
    [formatTimeRange, setPlacePromptOpen, setPlacesVaultOpen]
  );

  const handleConfirmPlace = useCallback(
    (category: PlaceCategory, meaning: PlaceMeaning) => {
      if (activePlace) {
        confirmPlace(
          {
            id: activePlace.id,
            category: category.id,
            archetype: meaning.id,
            label: category.label,
            meaningLabel: meaning.label,
          },
          formingTarget
        );
        if (category.id === 'home') {
          saveHomeAnchor({
            lat: activePlace.latitude,
            lng: activePlace.longitude,
            source: 'manual',
            setAt: new Date().toISOString(),
          });
        }
        pulseEgg();
        setMicrocopy(`${category.emoji} ${category.label} - ${meaning.label}`);
      }
      closePlacePrompt();
    },
    [activePlace, closePlacePrompt, confirmPlace, formingTarget, pulseEgg, setMicrocopy]
  );

  return {
    activePlace,
    placePreset,
    handleAddCurrentPlace,
    closePlacePrompt,
    handleConfirmPlaceFromVault,
    handleConfirmPlace,
  };
}
