import { CameraView, type CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  DEFAULT_GLOBAL_HOODED_OWNER_ID,
  createSelfieAvatarProfile,
  defaultHoodedAvatarProfile,
} from '@/constants/avatar-art';
import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { KatchaDeckUI } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { AvatarArtifactRecord, AvatarStatus } from '@/types/avatar';
import {
  generateAvatar,
  loadAvatarArtifacts,
  setAvatarCanonical,
  uploadAvatarInput,
} from '@/utils/avatar-art';
import { getOrCreateLocalTestPlayerId } from '@/utils/local-test-player';

const avatarStatusOptions: ('all' | AvatarStatus)[] = [
  'all',
  'queued',
  'generating',
  'completed',
  'failed',
  'approved',
  'rejected',
];

export function AvatarStudio() {
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [viewMode, setViewMode] = useState<'generate' | 'library'>('generate');
  const [playerId] = useState(() => getOrCreateLocalTestPlayerId());
  const [avatarArtifacts, setAvatarArtifacts] = useState<AvatarArtifactRecord[]>([]);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [latestAvatarRecord, setLatestAvatarRecord] = useState<AvatarArtifactRecord | null>(null);
  const [selectedAvatarLibraryId, setSelectedAvatarLibraryId] = useState<string | null>(null);
  const [avatarOwnerFilter, setAvatarOwnerFilter] = useState<'all' | 'global_asset' | 'player'>('all');
  const [avatarKindFilter, setAvatarKindFilter] = useState<'all' | 'hooded_default' | 'selfie_avatar'>('all');
  const [avatarStatusFilter, setAvatarStatusFilter] = useState<'all' | AvatarStatus>('all');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<CameraCapturedPicture | null>(null);

  const loadAvatarData = useCallback(async () => {
    setAvatarLoading(true);
    setAvatarError(null);

    try {
      const records = await loadAvatarArtifacts();
      setAvatarArtifacts(records);
      if (selectedAvatarLibraryId && !records.some((record) => record.id === selectedAvatarLibraryId)) {
        setSelectedAvatarLibraryId(null);
      }
    } catch (caughtError) {
      setAvatarError(caughtError instanceof Error ? caughtError.message : 'Could not load avatar artifacts.');
    } finally {
      setAvatarLoading(false);
    }
  }, [selectedAvatarLibraryId]);

  useFocusEffect(
    useCallback(() => {
      void loadAvatarData();
    }, [loadAvatarData])
  );

  const globalAvatarVariants = useMemo(
    () =>
      avatarArtifacts.filter(
        (record) =>
          record.owner_kind === 'global_asset' &&
          record.owner_id === DEFAULT_GLOBAL_HOODED_OWNER_ID &&
          record.avatar_kind === 'hooded_default'
      ),
    [avatarArtifacts]
  );

  const playerAvatarVariants = useMemo(
    () =>
      avatarArtifacts.filter(
        (record) =>
          record.owner_kind === 'player' &&
          record.owner_id === playerId &&
          record.avatar_kind === 'selfie_avatar'
      ),
    [avatarArtifacts, playerId]
  );

  const currentGlobalAvatar =
    globalAvatarVariants.find((record) => record.is_canonical) ?? globalAvatarVariants[0] ?? null;
  const currentPlayerAvatar =
    playerAvatarVariants.find((record) => record.is_canonical) ?? playerAvatarVariants[0] ?? null;

  const filteredAvatarLibraryRecords = useMemo(
    () =>
      avatarArtifacts.filter((record) => {
        if (avatarOwnerFilter !== 'all' && record.owner_kind !== avatarOwnerFilter) {
          return false;
        }

        if (avatarKindFilter !== 'all' && record.avatar_kind !== avatarKindFilter) {
          return false;
        }

        if (avatarStatusFilter !== 'all' && record.status !== avatarStatusFilter) {
          return false;
        }

        return true;
      }),
    [avatarArtifacts, avatarKindFilter, avatarOwnerFilter, avatarStatusFilter]
  );

  const selectedAvatarLibraryRecord =
    filteredAvatarLibraryRecords.find((record) => record.id === selectedAvatarLibraryId) ?? null;

  async function handleGenerateHoodedAvatar() {
    setAvatarLoading(true);
    setAvatarError(null);

    try {
      const record = await generateAvatar(defaultHoodedAvatarProfile);
      setLatestAvatarRecord(record);
      await loadAvatarData();
    } catch (caughtError) {
      setAvatarError(caughtError instanceof Error ? caughtError.message : 'Could not generate hooded avatar.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleCaptureSelfie() {
    try {
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.8 });

      if (!picture) {
        return;
      }

      setCapturedSelfie(picture);
      setShowCamera(false);
    } catch (caughtError) {
      setAvatarError(caughtError instanceof Error ? caughtError.message : 'Could not capture selfie.');
    }
  }

  async function handleGenerateSelfieAvatar() {
    if (!capturedSelfie?.uri) {
      return;
    }

    setAvatarLoading(true);
    setAvatarError(null);

    try {
      const uploadedInput = await uploadAvatarInput(playerId, capturedSelfie.uri);
      const profile = createSelfieAvatarProfile(playerId, uploadedInput.path);
      const record = await generateAvatar(profile);
      setLatestAvatarRecord(record);
      await loadAvatarData();
    } catch (caughtError) {
      setAvatarError(caughtError instanceof Error ? caughtError.message : 'Could not generate selfie avatar.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleSetCanonicalAvatar(record: AvatarArtifactRecord) {
    setAvatarLoading(true);
    setAvatarError(null);

    try {
      const updated = await setAvatarCanonical(record);
      setLatestAvatarRecord(updated);
      await loadAvatarData();
    } catch (caughtError) {
      setAvatarError(caughtError instanceof Error ? caughtError.message : 'Could not set canonical avatar.');
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <>
      <Animated.View entering={presenceEnter(60)}>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setViewMode('generate')}
            style={[styles.modeChip, viewMode === 'generate' ? styles.modeChipSelected : null]}>
            <ThemedText style={styles.modeChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Generate
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('library')}
            style={[styles.modeChip, viewMode === 'library' ? styles.modeChipSelected : null]}>
            <ThemedText style={styles.modeChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Library
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {viewMode === 'generate' ? (
        <>
          <Animated.View entering={presenceEnter(100)}>
            <GlassPanel contentStyle={styles.panel}>
              <SectionHeader label="Default hooded avatar" title="Global fallback art" />
              {currentGlobalAvatar?.image_url ? (
                <Image contentFit="contain" source={{ uri: currentGlobalAvatar.image_url }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, styles.libraryImageFallback]}>
                  <ThemedText style={styles.libraryFallbackText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                    No generated hooded avatar yet
                  </ThemedText>
                </View>
              )}
              <ThemedText style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                Generate stylized hooded figure variants that can replace the code-native fallback in the app.
              </ThemedText>
              <KatchaButton
                disabled={avatarLoading}
                icon="sparkles"
                label={avatarLoading ? 'Generating...' : 'Generate hooded avatar'}
                onPress={handleGenerateHoodedAvatar}
                variant="primary"
              />
              <View style={styles.variantList}>
                {globalAvatarVariants.slice(0, 4).map((record) => (
                  <AvatarVariantRow
                    key={record.id}
                    record={record}
                    actionLabel={record.is_canonical ? 'Current default' : 'Use as default'}
                    disabled={record.is_canonical || avatarLoading}
                    onAction={() => void handleSetCanonicalAvatar(record)}
                  />
                ))}
              </View>
            </GlassPanel>
          </Animated.View>
 
          <Animated.View entering={presenceEnter(160)}>
            <GlassPanel contentStyle={styles.panel}>
              <SectionHeader label="Player avatar test" title="Selfie to stylized avatar" />
              <CopyField label="Local test player" value={playerId} />
              {showCamera ? (
                <View style={styles.cameraShell}>
                  <CameraView ref={cameraRef} facing="front" style={styles.camera} />
                  <View style={styles.cameraActions}>
                    <KatchaButton label="Capture selfie" icon="sparkles" onPress={handleCaptureSelfie} variant="primary" />
                    <KatchaButton label="Close camera" icon="xmark" onPress={() => setShowCamera(false)} variant="secondary" />
                  </View>
                </View>
              ) : capturedSelfie?.uri ? (
                <>
                  <Image source={{ uri: capturedSelfie.uri }} style={styles.previewImage} contentFit="cover" />
                  <View style={styles.buttonRow}>
                    <KatchaButton
                      label="Retake selfie"
                      icon="arrow.counterclockwise"
                      onPress={() => {
                        setCapturedSelfie(null);
                        setShowCamera(true);
                      }}
                      variant="secondary"
                    />
                    <KatchaButton
                      label={avatarLoading ? 'Generating...' : 'Generate self avatar'}
                      icon="sparkles"
                      onPress={handleGenerateSelfieAvatar}
                      variant="primary"
                      disabled={avatarLoading}
                    />
                  </View>
                </>
              ) : cameraPermission?.granted ? (
                <KatchaButton label="Open selfie camera" icon="sparkles" onPress={() => setShowCamera(true)} variant="primary" />
              ) : (
                <KatchaButton label="Allow camera access" icon="sparkles" onPress={() => void requestCameraPermission()} variant="primary" />
              )}
              {currentPlayerAvatar?.image_url ? (
                <>
                  <SectionHeader label="Current player avatar" title={currentPlayerAvatar.display_name} />
                  <Image contentFit="contain" source={{ uri: currentPlayerAvatar.image_url }} style={styles.previewImage} />
                </>
              ) : null}
              <View style={styles.variantList}>
                {playerAvatarVariants.slice(0, 6).map((record) => (
                  <AvatarVariantRow
                    key={record.id}
                    record={record}
                    actionLabel={record.is_canonical ? 'Current avatar' : 'Use as avatar'}
                    disabled={record.is_canonical || avatarLoading}
                    onAction={() => void handleSetCanonicalAvatar(record)}
                  />
                ))}
              </View>
              {avatarError ? (
                <ThemedText selectable style={styles.errorText} lightColor="#FFD8C0" darkColor="#FFD8C0">
                  {avatarError}
                </ThemedText>
              ) : null}
            </GlassPanel>
          </Animated.View>

          {latestAvatarRecord ? (
            <Animated.View entering={presenceEnter(220)}>
              <GlassPanel contentStyle={styles.panel}>
                <SectionHeader label="Latest avatar result" title={latestAvatarRecord.display_name} />
                {latestAvatarRecord.image_url ? (
                  <Image contentFit="contain" source={{ uri: latestAvatarRecord.image_url }} style={styles.previewImage} />
                ) : null}
                <ThemedText style={styles.metaText} lightColor="#C9DBFF" darkColor="#C9DBFF">
                  {formatAvatarMeta(latestAvatarRecord)}
                </ThemedText>
                <CopyField label="Prompt" value={latestAvatarRecord.prompt} />
                <CopyField label="Render path" value={latestAvatarRecord.render_storage_path ?? '—'} />
              </GlassPanel>
            </Animated.View>
          ) : null}
        </>
      ) : (
        <Animated.View entering={presenceEnter(100)}>
          <GlassPanel contentStyle={styles.panel}>
            <SectionHeader
              label="Avatar library"
              title={avatarLoading ? 'Loading avatar artifacts...' : `${filteredAvatarLibraryRecords.length} stored avatars`}
            />
            <View style={styles.filterColumn}>
              <ChipRow
                items={['all', 'global_asset', 'player']}
                label="Owner"
                selected={avatarOwnerFilter}
                onSelect={(value) => setAvatarOwnerFilter(value as 'all' | 'global_asset' | 'player')}
              />
              <ChipRow
                items={['all', 'hooded_default', 'selfie_avatar']}
                label="Kind"
                selected={avatarKindFilter}
                onSelect={(value) => setAvatarKindFilter(value as 'all' | 'hooded_default' | 'selfie_avatar')}
              />
              <ChipRow
                items={avatarStatusOptions}
                label="Status"
                selected={avatarStatusFilter}
                onSelect={(value) => setAvatarStatusFilter(value as 'all' | AvatarStatus)}
              />
            </View>
            <KatchaButton
              icon="arrow.counterclockwise"
              label={avatarLoading ? 'Refreshing...' : 'Refresh avatars'}
              onPress={() => void loadAvatarData()}
              variant="secondary"
              disabled={avatarLoading}
            />
            <View style={styles.libraryGrid}>
              {filteredAvatarLibraryRecords.map((record) => (
                <Pressable
                  key={record.id}
                  onPress={() =>
                    setSelectedAvatarLibraryId((current) => (current === record.id ? null : record.id))
                  }
                  style={[
                    styles.libraryTile,
                    selectedAvatarLibraryId === record.id ? styles.libraryTileSelected : null,
                  ]}>
                  {record.image_url ? (
                    <Image contentFit="cover" source={{ uri: record.image_url }} style={styles.libraryImage} />
                  ) : (
                    <View style={[styles.libraryImage, styles.libraryImageFallback]}>
                      <ThemedText style={styles.libraryFallbackText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                        No image
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText numberOfLines={2} style={styles.libraryTileTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                    {record.display_name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {selectedAvatarLibraryRecord ? (
              <View style={styles.libraryDetails}>
                <SectionHeader label="Selected avatar" title={selectedAvatarLibraryRecord.display_name} />
                {selectedAvatarLibraryRecord.image_url ? (
                  <Image contentFit="contain" source={{ uri: selectedAvatarLibraryRecord.image_url }} style={styles.previewImage} />
                ) : null}
                <ThemedText style={styles.metaText} lightColor="#C9DBFF" darkColor="#C9DBFF">
                  {formatAvatarMeta(selectedAvatarLibraryRecord)}
                </ThemedText>
                <View style={styles.copyList}>
                  <CopyField label="Caption" value={selectedAvatarLibraryRecord.caption ?? '—'} />
                  <CopyField label="Prompt" value={selectedAvatarLibraryRecord.prompt} />
                  <CopyField label="Input path" value={selectedAvatarLibraryRecord.input_storage_path ?? '—'} />
                  <CopyField label="Render path" value={selectedAvatarLibraryRecord.render_storage_path ?? '—'} />
                  <CopyField label="Canonical" value={selectedAvatarLibraryRecord.is_canonical ? 'Yes' : 'No'} />
                </View>
                {!selectedAvatarLibraryRecord.is_canonical ? (
                  <KatchaButton
                    label="Use this avatar"
                    icon="sparkles"
                    onPress={() => void handleSetCanonicalAvatar(selectedAvatarLibraryRecord)}
                    variant="primary"
                    disabled={avatarLoading}
                  />
                ) : null}
              </View>
            ) : null}
          </GlassPanel>
        </Animated.View>
      )}
    </>
  );
}

function formatAvatarMeta(record: AvatarArtifactRecord) {
  return [
    formatChipLabel(record.owner_kind),
    formatChipLabel(record.avatar_kind),
    formatChipLabel(record.status),
    record.is_canonical ? 'Canonical' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatChipLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.copyField}>
      <ThemedText type="label" style={styles.copyLabel} lightColor="#C4D8FF" darkColor="#C4D8FF">
        {label}
      </ThemedText>
      <ThemedText selectable style={styles.copyValue} lightColor="#F3F7FF" darkColor="#F3F7FF">
        {value}
      </ThemedText>
    </View>
  );
}

function ChipRow<T extends string>({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: readonly T[] | T[];
  selected: string;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chipGroup}>
      <ThemedText type="label" style={styles.groupLabel} lightColor="#C4D8FF" darkColor="#C4D8FF">
        {label}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {items.map((item) => (
            <Pressable
              key={item}
              onPress={() => onSelect(item)}
              style={[styles.filterChip, selected === item ? styles.filterChipSelected : null]}>
              <ThemedText style={styles.filterChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {formatChipLabel(item)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function AvatarVariantRow({
  record,
  actionLabel,
  disabled,
  onAction,
}: {
  record: AvatarArtifactRecord;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.variantRow}>
      {record.image_url ? <Image source={{ uri: record.image_url }} style={styles.thumb} /> : null}
      <View style={styles.variantCopy}>
        <ThemedText style={styles.variantTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {record.display_name}
        </ThemedText>
        <ThemedText style={styles.variantMeta} lightColor="#DCE6FF" darkColor="#DCE6FF">
          {formatAvatarMeta(record)}
        </ThemedText>
      </View>
      <View style={styles.variantAction}>
        <KatchaButton label={actionLabel} onPress={onAction} variant="secondary" disabled={disabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeChipSelected: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderColor: 'rgba(200,216,255,0.3)',
  },
  modeChipText: {
    fontSize: 14,
  },
  panel: {
    gap: 14,
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaText: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  copyList: {
    gap: 12,
  },
  copyField: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 12,
  },
  copyLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  copyValue: {
    fontSize: 14,
    lineHeight: 21,
  },
  previewImage: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: KatchaDeckUI.radii.md,
    height: 320,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
  },
  chipGroup: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 11,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderColor: 'rgba(200,216,255,0.3)',
  },
  filterChipText: {
    fontSize: 13,
  },
  filterColumn: {
    gap: 12,
  },
  libraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  libraryTile: {
    gap: 6,
    width: '23%',
  },
  libraryTileSelected: {
    opacity: 1,
  },
  libraryImage: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    height: 78,
    width: '100%',
  },
  libraryImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryFallbackText: {
    fontSize: 11,
  },
  libraryTileTitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  libraryDetails: {
    gap: 14,
    marginTop: 8,
  },
  variantList: {
    gap: 12,
  },
  variantRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  variantCopy: {
    flex: 1,
    gap: 4,
  },
  variantTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  variantMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  variantAction: {
    minWidth: 124,
  },
  thumb: {
    borderRadius: 12,
    height: 68,
    width: 68,
  },
  cameraShell: {
    gap: 12,
  },
  camera: {
    borderRadius: KatchaDeckUI.radii.md,
    height: 360,
    overflow: 'hidden',
    width: '100%',
  },
  cameraActions: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
