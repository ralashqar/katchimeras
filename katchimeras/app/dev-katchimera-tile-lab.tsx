import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KATCHIMERA_HEX_TILE_CATALOG } from '@/constants/katchimera-hex-tile-sources.gen';
import { useKingdom } from '@/hooks/use-kingdom';
import {
  loadKatchimeraHexTileOverrides,
  saveKatchimeraHexTileOverrides,
  setKatchimeraHexTileOverride,
  setKatchimeraHexTileVariantSelection,
  type KatchimeraHexTileOverrideManifest,
} from '@/utils/katchimera-hex-tiles';
import {
  defaultKatchimeraTilePrompt,
  generateKatchimeraHexTile,
  keepKatchimeraHexTileCell,
  tileCandidateFromCreature,
  tileCandidatesFromCast,
  type KatchimeraTileCandidate,
} from '@/utils/katchimera-hex-tile-lab';
import { KINGDOM_HEX_BASE_TILE_VARIANTS, type KingdomHexTileVariant } from '@/utils/world-visuals';
import type { AssetLabIteration, AssetLabMode, AssetLabModel } from '@/utils/asset-lab';

const MODE_OPTIONS: AssetLabMode[] = ['2x2', 'single', '4x4'];
const MODEL_OPTIONS: AssetLabModel[] = ['nano', 'gpt'];

const EMPTY_MANIFEST: KatchimeraHexTileOverrideManifest = {
  byCreatureId: {},
  byVisualKey: {},
  selectedVariantByVisualKey: {},
  history: {},
};

function historyKey(candidate: KatchimeraTileCandidate) {
  return candidate.creatureId ? `${candidate.visualKey}:${candidate.creatureId}` : candidate.visualKey;
}

function candidateOverride(manifest: KatchimeraHexTileOverrideManifest, candidate: KatchimeraTileCandidate) {
  if (candidate.creatureId) {
    return manifest.byCreatureId[candidate.creatureId] ?? manifest.byVisualKey[candidate.visualKey] ?? null;
  }
  return manifest.byVisualKey[candidate.visualKey] ?? null;
}

function sourceFromOverride(uri: string): ImageSourcePropType {
  return { uri };
}

export default function DevKatchimeraTileLabScreen() {
  const insets = useSafeAreaInsets();
  const { kingdom } = useKingdom();
  const residentCandidates = useMemo(() => kingdom.creatures.map(tileCandidateFromCreature), [kingdom.creatures]);
  const castCandidates = useMemo(() => tileCandidatesFromCast(), []);
  const [manifest, setManifest] = useState<KatchimeraHexTileOverrideManifest>(EMPTY_MANIFEST);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<AssetLabMode>('2x2');
  const [model, setModel] = useState<AssetLabModel>('nano');
  const [matte, setMatte] = useState(true);
  const [baseTileId, setBaseTileId] = useState(KINGDOM_HEX_BASE_TILE_VARIANTS[0].id);
  const [generating, setGenerating] = useState(false);
  const [keepingCellUrl, setKeepingCellUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allCandidates = useMemo(() => {
    const seen = new Set<string>();
    const combined: KatchimeraTileCandidate[] = [];
    for (const candidate of [...residentCandidates, ...castCandidates]) {
      const key = historyKey(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(candidate);
      }
    }
    return combined;
  }, [castCandidates, residentCandidates]);

  const selected = useMemo(() => {
    if (!selectedKey) return allCandidates[0] ?? null;
    return allCandidates.find((candidate) => historyKey(candidate) === selectedKey) ?? allCandidates[0] ?? null;
  }, [allCandidates, selectedKey]);

  const baseTile = useMemo<KingdomHexTileVariant>(
    () => KINGDOM_HEX_BASE_TILE_VARIANTS.find((variant) => variant.id === baseTileId) ?? KINGDOM_HEX_BASE_TILE_VARIANTS[0],
    [baseTileId]
  );

  const selectedHistory = selected ? manifest.history[historyKey(selected)] ?? [] : [];
  const selectedOverride = selected ? candidateOverride(manifest, selected) : null;
  const selectedCatalog = selected ? KATCHIMERA_HEX_TILE_CATALOG[selected.visualKey] : null;
  const selectedBundledVariantId = selected
    ? manifest.selectedVariantByVisualKey?.[selected.visualKey] ?? selectedCatalog?.selectedVariantId
    : null;

  useEffect(() => {
    setManifest(loadKatchimeraHexTileOverrides());
  }, []);

  useEffect(() => {
    if (selected) {
      setPrompt(selectedOverride?.prompt ?? defaultKatchimeraTilePrompt(selected));
    }
  }, [selected, selectedOverride?.prompt]);

  function persistManifest(next: KatchimeraHexTileOverrideManifest) {
    setManifest(next);
    saveKatchimeraHexTileOverrides(next);
  }

  async function handleGenerate() {
    if (!selected || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const iteration = await generateKatchimeraHexTile({ candidate: selected, baseTile, prompt, mode, model });
      const key = historyKey(selected);
      const next: KatchimeraHexTileOverrideManifest = {
        byCreatureId: { ...manifest.byCreatureId },
        byVisualKey: { ...manifest.byVisualKey },
        selectedVariantByVisualKey: { ...(manifest.selectedVariantByVisualKey ?? {}) },
        history: {
          ...(manifest.history ?? {}),
          [key]: [iteration, ...((manifest.history ?? {})[key] ?? [])].slice(0, 8),
        },
      };
      persistManifest(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleKeepCell(iteration: AssetLabIteration, cellUrl: string) {
    if (!selected || keepingCellUrl) return;
    setKeepingCellUrl(cellUrl);
    setError(null);
    try {
      const kept = await keepKatchimeraHexTileCell({ candidate: selected, cellUrl, matte });
      const override = {
        uri: kept.uri,
        alphaBounds: kept.alphaBounds,
        prompt: iteration.prompt,
        updatedAt: new Date().toISOString(),
      };
      const next = setKatchimeraHexTileOverride(
        { creatureId: selected.creatureId, visualKey: selected.visualKey },
        override
      );
      const key = historyKey(selected);
      next.history = {
        ...(manifest.history ?? {}),
        [key]: selectedHistory.map((item) =>
          item.id === iteration.id
            ? {
                ...item,
                cells: item.cells.map((cell) => (cell.url === cellUrl ? { ...cell, keptUri: kept.uri } : cell)),
              }
            : item
        ),
      };
      persistManifest(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not keep that tile.';
      setError(message);
    } finally {
      setKeepingCellUrl(null);
    }
  }

  function handleClearOverride() {
    if (!selected) return;
    const next = setKatchimeraHexTileOverride({ creatureId: selected.creatureId, visualKey: selected.visualKey }, null);
    persistManifest(next);
  }

  function handleUseBundledVariant(variantId: string) {
    if (!selected) return;
    const next = setKatchimeraHexTileVariantSelection(selected.visualKey, variantId);
    persistManifest(next);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Katchimera Tile Lab', headerShown: false }} />
      <AmbientBackground colors={['#0B0D14', '#12172A', '#171D2D']} showOrbs={false} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the Katchimera Tile Lab"
        hitSlop={10}
        onPress={() => router.back()}
        style={[styles.exitButton, { top: insets.top + 10 }]}>
        <IconSymbol name="xmark" size={15} color="#E8EEFF" />
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 44, paddingTop: insets.top + 18 }]}>
        <ThemedText type="title" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          Katchimera Tile Lab
        </ThemedText>
        <ThemedText style={styles.subtitle} lightColor="#AAB4D4" darkColor="#AAB4D4">
          Generate one custom resident hex tile per katchimera. The World map uses a creature-specific override first, then the visual-key fallback.
        </ThemedText>

        {residentCandidates.length > 0 ? (
          <CandidateSection
            title="Current kingdom residents"
            candidates={residentCandidates}
            manifest={manifest}
            selectedKey={selected ? historyKey(selected) : null}
            onSelect={(candidate) => setSelectedKey(historyKey(candidate))}
          />
        ) : null}

        <CandidateSection
          title="Cast templates"
          candidates={castCandidates}
          manifest={manifest}
          selectedKey={selected ? historyKey(selected) : null}
          onSelect={(candidate) => setSelectedKey(historyKey(candidate))}
        />

        {selected ? (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={styles.creatureHalo}>
                <Image contentFit="contain" source={selected.source} style={styles.creatureHero} transition={0} />
              </View>
              <View style={styles.detailText}>
                <ThemedText style={styles.detailTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  {selected.name}
                </ThemedText>
                <ThemedText style={styles.detailMeta} lightColor="#AAB4D4" darkColor="#AAB4D4">
                  {selected.themeLabel} · {selected.creatureId ? 'specific resident' : 'visual fallback'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.previewRow}>
              <TilePreview label="Base reference" source={baseTile.tile.source} />
              <TilePreview label={selectedOverride ? 'Current override' : 'No override'} source={selectedOverride ? sourceFromOverride(selectedOverride.uri) : baseTile.tile.source} dim={!selectedOverride} />
            </View>

            {selectedCatalog ? (
              <View style={styles.catalogSkins}>
                <ThemedText style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                  Bundled skins
                </ThemedText>
                <View style={styles.skinGrid}>
                  {selectedCatalog.variants.map((variant) => {
                    const active = selectedBundledVariantId === variant.id;
                    return (
                      <View key={variant.id} style={[styles.skinCard, active ? styles.skinCardActive : null]}>
                        <Image contentFit="contain" source={variant.source} style={styles.skinImage} transition={0} />
                        <ThemedText style={styles.skinTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                          {variant.label}
                        </ThemedText>
                        <ThemedText style={styles.skinMeta} lightColor="#AAB4D4" darkColor="#AAB4D4" numberOfLines={2}>
                          {variant.description}
                        </ThemedText>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleUseBundledVariant(variant.id)}
                          style={({ pressed }) => [styles.cellButton, active ? styles.skinButtonActive : null, pressed ? styles.pressed : null]}>
                          <ThemedText style={styles.cellButtonText} lightColor="#E8EEFF" darkColor="#E8EEFF">
                            {active ? 'Active skin' : 'Use skin'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <ThemedText style={styles.controlLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
              Base tile reference
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
              {KINGDOM_HEX_BASE_TILE_VARIANTS.map((variant) => (
                <ChoicePill
                  key={variant.id}
                  label={variant.label}
                  active={variant.id === baseTileId}
                  onPress={() => setBaseTileId(variant.id)}
                />
              ))}
            </ScrollView>

            <TextInput
              multiline
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Prompt for this custom tile"
              placeholderTextColor="rgba(232,238,255,0.42)"
              style={styles.promptInput}
              textAlignVertical="top"
            />

            <View style={styles.controlsGrid}>
              <View style={styles.controlGroup}>
                <ThemedText style={styles.controlLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                  Batch
                </ThemedText>
                <View style={styles.optionRow}>
                  {MODE_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={mode === option} onPress={() => setMode(option)} />
                  ))}
                </View>
              </View>
              <View style={styles.controlGroup}>
                <ThemedText style={styles.controlLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                  Model
                </ThemedText>
                <View style={styles.optionRow}>
                  {MODEL_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={model === option} onPress={() => setModel(option)} />
                  ))}
                </View>
              </View>
              <View style={styles.matteRow}>
                <View style={styles.matteText}>
                  <ThemedText style={styles.controlLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                    Matte with BiRefNet
                  </ThemedText>
                  <ThemedText style={styles.matteBody} lightColor="#AAB4D4" darkColor="#AAB4D4">
                    Keep black-background renders as transparent tile art before using them in world view.
                  </ThemedText>
                </View>
                <Switch value={matte} onValueChange={setMatte} />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                disabled={generating}
                onPress={handleGenerate}
                style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, generating ? styles.disabled : null]}>
                {generating ? <ActivityIndicator color="#101521" /> : null}
                <ThemedText style={styles.primaryButtonText} lightColor="#101521" darkColor="#101521">
                  {generating ? 'Generating...' : 'Generate custom tile'}
                </ThemedText>
              </Pressable>
              {selectedOverride ? (
                <Pressable accessibilityRole="button" onPress={handleClearOverride} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}>
                  <ThemedText style={styles.secondaryButtonText} lightColor="#FFD9B8" darkColor="#FFD9B8">
                    Clear override
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {error ? (
              <ThemedText style={styles.errorText} lightColor="#FFB8A8" darkColor="#FFB8A8">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.historySection}>
              <ThemedText style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                Generated tiles
              </ThemedText>
              {selectedHistory.length === 0 ? (
                <ThemedText style={styles.emptyText} lightColor="#AAB4D4" darkColor="#AAB4D4">
                  No generated tiles for this katchimera yet.
                </ThemedText>
              ) : (
                selectedHistory.map((iteration) => (
                  <View key={iteration.id} style={styles.iterationBlock}>
                    <ThemedText style={styles.iterationMeta} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {new Date(iteration.createdAt).toLocaleString()} · {iteration.mode} · {iteration.model}
                    </ThemedText>
                    <View style={styles.cellGrid}>
                      {iteration.cells.map((cell) => (
                        <View key={`${iteration.id}-${cell.index}`} style={styles.cellCard}>
                          <Image contentFit="contain" source={{ uri: cell.keptUri ?? cell.url }} style={styles.cellImage} transition={0} />
                          <Pressable
                            accessibilityRole="button"
                            disabled={keepingCellUrl === cell.url}
                            onPress={() => handleKeepCell(iteration, cell.url)}
                            style={({ pressed }) => [styles.cellButton, pressed ? styles.pressed : null, keepingCellUrl === cell.url ? styles.disabled : null]}>
                            <ThemedText style={styles.cellButtonText} lightColor="#E8EEFF" darkColor="#E8EEFF">
                              {keepingCellUrl === cell.url ? 'Keeping...' : cell.keptUri ? 'Use again' : 'Use tile'}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <ThemedText style={styles.emptyText} lightColor="#AAB4D4" darkColor="#AAB4D4">
            No katchimera candidates found.
          </ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

function CandidateSection({
  title,
  candidates,
  manifest,
  selectedKey,
  onSelect,
}: {
  title: string;
  candidates: KatchimeraTileCandidate[];
  manifest: KatchimeraHexTileOverrideManifest;
  selectedKey: string | null;
  onSelect: (candidate: KatchimeraTileCandidate) => void;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {title}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidateRail}>
        {candidates.map((candidate) => {
          const key = historyKey(candidate);
          const active = selectedKey === key;
          const override = candidateOverride(manifest, candidate);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => onSelect(candidate)}
              style={({ pressed }) => [styles.candidateCard, active ? styles.candidateCardActive : null, pressed ? styles.pressed : null]}>
              <View style={styles.candidateImageWrap}>
                <Image contentFit="contain" source={candidate.source} style={styles.candidateImage} transition={0} />
              </View>
              <ThemedText style={styles.candidateName} lightColor="#F8FBFF" darkColor="#F8FBFF" numberOfLines={1}>
                {candidate.name}
              </ThemedText>
              <ThemedText style={styles.candidateMeta} lightColor="#AAB4D4" darkColor="#AAB4D4" numberOfLines={1}>
                {override ? 'custom tile set' : candidate.themeLabel}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TilePreview({ label, source, dim = false }: { label: string; source: ImageSourcePropType; dim?: boolean }) {
  return (
    <View style={styles.tilePreview}>
      <Image contentFit="contain" source={source} style={[styles.tilePreviewImage, dim ? styles.dimPreview : null]} transition={0} />
      <ThemedText style={styles.tilePreviewLabel} lightColor="#AAB4D4" darkColor="#AAB4D4">
        {label}
      </ThemedText>
    </View>
  );
}

function ChoicePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choicePill, active ? styles.choicePillActive : null, pressed ? styles.pressed : null]}>
      <ThemedText style={styles.choiceText} lightColor={active ? '#101521' : '#E8EEFF'} darkColor={active ? '#101521' : '#E8EEFF'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  exitButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 36,
    zIndex: 20,
  },
  content: {
    gap: 18,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    paddingRight: 44,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -10,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  candidateRail: {
    gap: 10,
    paddingRight: 18,
  },
  candidateCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    padding: 10,
    width: 122,
  },
  candidateCardActive: {
    borderColor: '#FFC36B',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  candidateImageWrap: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    justifyContent: 'center',
    width: '100%',
  },
  candidateImage: {
    height: '86%',
    width: '86%',
  },
  candidateName: {
    fontSize: 13,
    fontWeight: '800',
  },
  candidateMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  detailPanel: {
    backgroundColor: 'rgba(10,14,24,0.84)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 14,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  creatureHalo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  creatureHero: {
    height: 64,
    width: 64,
  },
  detailText: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  detailMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tilePreview: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 8,
  },
  tilePreviewImage: {
    aspectRatio: 1,
    width: '100%',
  },
  dimPreview: {
    opacity: 0.34,
  },
  tilePreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  promptInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#F8FBFF',
    fontSize: 13,
    lineHeight: 19,
    minHeight: 150,
    padding: 12,
  },
  controlsGrid: {
    gap: 13,
  },
  controlGroup: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choicePillActive: {
    backgroundColor: '#FFC36B',
    borderColor: '#FFC36B',
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '800',
  },
  matteRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  matteText: {
    flex: 1,
    gap: 3,
  },
  matteBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFC36B',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  historySection: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  iterationBlock: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    gap: 9,
    paddingTop: 12,
  },
  iterationMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  cellGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catalogSkins: {
    gap: 10,
  },
  skinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skinCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    padding: 8,
    width: '47%',
  },
  skinCardActive: {
    borderColor: '#FFC36B',
    backgroundColor: 'rgba(255,195,107,0.12)',
  },
  skinImage: {
    aspectRatio: 1,
    width: '100%',
  },
  skinTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  skinMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  skinButtonActive: {
    backgroundColor: 'rgba(255,195,107,0.22)',
  },
  cellCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 8,
    width: '47%',
  },
  cellImage: {
    aspectRatio: 1,
    width: '100%',
  },
  cellButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 9,
  },
  cellButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.62,
  },
});
