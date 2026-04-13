import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { homeMomentOptions, homeRadialActionOrder } from '@/constants/home-mvp';
import type {
  AbsorptionPayload,
  AddMomentFlowError,
  AddMomentFlowState,
  AddMomentInput,
  HomeDayRecord,
  HomeQuickMomentType,
  HomeTimelineDay,
  InspirationCategory,
  RecentPhotoAsset,
  RadialMomentAction,
} from '@/types/home';
import { deriveInspirationSelection } from '@/utils/home-engine';

type UseAddMomentFlowOptions = {
  enabled: boolean;
  onAddMoment: (input: AddMomentInput) => void;
  timelineDays: HomeTimelineDay[];
  todayDay: HomeDayRecord | null;
};

const closedState: AddMomentFlowState = {
  stage: 'closed',
  actions: [],
  recentPhotos: [],
  inspirationSelection: null,
  absorption: null,
  error: null,
};

export function useAddMomentFlow({
  enabled,
  onAddMoment,
  timelineDays,
  todayDay,
}: UseAddMomentFlowOptions) {
  const actions = useMemo<RadialMomentAction[]>(
    () =>
      homeRadialActionOrder.map((id) => ({
        id,
        label: homeMomentOptions[id].label,
        icon: homeMomentOptions[id].icon,
        accentColor: homeMomentOptions[id].accentColor,
        kind: id === 'photo' ? 'photo' : id === 'inspiration' ? 'inspiration' : 'quick_tag',
      })),
    []
  );
  const [state, setState] = useState<AddMomentFlowState>({
    ...closedState,
    actions,
  });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const resetState = useCallback(
    (stage: AddMomentFlowState['stage'] = 'closed') => {
      clearTimers();
      setState({
        stage,
        actions,
        recentPhotos: [],
        inspirationSelection: null,
        absorption: null,
        error: null,
      });
    },
    [actions, clearTimers]
  );

  useEffect(() => {
    if (!enabled && state.stage !== 'closed') {
      resetState();
    }
  }, [enabled, resetState, state.stage]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const open = useCallback(() => {
    if (!enabled) {
      return;
    }

    setState((current) => ({
      ...current,
      stage: 'moment_ring',
      actions,
      recentPhotos: [],
      inspirationSelection: null,
      absorption: null,
      error: null,
    }));
  }, [actions, enabled]);

  const close = useCallback(() => {
    resetState();
  }, [resetState]);

  const dismissError = useCallback(() => {
    setState((current) => ({
      ...current,
      stage: 'moment_ring',
      error: null,
    }));
  }, []);

  const beginAbsorption = useCallback(
    (payload: AbsorptionPayload, input: AddMomentInput) => {
      clearTimers();
      setState((current) => ({
        ...current,
        stage: 'absorbing',
        absorption: payload,
        error: null,
      }));

      timersRef.current.push(
        setTimeout(() => {
          onAddMoment(input);
          setState((current) => ({
            ...current,
            stage: 'completed',
          }));
        }, 420)
      );
      timersRef.current.push(
        setTimeout(() => {
          resetState();
        }, 720)
      );
    },
    [clearTimers, onAddMoment, resetState]
  );

  const setError = useCallback((error: AddMomentFlowError) => {
    setState((current) => ({
      ...current,
      stage: 'error',
      error,
    }));
  }, []);

  const loadRecentPhotos = useCallback(async () => {
    const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
    if (!mediaLibraryNative) {
      throw new Error('Media library native module unavailable');
    }

    const MediaLibrary = await import('expo-media-library');
    const page = await MediaLibrary.getAssetsAsync({
      first: 18,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [['creationTime', false]],
    });

    const mapped: RecentPhotoAsset[] = page.assets.map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      thumbnailUri: asset.uri,
      createdAt: asset.creationTime,
      width: asset.width,
      height: asset.height,
      isScreenshot: asset.mediaSubtypes?.includes('screenshot'),
    }));
    const nonScreenshots = mapped.filter((asset) => !asset.isScreenshot);
    const prioritized = [...nonScreenshots, ...mapped.filter((asset) => asset.isScreenshot)];

    return prioritized.slice(0, 10);
  }, []);

  const usePhotoPickerFallback = useCallback(async () => {
    if (!enabled) {
      return;
    }

    let imagePickerModule: typeof import('expo-image-picker');
    const imagePickerNative = requireOptionalNativeModule('ExponentImagePicker');
    if (!imagePickerNative) {
      setError({
        title: 'Photo picker unavailable',
        body: 'This build does not include photo picking yet. Rebuild and reinstall the development app to enable the photo path.',
        action: null,
      });
      return;
    }

    try {
      imagePickerModule = await import('expo-image-picker');
    } catch {
      setError({
        title: 'Photo picker unavailable',
        body: 'This build does not include photo picking yet. Rebuild the app to enable the photo path.',
        action: null,
      });
      return;
    }

    setState((current) => ({
      ...current,
      stage: 'photo_picker_fallback',
      error: null,
    }));

    const result = await imagePickerModule.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.[0]) {
      setState((current) => ({
        ...current,
        stage: 'moment_ring',
      }));
      return;
    }

    const selectedAsset = result.assets[0];
    beginAbsorption(
      {
        kind: 'photo',
        label: 'Photo',
        accentColor: homeMomentOptions.photo.accentColor,
        orbitIndex: 0,
        orbitCount: 1,
        previewUri: selectedAsset.uri,
      },
      {
        type: 'photo',
        source: 'photo_library',
        metadata: {
          assetId: selectedAsset.assetId,
          height: selectedAsset.height,
          localUri: selectedAsset.uri,
          thumbnailUri: selectedAsset.uri,
          width: selectedAsset.width,
        },
      }
    );
  }, [beginAbsorption, enabled, setError]);

  const openInspirationCard = useCallback(
    (category?: InspirationCategory) => {
      const selection = deriveInspirationSelection(timelineDays, category);

      setState((current) => ({
        ...current,
        stage: 'inspiration_card',
        recentPhotos: [],
        inspirationSelection: selection,
        absorption: null,
        error: null,
      }));
    },
    [timelineDays]
  );

  const selectAction = useCallback(
    async (actionId: string) => {
      if (!enabled) {
        return;
      }

      const action = actions.find((item) => item.id === actionId);
      if (!action) {
        return;
      }

      if (action.kind === 'quick_tag') {
        beginAbsorption(
          {
            kind: 'tag',
            label: action.label,
            icon: action.icon,
            accentColor: action.accentColor,
            orbitIndex: actions.findIndex((item) => item.id === action.id),
            orbitCount: actions.length,
          },
          {
            type: action.id as HomeQuickMomentType,
            source: 'quick_tag',
          }
        );
        return;
      }

      if (action.kind === 'inspiration') {
        openInspirationCard();
        return;
      }

      setState((current) => ({
        ...current,
        stage: 'photo_permission_request',
        error: null,
      }));

      try {
        const mediaLibraryNative = requireOptionalNativeModule('ExpoMediaLibrary');
        if (!mediaLibraryNative) {
          setError({
            title: 'Photos unavailable',
            body: 'This build does not include the media library module yet. Rebuild and reinstall the development app to enable photo moments.',
            action: null,
          });
          return;
        }

        const MediaLibrary = await import('expo-media-library');
        const permission = await MediaLibrary.requestPermissionsAsync(false);
        if (!permission.granted) {
          setError({
            title: 'Photos unavailable',
            body: 'Allow photo access to show recent images around the egg, or use the picker instead.',
            action: 'use_picker',
          });
          return;
        }

        setState((current) => ({
          ...current,
          stage: 'photo_ring_loading',
          error: null,
        }));

        const recentPhotos = await loadRecentPhotos();
        setState((current) => ({
          ...current,
          stage: 'photo_ring_ready',
          recentPhotos,
          error: null,
        }));
      } catch {
        setError({
          title: 'Photo loading failed',
          body: 'Recent photos could not be loaded in-place. Rebuild the app if photo modules are missing, or use the picker if available.',
          action: 'use_picker',
        });
      }
    },
    [actions, beginAbsorption, enabled, loadRecentPhotos, openInspirationCard, setError]
  );

  const selectRecentPhoto = useCallback(
    (assetId: string) => {
      const index = state.recentPhotos.findIndex((asset) => asset.id === assetId);
      const asset = state.recentPhotos[index];
      if (!asset) {
        return;
      }

      beginAbsorption(
        {
          kind: 'photo',
          label: 'Photo',
          accentColor: homeMomentOptions.photo.accentColor,
          orbitIndex: index,
          orbitCount: Math.min(state.recentPhotos.length, 8),
          previewUri: asset.thumbnailUri || asset.uri,
        },
        {
          type: 'photo',
          source: 'photo_library',
          metadata: {
            assetId: asset.id,
            height: asset.height,
            isScreenshot: asset.isScreenshot,
            localUri: asset.uri,
            thumbnailUri: asset.thumbnailUri,
            width: asset.width,
          },
        }
      );
    },
    [beginAbsorption, state.recentPhotos]
  );

  const selectInspirationCategory = useCallback(
    (category: InspirationCategory) => {
      openInspirationCard(category);
    },
    [openInspirationCard]
  );

  const confirmInspiration = useCallback(() => {
    if (!state.inspirationSelection || !todayDay) {
      return;
    }

    const inspirationIndex = actions.findIndex((action) => action.id === 'inspiration');
    const { category, contextTags, quote } = state.inspirationSelection;

    beginAbsorption(
      {
        kind: 'inspiration',
        label: `${homeMomentOptions.inspiration.label}`,
        icon: homeMomentOptions.inspiration.icon,
        accentColor: homeMomentOptions.inspiration.accentColor,
        orbitIndex: inspirationIndex >= 0 ? inspirationIndex : 0,
        orbitCount: actions.length,
      },
      {
        type: 'inspiration',
        source: 'inspiration_library',
        metadata: {
          category,
          contextTags,
          quoteId: quote.id,
          text: quote.text,
        },
      }
    );
  }, [actions, beginAbsorption, state.inspirationSelection, todayDay]);

  return {
    state,
    open,
    close,
    selectAction,
    selectRecentPhoto,
    selectInspirationCategory,
    confirmInspiration,
    dismissError,
    usePhotoPickerFallback,
  };
}
