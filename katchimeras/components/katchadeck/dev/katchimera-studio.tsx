import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { presenceEnter } from '@/components/katchadeck/motion';
import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import {
  katchimeraEncounterCategories,
  katchimeraEncounterProfiles,
  katchimeraEncounterSubtypes,
  katchimeraEncounterTypes,
} from '@/constants/katchimera-encounter-profiles';
import { onboardingShowcaseEntries, onboardingShowcaseProfiles } from '@/constants/onboarding-showcase';
import { KatchaDeckUI } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { GeneratedKatchimeraRecord, KatchimeraEncounterProfile } from '@/types/katchimera';
import { supabase } from '@/utils/supabase';

export function KatchimeraStudio() {
  const [viewMode, setViewMode] = useState<'generate' | 'library'>('generate');
  const [topLevelType, setTopLevelType] = useState<string>(katchimeraEncounterTypes[0] ?? 'location');
  const [triggerCategory, setTriggerCategory] = useState<string>('all');
  const [triggerSubtype, setTriggerSubtype] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRecord, setLatestRecord] = useState<GeneratedKatchimeraRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<GeneratedKatchimeraRecord[]>([]);
  const [libraryRecords, setLibraryRecords] = useState<GeneratedKatchimeraRecord[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [showcaseProgress, setShowcaseProgress] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const lowered = search.trim().toLowerCase();

    return katchimeraEncounterProfiles.filter((profile) => {
      if (topLevelType && profile.topLevelType !== topLevelType) {
        return false;
      }

      if (triggerCategory !== 'all' && profile.triggerCategory !== triggerCategory) {
        return false;
      }

      if (triggerSubtype !== 'all' && profile.triggerSubtype !== triggerSubtype) {
        return false;
      }

      if (!lowered) {
        return true;
      }

      return (
        profile.displayName.toLowerCase().includes(lowered) ||
        profile.caption.toLowerCase().includes(lowered) ||
        profile.triggerSubtype.toLowerCase().includes(lowered) ||
        profile.theme.toLowerCase().includes(lowered)
      );
    });
  }, [search, topLevelType, triggerCategory, triggerSubtype]);

  const selectedProfile =
    filteredProfiles.find((profile) => profile.id === selectedId) ?? filteredProfiles[0] ?? null;
  const selectedLibraryRecord =
    libraryRecords.find((record) => record.id === selectedLibraryId) ?? null;
  const onboardingShowcaseSet = useMemo(
    () =>
      onboardingShowcaseEntries.map((entry) => ({
        ...entry,
        profile:
          onboardingShowcaseProfiles.find((profile) => profile.id === entry.profileId) ?? null,
      })),
    []
  );

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    const { data, error: selectError } = await supabase
      .from('generated_katchimeras')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(240);

    setLibraryLoading(false);

    if (selectError) {
      setLibraryError(selectError.message);
      return;
    }

    const deduped = new Map<string, GeneratedKatchimeraRecord>();
    for (const record of (data ?? []) as GeneratedKatchimeraRecord[]) {
      if (!deduped.has(record.render_profile_id)) {
        deduped.set(record.render_profile_id, record);
      }
    }

    const nextRecords = [...deduped.values()];
    setLibraryRecords(nextRecords);

    if (selectedLibraryId && !nextRecords.some((record) => record.id === selectedLibraryId)) {
      setSelectedLibraryId(null);
    }
  }, [selectedLibraryId]);

  useFocusEffect(
    useCallback(() => {
      void loadLibrary();

      if (!selectedProfile) {
        setRecentRecords([]);
        setLatestRecord(null);
        return;
      }

      void loadRecent(selectedProfile.id);
    }, [loadLibrary, selectedProfile])
  );

  async function loadRecent(renderProfileId: string) {
    const { data, error: selectError } = await supabase
      .from('generated_katchimeras')
      .select('*')
      .eq('render_profile_id', renderProfileId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (selectError) {
      setError(selectError.message);
      return;
    }

    const records = (data ?? []) as GeneratedKatchimeraRecord[];
    setRecentRecords(records);
    setLatestRecord(records[0] ?? null);
  }

  async function handleGenerate() {
    if (!selectedProfile) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke('generate-katchimera-art', {
      body: {
        renderProfile: selectedProfile,
      },
    });

    setLoading(false);

    if (invokeError) {
      setError(invokeError.message);
      return;
    }

    if (!data?.record) {
      setError('The generation function returned no record.');
      return;
    }

    setLatestRecord(data.record as GeneratedKatchimeraRecord);
    await loadRecent(selectedProfile.id);
    await loadLibrary();
  }

  async function handleGenerateOnboardingSet() {
    const resolvedEntries = onboardingShowcaseSet.filter(
      (entry): entry is (typeof onboardingShowcaseSet)[number] & { profile: KatchimeraEncounterProfile } =>
        Boolean(entry.profile)
    );

    if (resolvedEntries.length !== onboardingShowcaseSet.length) {
      const missing = onboardingShowcaseSet
        .filter((entry) => !entry.profile)
        .map((entry) => entry.profileId)
        .join(', ');
      setShowcaseError(`Missing onboarding showcase profiles: ${missing}`);
      return;
    }

    setShowcaseLoading(true);
    setShowcaseError(null);
    setShowcaseProgress(null);

    const failures: string[] = [];
    let lastRecord: GeneratedKatchimeraRecord | null = null;

    for (let index = 0; index < resolvedEntries.length; index += 1) {
      const entry = resolvedEntries[index];
      setShowcaseProgress(`Generating ${index + 1}/${resolvedEntries.length}: ${entry.profile.displayName}`);

      const { data, error: invokeError } = await supabase.functions.invoke('generate-katchimera-art', {
        body: {
          renderProfile: entry.profile,
        },
      });

      if (invokeError || !data?.record) {
        failures.push(entry.profile.displayName);
        continue;
      }

      lastRecord = data.record as GeneratedKatchimeraRecord;
    }

    setShowcaseLoading(false);
    setShowcaseProgress(null);

    if (lastRecord) {
      setLatestRecord(lastRecord);
    }

    if (selectedProfile) {
      await loadRecent(selectedProfile.id);
    }
    await loadLibrary();

    if (failures.length > 0) {
      setShowcaseError(`Failed to generate: ${failures.join(', ')}`);
      return;
    }

    setShowcaseError(null);
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
            onPress={() => {
              setViewMode('library');
              void loadLibrary();
            }}
            style={[styles.modeChip, viewMode === 'library' ? styles.modeChipSelected : null]}>
            <ThemedText style={styles.modeChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
              Library
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {viewMode === 'generate' ? (
        <>
          <Animated.View entering={presenceEnter(80)}>
            <GlassPanel contentStyle={styles.panel}>
              <SectionHeader label="Onboarding showcase" title="Curated range for intro sequencing" />
              <ThemedText style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                A stronger onboarding set should span movement, ritual, curiosity, rare places, and the final personal reveal.
              </ThemedText>
              <View style={styles.showcaseList}>
                {onboardingShowcaseSet.map((entry) => (
                  <View key={entry.id} style={styles.showcaseRow}>
                    <View style={styles.showcaseBeat}>
                      <ThemedText type="label" style={styles.showcaseBeatText} lightColor="#C4D8FF" darkColor="#C4D8FF">
                        {entry.beat}
                      </ThemedText>
                    </View>
                    <View style={styles.showcaseCopy}>
                      <ThemedText style={styles.showcaseTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                        {entry.profile?.displayName ?? entry.profileId}
                      </ThemedText>
                      <ThemedText style={styles.showcaseMeta} lightColor="#C9DBFF" darkColor="#C9DBFF">
                        {entry.journal.title} · {entry.journal.timeLabel} · {entry.journal.location}
                      </ThemedText>
                      <ThemedText style={styles.showcaseMetrics} lightColor="#E9D1BE" darkColor="#E9D1BE">
                        {entry.journal.metrics}
                      </ThemedText>
                      <ThemedText style={styles.showcaseBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                        {entry.journal.body}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
              <KatchaButton
                disabled={showcaseLoading}
                icon="sparkles"
                label={showcaseLoading ? 'Generating onboarding set...' : 'Generate onboarding set'}
                onPress={() => void handleGenerateOnboardingSet()}
                variant="primary"
              />
              {showcaseProgress ? (
                <ThemedText style={styles.metaText} lightColor="#C9DBFF" darkColor="#C9DBFF">
                  {showcaseProgress}
                </ThemedText>
              ) : null}
              {showcaseError ? (
                <ThemedText selectable style={styles.errorText} lightColor="#FFD8C0" darkColor="#FFD8C0">
                  {showcaseError}
                </ThemedText>
              ) : null}
            </GlassPanel>
          </Animated.View>

          <Animated.View entering={presenceEnter(100)}>
            <GlassPanel contentStyle={styles.panel}>
              <SectionHeader label="Filters" title="Choose a trigger and encounter" />
              <TextInput
                onChangeText={setSearch}
                placeholder="Search by name or caption"
                placeholderTextColor="rgba(212,225,255,0.5)"
                style={styles.searchInput}
                value={search}
              />
              <ChipRow
                items={katchimeraEncounterTypes}
                label="Type"
                selected={topLevelType}
                onSelect={(value) => {
                  setTopLevelType(value);
                  setTriggerCategory('all');
                  setTriggerSubtype('all');
                  setSelectedId(null);
                }}
              />
              <ChipRow
                items={[
                  'all',
                  ...katchimeraEncounterCategories.filter((category) =>
                    katchimeraEncounterProfiles.some(
                      (profile) =>
                        profile.topLevelType === topLevelType && profile.triggerCategory === category
                    )
                  ),
                ]}
                label="Category"
                selected={triggerCategory}
                onSelect={(value) => {
                  setTriggerCategory(value);
                  setTriggerSubtype('all');
                  setSelectedId(null);
                }}
              />
              <ChipRow
                items={[
                  'all',
                  ...katchimeraEncounterSubtypes.filter((subtype) =>
                    katchimeraEncounterProfiles.some(
                      (profile) =>
                        profile.topLevelType === topLevelType &&
                        (triggerCategory === 'all' || profile.triggerCategory === triggerCategory) &&
                        profile.triggerSubtype === subtype
                    )
                  ),
                ]}
                label="Trigger"
                selected={triggerSubtype}
                onSelect={(value) => {
                  setTriggerSubtype(value);
                  setSelectedId(null);
                }}
              />
            </GlassPanel>
          </Animated.View>

          <Animated.View entering={presenceEnter(140)}>
            <GlassPanel contentStyle={styles.panel}>
              <SectionHeader label="Profiles" title={`${filteredProfiles.length} matching variants`} />
              <View style={styles.profileGrid}>
                {filteredProfiles.slice(0, 30).map((profile) => (
                  <Pressable
                    key={profile.id}
                    onPress={() => setSelectedId(profile.id)}
                    style={[
                      styles.profileChip,
                      selectedProfile?.id === profile.id ? styles.profileChipSelected : null,
                    ]}>
                    <ThemedText style={styles.profileChipText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {profile.displayName}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </GlassPanel>
          </Animated.View>

          {selectedProfile ? (
            <Animated.View entering={presenceEnter(220)}>
              <GlassPanel contentStyle={styles.panel}>
                <SectionHeader label="Selected profile" title={selectedProfile.displayName} />
                <ThemedText style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {selectedProfile.caption}
                </ThemedText>
                <ThemedText style={styles.metaText} lightColor="#C9DBFF" darkColor="#C9DBFF">
                  {formatEncounterMeta(selectedProfile)}
                </ThemedText>
                <ThemedText style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {selectedProfile.userFacingDescription}
                </ThemedText>
                <ThemedText style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  {selectedProfile.visualDescription}
                </ThemedText>
                <ThemedText selectable style={styles.promptText} lightColor="#E9F1FF" darkColor="#E9F1FF">
                  {selectedProfile.imagePrompt}
                </ThemedText>
                <KatchaButton
                  disabled={loading}
                  icon="sparkles"
                  label={loading ? 'Generating...' : 'Generate art'}
                  onPress={handleGenerate}
                  variant="primary"
                />
                {error ? (
                  <ThemedText selectable style={styles.errorText} lightColor="#FFD8C0" darkColor="#FFD8C0">
                    {error}
                  </ThemedText>
                ) : null}
              </GlassPanel>
            </Animated.View>
          ) : null}
 
          {selectedProfile ? (
            <Animated.View entering={presenceEnter(250)}>
              <GlassPanel contentStyle={styles.panel}>
                <SectionHeader label="Reveal copy" title="Emotional and progression lines" />
                <View style={styles.copyList}>
                  <CopyField label="Motivational quote" value={selectedProfile.motivationalQuote} />
                  <CopyField label="Identity insight" value={selectedProfile.identityInsight} />
                  <CopyField label="Unlock line" value={selectedProfile.unlockLine} />
                  <CopyField label="Repeat line" value={selectedProfile.repeatLine} />
                  <CopyField label="Rare line" value={selectedProfile.rareLine} />
                  <CopyField label="Restorative line" value={selectedProfile.restorativeLine} />
                  <CopyField label="Progress line" value={selectedProfile.progressLine} />
                  <CopyField label="Story seed" value={selectedProfile.storySeed} />
                </View>
              </GlassPanel>
            </Animated.View>
          ) : null}

          {latestRecord ? (
            <Animated.View entering={presenceEnter(280)}>
              <GlassPanel contentStyle={styles.panel}>
                <SectionHeader label="Latest result" title={latestRecord.display_name} />
                {latestRecord.image_url ? (
                  <Image
                    contentFit="contain"
                    source={{ uri: latestRecord.image_url }}
                    style={styles.previewImage}
                  />
                ) : null}
                <ThemedText selectable style={styles.panelText} lightColor="#DCE6FF" darkColor="#DCE6FF">
                  Status: {latestRecord.status}
                </ThemedText>
                {latestRecord.image_url ? (
                  <ThemedText selectable style={styles.promptText} lightColor="#E9F1FF" darkColor="#E9F1FF">
                    {latestRecord.image_url}
                  </ThemedText>
                ) : null}
              </GlassPanel>
            </Animated.View>
          ) : null}

          {recentRecords.length > 0 ? (
            <Animated.View entering={presenceEnter(340)}>
              <GlassPanel contentStyle={styles.panel}>
                <SectionHeader label="Recent history" title="Stored generations" />
                <View style={styles.historyList}>
                  {recentRecords.map((record) => (
                    <View key={record.id} style={styles.historyRow}>
                      <View style={styles.historyCopy}>
                        <ThemedText style={styles.historyTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                          {record.display_name}
                        </ThemedText>
                        <ThemedText style={styles.historyMeta} lightColor="#DCE6FF" darkColor="#DCE6FF">
                          {record.status} · {new Date(record.created_at).toLocaleString()}
                        </ThemedText>
                      </View>
                      {record.image_url ? <Image source={{ uri: record.image_url }} style={styles.thumb} /> : null}
                    </View>
                  ))}
                </View>
              </GlassPanel>
            </Animated.View>
          ) : null}
        </>
      ) : (
        <Animated.View entering={presenceEnter(100)}>
          <GlassPanel contentStyle={styles.panel}>
            <SectionHeader
              label="Database library"
              title={libraryLoading ? 'Loading stored generations...' : `${libraryRecords.length} saved Katchimeras`}
            />
            <KatchaButton
              icon="arrow.counterclockwise"
              label={libraryLoading ? 'Refreshing...' : 'Refresh library'}
              onPress={() => void loadLibrary()}
              variant="secondary"
              disabled={libraryLoading}
            />
            {libraryError ? (
              <ThemedText selectable style={styles.errorText} lightColor="#FFD8C0" darkColor="#FFD8C0">
                {libraryError}
              </ThemedText>
            ) : null}
            <View style={styles.libraryGrid}>
              {libraryRecords.map((record) => (
                <Pressable
                  key={record.id}
                  onPress={() =>
                    setSelectedLibraryId((current) => (current === record.id ? null : record.id))
                  }
                  style={[
                    styles.libraryTile,
                    selectedLibraryId === record.id ? styles.libraryTileSelected : null,
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
                  <ThemedText
                    numberOfLines={2}
                    style={styles.libraryTileTitle}
                    lightColor="#F8FBFF"
                    darkColor="#F8FBFF">
                    {record.display_name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {selectedLibraryRecord ? (
              <View style={styles.libraryDetails}>
                <SectionHeader label="Selected record" title={selectedLibraryRecord.display_name} />
                {selectedLibraryRecord.image_url ? (
                  <Image
                    contentFit="contain"
                    source={{ uri: selectedLibraryRecord.image_url }}
                    style={styles.previewImage}
                  />
                ) : null}
                <ThemedText style={styles.metaText} lightColor="#C9DBFF" darkColor="#C9DBFF">
                  {formatRecordMeta(selectedLibraryRecord)}
                </ThemedText>
                <View style={styles.copyList}>
                  <CopyField label="Caption" value={selectedLibraryRecord.source_profile.caption ?? '—'} />
                  <CopyField
                    label="Motivational quote"
                    value={readEncounterCopy(selectedLibraryRecord, 'motivationalQuote')}
                  />
                  <CopyField
                    label="Identity insight"
                    value={readEncounterCopy(selectedLibraryRecord, 'identityInsight')}
                  />
                  <CopyField label="Unlock line" value={readEncounterCopy(selectedLibraryRecord, 'unlockLine')} />
                  <CopyField label="Repeat line" value={readEncounterCopy(selectedLibraryRecord, 'repeatLine')} />
                  <CopyField label="Rare line" value={readEncounterCopy(selectedLibraryRecord, 'rareLine')} />
                  <CopyField
                    label="Restorative line"
                    value={readEncounterCopy(selectedLibraryRecord, 'restorativeLine')}
                  />
                  <CopyField label="Progress line" value={readEncounterCopy(selectedLibraryRecord, 'progressLine')} />
                  <CopyField label="Story seed" value={readEncounterCopy(selectedLibraryRecord, 'storySeed')} />
                  <CopyField label="Stored path" value={selectedLibraryRecord.storage_path ?? '—'} />
                </View>
              </View>
            ) : null}
          </GlassPanel>
        </Animated.View>
      )}
    </>
  );
}

function formatEncounterMeta(profile: KatchimeraEncounterProfile) {
  return [
    formatChipLabel(profile.topLevelType),
    formatChipLabel(profile.triggerCategory),
    formatChipLabel(profile.triggerSubtype),
    formatChipLabel(profile.creatureKind),
    formatChipLabel(profile.baseRarity),
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatRecordMeta(record: GeneratedKatchimeraRecord) {
  return [
    record.top_level_type ? formatChipLabel(record.top_level_type) : null,
    record.trigger_category ? formatChipLabel(record.trigger_category) : null,
    record.trigger_subtype ? formatChipLabel(record.trigger_subtype) : null,
    record.creature_kind ? formatChipLabel(record.creature_kind) : null,
    record.status ? formatChipLabel(record.status) : null,
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

function readEncounterCopy(
  record: GeneratedKatchimeraRecord,
  key:
    | 'motivationalQuote'
    | 'identityInsight'
    | 'unlockLine'
    | 'repeatLine'
    | 'rareLine'
    | 'restorativeLine'
    | 'progressLine'
    | 'storySeed'
) {
  const profile = record.source_profile as Record<string, unknown> | null;
  const value = profile?.[key];
  return typeof value === 'string' && value.length > 0 ? value : '—';
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
  showcaseList: {
    gap: 12,
  },
  showcaseRow: {
    flexDirection: 'row',
    gap: 12,
  },
  showcaseBeat: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200,216,255,0.08)',
    borderColor: 'rgba(200,216,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  showcaseBeatText: {
    fontSize: 11,
    textAlign: 'center',
  },
  showcaseCopy: {
    flex: 1,
    gap: 4,
  },
  showcaseTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  showcaseMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  showcaseMetrics: {
    fontSize: 13,
    lineHeight: 17,
  },
  showcaseBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: KatchaDeckUI.radii.md,
    borderWidth: 1,
    color: '#F8FBFF',
    minHeight: 54,
    paddingHorizontal: 16,
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
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileChipSelected: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderColor: 'rgba(200,216,255,0.28)',
  },
  profileChipText: {
    fontSize: 13,
  },
  panelText: {
    fontSize: 15,
    lineHeight: 22,
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
  metaText: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
  },
  previewImage: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: KatchaDeckUI.radii.md,
    height: 320,
    width: '100%',
  },
  historyList: {
    gap: 12,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  historyMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  thumb: {
    borderRadius: 12,
    height: 68,
    width: 68,
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
});
