import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
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
import { KatchaDeckUI } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import type { GeneratedKatchimeraRecord, KatchimeraEncounterProfile } from '@/types/katchimera';
import { supabase } from '@/utils/supabase';

export default function ArtLabScreen() {
  const [topLevelType, setTopLevelType] = useState<string>(katchimeraEncounterTypes[0] ?? 'location');
  const [triggerCategory, setTriggerCategory] = useState<string>('all');
  const [triggerSubtype, setTriggerSubtype] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRecord, setLatestRecord] = useState<GeneratedKatchimeraRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<GeneratedKatchimeraRecord[]>([]);

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

  useFocusEffect(
    useCallback(() => {
      if (!selectedProfile) {
        setRecentRecords([]);
        setLatestRecord(null);
        return;
      }

      void loadRecent(selectedProfile.id);
    }, [selectedProfile])
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
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Katchimera Art Lab' }} />
      <AmbientBackground
        accentColor="rgba(200,216,255,0.16)"
        colors={['#090B12', '#10192A', '#171E34']}
        meshColors={[
          'rgba(200,216,255,0.14)',
          'rgba(240,223,255,0.1)',
          'rgba(95,168,123,0.08)',
          'rgba(227,160,110,0.08)',
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()}>
          <ThemedText type="label" style={styles.kicker} lightColor="#D4E1FF" darkColor="#D4E1FF">
            Dev tool
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
            Generate Katchimera art
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
            Select an encounter-based Katchimera, invoke the Edge Function, and inspect the stored result.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={presenceEnter(80)}>
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
      </ScrollView>
    </View>
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

function formatChipLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ChipRow({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: string[];
  selected: string;
  onSelect: (value: string) => void;
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
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  content: {
    gap: KatchaDeckUI.spacing.lg,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  kicker: {
    fontSize: 11,
    marginBottom: 6,
  },
  title: {
    fontSize: 40,
    lineHeight: 42,
    marginBottom: 12,
  },
  body: {
    maxWidth: 340,
  },
  panel: {
    gap: 14,
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
});
