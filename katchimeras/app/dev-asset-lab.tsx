import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { safeGoBack } from '@/utils/safe-navigation';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  catalogBySection,
  earnRulesForAssetKey,
  familyMembers,
  type WorldAssetEntry,
} from '@/constants/world-asset-catalog';
import {
  approveKeptCell,
  generateAssetVariants,
  keepCell,
  loadAssetLabManifest,
  referenceForSource,
  saveAssetLabManifest,
  type AssetLabManifest,
  type AssetLabMode,
  type AssetLabModel,
} from '@/utils/asset-lab';
import {
  getDevKingdomBaseId,
  getDevKingdomHexArtDirectionSetId,
  getDevKingdomHexBaseTileId,
  getDevKingdomHexCenterTileId,
  getDevKingdomHexVerticalAlignmentMode,
  setDevKingdomBaseId,
  setDevKingdomHexArtDirectionSetId,
  setDevKingdomHexBaseTileId,
  setDevKingdomHexCenterTileId,
  setDevKingdomHexVerticalAlignmentMode,
} from '@/utils/dev-asset-overrides';
import type { KingdomHexVerticalAlignmentMode } from '@/utils/kingdom-tile-alignment';
import {
  KINGDOM_HEX_ART_DIRECTION_SETS,
  KINGDOM_HEX_BASE_TILE_VARIANTS,
  KINGDOM_HEX_CENTER_TILE_VARIANTS,
  worldAssetSource,
  worldBaseSource,
} from '@/utils/world-visuals';

// DEV TOOL — the World Asset Lab (v1: browse + audit). Every bundled world
// asset by section, with its display name and UNLOCK PROVENANCE (what life
// event earns it), plus variant families. Slice 2 adds the generate/edit loop
// (prompt → edge fn → preview → promote-to-bundle via the optimizer script).

function entrySource(entry: WorldAssetEntry) {
  return entry.section === 'base' ? worldBaseSource(entry.key) : worldAssetSource(entry.key);
}

// Iso camera guide for "Iso align": ground grid at the canonical 0.8 slope +
// footprint diamond + wireframe cage (same guide scripts/iso-align-prop.py uses).
const ISO_PROP_GUIDE = require('../assets/images/katchimeras/world/design/iso-prop-guide.png');

function isoAlignPrompt(subject: string): string {
  return (
    `The first image is a ${subject} from our game. The second image is an ISOMETRIC CAMERA GUIDE: ` +
    'a ground grid, a bright diamond marking the footprint, and a wireframe cage showing the projection. ' +
    `Redraw the SAME ${subject} — same design, colors, materials, style, details — but re-projected to EXACTLY match ` +
    'the guide camera: the base/footprint sits exactly on the bright diamond and fills it, ' +
    'the walls and base edges run PARALLEL to the grid directions (the two diagonal grid axes), ' +
    'all vertical edges stay perfectly vertical, and the overall view direction matches the wireframe cage. ' +
    'Premium 3D mascot toy CG rendering, soft studio lighting. ' +
    'Pure solid black background. Do not draw any of the guide lines, grid, diamond or cage in the output.'
  );
}

const FAMILY_KIND_LABEL: Record<string, string> = {
  random: 'random variants — one is picked at plant time',
  level: 'level set — grows with progress',
  state: 'state set — picked by a live state',
};

const HEX_VERTICAL_ALIGNMENT_OPTIONS: {
  description: string;
  id: KingdomHexVerticalAlignmentMode;
  label: string;
}[] = [
  {
    id: 'ground-bottom',
    label: 'Ground bottom',
    description: 'Default: align each tile bottom to the selected resident/base tile.',
  },
  {
    id: 'silhouette-center',
    label: 'Silhouette centre',
    description: 'Legacy comparison: centre each tile using its complete visible artwork.',
  },
];

export default function DevAssetLabScreen() {
  const insets = useSafeAreaInsets();
  const sections = useMemo(() => catalogBySection(), []);
  const [selected, setSelected] = useState<WorldAssetEntry | null>(null);
  const totalCount = useMemo(() => sections.reduce((sum, group) => sum + group.entries.length, 0), [sections]);
  // The iteration manifest — loading it also applies any saved live overrides.
  const [manifest, setManifest] = useState<AssetLabManifest>({ overrides: {}, history: {} });
  useEffect(() => {
    void loadAssetLabManifest().then(setManifest);
  }, []);
  const updateManifest = (next: AssetLabManifest) => {
    setManifest(next);
    saveAssetLabManifest(next);
  };
  // Full-screen pinch/pan viewer — opened from the detail hero or any cell.
  const [viewerSource, setViewerSource] = useState<ImageSourcePropType | null>(null);
  // Which base the CENTRE island renders (dev override; null = base_env3).
  const [kingdomBase, setKingdomBase] = useState<string | null>(() => getDevKingdomBaseId());
  const applyKingdomBase = (baseId: string | null) => {
    setDevKingdomBaseId(baseId);
    setKingdomBase(baseId);
  };
  const [hexCenterTileId, setHexCenterTileId] = useState(
    () => getDevKingdomHexCenterTileId() ?? KINGDOM_HEX_CENTER_TILE_VARIANTS[0].id
  );
  const [hexBaseTileId, setHexBaseTileId] = useState(() => getDevKingdomHexBaseTileId() ?? KINGDOM_HEX_BASE_TILE_VARIANTS[0].id);
  const [hexArtDirectionSetId, setHexArtDirectionSetId] = useState(() => getDevKingdomHexArtDirectionSetId());
  const [hexVerticalAlignmentMode, setHexVerticalAlignmentMode] = useState(() =>
    getDevKingdomHexVerticalAlignmentMode()
  );
  const applyHexCenterTile = (tileId: string) => {
    setDevKingdomHexArtDirectionSetId(null);
    setHexArtDirectionSetId(null);
    setDevKingdomHexCenterTileId(tileId === KINGDOM_HEX_CENTER_TILE_VARIANTS[0].id ? null : tileId);
    setHexCenterTileId(tileId);
  };
  const applyHexBaseTile = (tileId: string) => {
    setDevKingdomHexArtDirectionSetId(null);
    setHexArtDirectionSetId(null);
    setDevKingdomHexBaseTileId(tileId === KINGDOM_HEX_BASE_TILE_VARIANTS[0].id ? null : tileId);
    setHexBaseTileId(tileId);
  };
  const applyHexArtDirectionSet = (setId: string) => {
    const next = hexArtDirectionSetId === setId ? null : setId;
    setDevKingdomHexArtDirectionSetId(next);
    setHexArtDirectionSetId(next);
  };
  const applyHexVerticalAlignment = (mode: KingdomHexVerticalAlignmentMode) => {
    setDevKingdomHexVerticalAlignmentMode(mode);
    setHexVerticalAlignmentMode(mode);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'World Asset Lab', headerShown: false }} />
      <AmbientBackground colors={['#0B0D14', '#12172A', '#181D33']} showOrbs={false} />

      {/* Exit — the lab is a full-screen dev route with no header. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the Asset Lab"
        hitSlop={10}
        onPress={() => safeGoBack(router)}
        style={[styles.exitButton, { top: insets.top + 10 }]}>
        <IconSymbol name="xmark" size={15} color="#E8EEFF" />
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, paddingTop: insets.top + 16 }]}>
        <ThemedText type="title" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          World Asset Lab
        </ThemedText>
        <ThemedText style={styles.subtitle} lightColor="#AAB4D4" darkColor="#AAB4D4">
          {totalCount} live assets · tap any tile for provenance, variants and the generate/edit loop.
        </ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
            Hex tiles
            <ThemedText style={styles.sectionCount} lightColor="#8C96B8" darkColor="#8C96B8">
              {'  '}{KINGDOM_HEX_ART_DIRECTION_SETS.length + KINGDOM_HEX_CENTER_TILE_VARIANTS.length + KINGDOM_HEX_BASE_TILE_VARIANTS.length}
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.sectionBlurb} lightColor="#8C96B8" darkColor="#8C96B8">
            Apply a coherent art-direction set, or compare legacy center and resident tiles independently.
          </ThemedText>
          <ThemedText style={styles.hexGroupTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
            Art-direction sets
          </ThemedText>
          <View style={styles.hexSetGrid}>
            {KINGDOM_HEX_ART_DIRECTION_SETS.map((set) => {
              const active = hexArtDirectionSetId === set.id;
              return (
                <Pressable
                  key={set.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => applyHexArtDirectionSet(set.id)}
                  style={({ pressed }) => [styles.hexSetCard, active ? styles.hexSetCardActive : null, pressed ? styles.tilePressed : null]}>
                  <View style={styles.hexPreviewRow}>
                    <View style={styles.hexPreview}>
                      <Image source={set.selection.default.source} style={styles.hexPreviewArt} contentFit="contain" transition={0} />
                      <ThemedText style={styles.hexPreviewLabel} lightColor="#8C96B8" darkColor="#8C96B8">
                        empty
                      </ThemedText>
                    </View>
                    <View style={styles.hexPreview}>
                      <Image source={set.selection.center.source} style={styles.hexPreviewArt} contentFit="contain" transition={0} />
                      <ThemedText style={styles.hexPreviewLabel} lightColor="#8C96B8" darkColor="#8C96B8">
                        home
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.hexSetText}>
                    <ThemedText style={styles.hexSetTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {set.label}
                    </ThemedText>
                    <ThemedText style={styles.hexSetDesc} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {set.description}
                    </ThemedText>
                    <ThemedText style={styles.hexSetAction} lightColor={active ? '#A8E2C6' : '#FFC36B'} darkColor={active ? '#A8E2C6' : '#FFC36B'}>
                      {active ? 'Live in Kingdom · tap to reset' : 'Use complete set'}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={styles.hexGroupTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
            Center tile
          </ThemedText>
          <View style={styles.hexSetGrid}>
            {KINGDOM_HEX_CENTER_TILE_VARIANTS.map((variant) => {
              const active = hexCenterTileId === variant.id;
              return (
                <Pressable
                  key={variant.id}
                  accessibilityRole="button"
                  onPress={() => applyHexCenterTile(variant.id)}
                  style={({ pressed }) => [styles.hexSetCard, active ? styles.hexSetCardActive : null, pressed ? styles.tilePressed : null]}>
                  <View style={styles.hexPreviewRow}>
                    <View style={styles.hexPreview}>
                      <Image source={variant.tile.source} style={styles.hexPreviewArt} contentFit="contain" transition={0} />
                      <ThemedText style={styles.hexPreviewLabel} lightColor="#8C96B8" darkColor="#8C96B8">
                        center
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.hexSetText}>
                    <ThemedText style={styles.hexSetTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {variant.label}
                    </ThemedText>
                    <ThemedText style={styles.hexSetDesc} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {variant.description}
                    </ThemedText>
                    <ThemedText style={styles.hexSetAction} lightColor={active ? '#A8E2C6' : '#FFC36B'} darkColor={active ? '#A8E2C6' : '#FFC36B'}>
                      {active ? 'Used for center tile' : 'Use for center tile'}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={styles.hexGroupTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
            Resident/base tiles
          </ThemedText>
          <View style={styles.hexSetGrid}>
            {KINGDOM_HEX_BASE_TILE_VARIANTS.map((variant) => {
              const active = hexBaseTileId === variant.id;
              return (
                <Pressable
                  key={variant.id}
                  accessibilityRole="button"
                  onPress={() => applyHexBaseTile(variant.id)}
                  style={({ pressed }) => [styles.hexSetCard, active ? styles.hexSetCardActive : null, pressed ? styles.tilePressed : null]}>
                  <View style={styles.hexPreviewRow}>
                    <View style={styles.hexPreview}>
                      <Image source={variant.tile.source} style={styles.hexPreviewArt} contentFit="contain" transition={0} />
                      <ThemedText style={styles.hexPreviewLabel} lightColor="#8C96B8" darkColor="#8C96B8">
                        base
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.hexSetText}>
                    <ThemedText style={styles.hexSetTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {variant.label}
                    </ThemedText>
                    <ThemedText style={styles.hexSetDesc} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {variant.description}
                    </ThemedText>
                    <ThemedText style={styles.hexSetAction} lightColor={active ? '#A8E2C6' : '#FFC36B'} darkColor={active ? '#A8E2C6' : '#FFC36B'}>
                      {active ? 'Used for resident tiles' : 'Use for resident tiles'}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={styles.hexGroupTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
            Vertical alignment
          </ThemedText>
          <View style={styles.hexSetGrid}>
            {HEX_VERTICAL_ALIGNMENT_OPTIONS.map((option) => {
              const active = hexVerticalAlignmentMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => applyHexVerticalAlignment(option.id)}
                  style={({ pressed }) => [
                    styles.hexSetCard,
                    active ? styles.hexSetCardActive : null,
                    pressed ? styles.tilePressed : null,
                  ]}>
                  <View style={styles.alignmentIcon}>
                    <IconSymbol
                      name={active ? 'checkmark.circle.fill' : 'circle'}
                      size={22}
                      color={active ? '#A8E2C6' : '#8C96B8'}
                    />
                  </View>
                  <View style={styles.hexSetText}>
                    <ThemedText style={styles.hexSetTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                      {option.label}
                    </ThemedText>
                    <ThemedText style={styles.hexSetDesc} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {option.description}
                    </ThemedText>
                    <ThemedText
                      style={styles.hexSetAction}
                      lightColor={active ? '#A8E2C6' : '#FFC36B'}
                      darkColor={active ? '#A8E2C6' : '#FFC36B'}>
                      {active ? 'Current alignment' : 'Try this alignment'}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {sections.map(({ section, entries }) =>
          entries.length === 0 ? null : (
            <View key={section.id} style={styles.section}>
              <ThemedText style={styles.sectionTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {section.title}
                <ThemedText style={styles.sectionCount} lightColor="#8C96B8" darkColor="#8C96B8">
                  {'  '}{entries.length}
                </ThemedText>
              </ThemedText>
              <ThemedText style={styles.sectionBlurb} lightColor="#8C96B8" darkColor="#8C96B8">
                {section.blurb}
              </ThemedText>
              <View style={styles.grid}>
                {entries.map((entry) => {
                  const source = entrySource(entry);
                  return (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="button"
                      onPress={() => setSelected(entry)}
                      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                      {source ? (
                        <Image source={source} style={styles.tileArt} contentFit="contain" transition={0} />
                      ) : (
                        <View style={styles.tileMissing}>
                          <IconSymbol name="questionmark" size={18} color="#F0A9A9" />
                        </View>
                      )}
                      <ThemedText numberOfLines={2} style={styles.tileName} lightColor="#E8EEFF" darkColor="#E8EEFF">
                        {entry.name}
                      </ThemedText>
                      {entry.variantFamily ? (
                        <View style={styles.familyDot}>
                          <ThemedText style={styles.familyDotLabel} lightColor="#0B0D14" darkColor="#0B0D14">
                            {familyMembers(entry).length}
                          </ThemedText>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )
        )}
      </ScrollView>

      {selected ? (
        <View style={styles.detailOverlay}>
          <Pressable onPress={() => setSelected(null)} style={StyleSheet.absoluteFill} />
          <View style={[styles.detailCard, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setSelected(null)} style={styles.detailClose}>
              <IconSymbol name="xmark" size={13} color="#E8EEFF" />
            </Pressable>
            {(() => {
              const source = entrySource(selected);
              const members = familyMembers(selected);
              const earnRules = earnRulesForAssetKey(selected.key);
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
                  <View style={styles.detailHero}>
                    {source ? (
                      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Expand" onPress={() => setViewerSource(source)}>
                        <Image source={source} style={styles.detailArt} contentFit="contain" transition={0} />
                        <View style={styles.expandBadge} pointerEvents="none">
                          <IconSymbol name="arrow.up.left.and.arrow.down.right" size={12} color="#E8EEFF" />
                        </View>
                      </Pressable>
                    ) : (
                      <View style={[styles.tileMissing, styles.detailArt]}>
                        <IconSymbol name="questionmark" size={28} color="#F0A9A9" />
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.detailName} lightColor="#F8FBFF" darkColor="#F8FBFF">
                    {selected.name}
                  </ThemedText>
                  <ThemedText style={styles.detailKey} lightColor="#8C96B8" darkColor="#8C96B8">
                    {selected.key}
                  </ThemedText>
                  <View style={styles.detailRow}>
                    <IconSymbol name="sparkles" size={13} color="#FFC36B" />
                    <ThemedText style={styles.detailUnlock} lightColor="#FFE7C2" darkColor="#FFE7C2">
                      {selected.unlock}
                    </ThemedText>
                  </View>
                  {selected.note ? (
                    <ThemedText style={styles.detailNote} lightColor="#AAB4D4" darkColor="#AAB4D4">
                      {selected.note}
                    </ThemedText>
                  ) : null}

                  {/* The SPECIFIC earn rules — rendered live from the registry
                      specs, so the lab states exactly what the evaluator checks. */}
                  {earnRules.length > 0 ? (
                    <View style={styles.rulesSection}>
                      <ThemedText style={styles.rulesTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
                        How it’s earned
                      </ThemedText>
                      {earnRules.map((rule, index) => (
                        <View key={`${rule.lane}-${index}`} style={styles.ruleCard}>
                          <View style={styles.ruleBadges}>
                            <View style={styles.ruleBadge}>
                              <ThemedText style={styles.ruleBadgeLabel} lightColor="#92D7FF" darkColor="#92D7FF">
                                {rule.lane}
                              </ThemedText>
                            </View>
                            {rule.rarity ? (
                              <View style={styles.ruleBadge}>
                                <ThemedText style={styles.ruleBadgeLabel} lightColor="#FFC36B" darkColor="#FFC36B">
                                  {rule.rarity}
                                </ThemedText>
                              </View>
                            ) : null}
                            {rule.repeat ? (
                              <View style={styles.ruleBadge}>
                                <ThemedText style={styles.ruleBadgeLabel} lightColor="#A8E2C6" darkColor="#A8E2C6">
                                  {rule.repeat}
                                </ThemedText>
                              </View>
                            ) : null}
                          </View>
                          <ThemedText style={styles.ruleText} lightColor="#F8FBFF" darkColor="#F8FBFF">
                            {rule.rule}
                          </ThemedText>
                          {rule.hint ? (
                            <ThemedText style={styles.ruleHint} lightColor="#8C96B8" darkColor="#8C96B8">
                              “{rule.hint}”
                            </ThemedText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {selected.section === 'base' && !selected.key.startsWith('plot_') ? (
                    (() => {
                      // No override = the Skia ground renders base_garden_main.
                      const isDefault = selected.key === 'base_garden_main';
                      const isActive = isDefault ? kingdomBase === null : kingdomBase === selected.key;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => applyKingdomBase(isDefault ? null : isActive ? null : selected.key)}
                          style={[styles.baseButton, isActive ? styles.baseButtonActive : null]}>
                          <ThemedText
                            style={styles.baseButtonLabel}
                            lightColor={isActive ? '#A8E2C6' : '#E8EEFF'}
                            darkColor={isActive ? '#A8E2C6' : '#E8EEFF'}>
                            {isActive
                              ? `Kingdom renders this base ✓${isDefault ? ' (default)' : ' — tap to reset'}`
                              : 'Use as Kingdom base (dev, live)'}
                          </ThemedText>
                        </Pressable>
                      );
                    })()
                  ) : null}

                  {members.length > 1 ? (
                    <View style={styles.familySection}>
                      <ThemedText style={styles.familyTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
                        Family · {selected.variantFamily}
                      </ThemedText>
                      <ThemedText style={styles.familyKind} lightColor="#8C96B8" darkColor="#8C96B8">
                        {FAMILY_KIND_LABEL[selected.familyKind ?? 'random']}
                      </ThemedText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyRow}>
                        {members.map((member) => {
                          const memberSource = entrySource(member);
                          const active = member.key === selected.key;
                          return (
                            <Pressable
                              key={member.key}
                              accessibilityRole="button"
                              onPress={() => setSelected(member)}
                              style={[styles.familyTile, active ? styles.familyTileActive : null]}>
                              {memberSource ? (
                                <Image source={memberSource} style={styles.familyArt} contentFit="contain" transition={0} />
                              ) : (
                                <IconSymbol name="questionmark" size={16} color="#F0A9A9" />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  <GenerationPanel
                    entry={selected}
                    manifest={manifest}
                    onChange={updateManifest}
                    onExpand={(expandSource) => setViewerSource(expandSource)}
                  />
                </ScrollView>
              );
            })()}
          </View>
        </View>
      ) : null}

      {viewerSource ? <ZoomViewer source={viewerSource} onClose={() => setViewerSource(null)} /> : null}
    </View>
  );
}

// Full-screen asset explorer: pinch to zoom (1–10×), one-finger pan, double-tap
// to jump between fit and 4× (then reset), ✕ to close. Built for reading the
// 2K base tiles up close.
function ZoomViewer({ source, onClose }: { source: ImageSourcePropType; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.max(1, Math.min(10, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      tx.value = savedTx.value + event.translationX;
      ty.value = savedTy.value + event.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.value < 2;
      scale.value = withTiming(zoomIn ? 4 : 1, { duration: 220 });
      savedScale.value = zoomIn ? 4 : 1;
      if (!zoomIn) {
        tx.value = withTiming(0, { duration: 220 });
        ty.value = withTiming(0, { duration: 220 });
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.viewerOverlay}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.viewerStage}>
          <Animated.View style={imageStyle}>
            <Image source={source} style={{ height: height * 0.9, width }} contentFit="contain" transition={0} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the viewer"
        hitSlop={10}
        onPress={onClose}
        style={[styles.exitButton, { top: insets.top + 10 }]}>
        <IconSymbol name="xmark" size={15} color="#E8EEFF" />
      </Pressable>
      <View pointerEvents="none" style={[styles.viewerHint, { bottom: insets.bottom + 16 }]}>
        <ThemedText style={styles.viewerHintLabel} lightColor="#8C96B8" darkColor="#8C96B8">
          pinch to zoom · drag to pan · double-tap to toggle
        </ThemedText>
      </View>
    </View>
  );
}

// The generate/edit loop: prompt → edge fn (img2img on the CURRENT art) →
// review cells → Keep (downloads, optional BiRefNet matte) → Use in app
// (live dev override the Kingdom renders). Bundling still goes through the
// desktop optimizer (slice 3).
function GenerationPanel({
  entry,
  manifest,
  onChange,
  onExpand,
}: {
  entry: WorldAssetEntry;
  manifest: AssetLabManifest;
  onChange: (next: AssetLabManifest) => void;
  onExpand: (source: ImageSourcePropType) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<AssetLabMode>('2x2');
  const [model, setModel] = useState<AssetLabModel>('nano');
  const [matteOnKeep, setMatteOnKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [keepingUrl, setKeepingUrl] = useState<string | null>(null);
  const [approvingUri, setApprovingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIterationId, setOpenIterationId] = useState<string | null>(null);

  const history = manifest.history[entry.key] ?? [];
  const overrideUri = manifest.overrides[entry.key] ?? null;

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    const source = entrySource(entry);
    if (!source) {
      setError('No bundled art to use as the img2img reference.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reference = await referenceForSource(source);
      const iteration = await generateAssetVariants({ assetKey: entry.key, prompt: trimmed, mode, model, reference });
      onChange({
        ...manifest,
        history: { ...manifest.history, [entry.key]: [iteration, ...history] },
      });
      setOpenIterationId(iteration.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Generation failed.');
    }
    setBusy(false);
  };

  // One-tap iso alignment: regenerate THIS asset against the shared iso camera
  // guide (gpt, single) — the result drops into the normal iteration history,
  // so Keep / matte / Use-in-app / Approve all work on it unchanged.
  const handleIsoAlign = async () => {
    if (busy) return;
    const source = entrySource(entry);
    if (!source) {
      setError('No bundled art to iso-align.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reference = await referenceForSource(source);
      const guide = await referenceForSource(ISO_PROP_GUIDE);
      const iteration = await generateAssetVariants({
        assetKey: entry.key,
        prompt: isoAlignPrompt(entry.name),
        mode: 'single',
        model: 'gpt',
        reference,
        guide,
      });
      onChange({
        ...manifest,
        history: { ...manifest.history, [entry.key]: [iteration, ...history] },
      });
      setOpenIterationId(iteration.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Iso align failed.');
    }
    setBusy(false);
  };

  const handleKeep = async (iterationId: string, cellUrl: string) => {
    if (keepingUrl) return;
    setKeepingUrl(cellUrl);
    setError(null);
    try {
      const keptUri = await keepCell({ assetKey: entry.key, cellUrl, matte: matteOnKeep });
      onChange({
        ...manifest,
        history: {
          ...manifest.history,
          [entry.key]: history.map((iteration) =>
            iteration.id !== iterationId
              ? iteration
              : { ...iteration, cells: iteration.cells.map((cell) => (cell.url === cellUrl ? { ...cell, keptUri } : cell)) }
          ),
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Keep failed.');
    }
    setKeepingUrl(null);
  };

  const setOverride = (uri: string | null) => {
    const overrides = { ...manifest.overrides };
    if (uri) overrides[entry.key] = uri;
    else delete overrides[entry.key];
    onChange({ ...manifest, overrides });
  };

  // Upload a kept cell to the promotion drop-box; the desktop optimizer
  // (scripts/promote-dev-assets.py) turns approved drafts into bundled WebP.
  const handleApprove = async (iterationId: string, keptUri: string) => {
    if (approvingUri) return;
    setApprovingUri(keptUri);
    setError(null);
    try {
      await approveKeptCell({ assetKey: entry.key, keptUri });
      onChange({
        ...manifest,
        history: {
          ...manifest.history,
          [entry.key]: history.map((iteration) =>
            iteration.id !== iterationId
              ? iteration
              : {
                  ...iteration,
                  cells: iteration.cells.map((cell) => (cell.keptUri === keptUri ? { ...cell, approved: true } : cell)),
                }
          ),
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approve failed.');
    }
    setApprovingUri(null);
  };

  return (
    <View style={styles.genPanel}>
      <ThemedText style={styles.genTitle} lightColor="#E8EEFF" darkColor="#E8EEFF">
        Generate / edit
      </ThemedText>

      <View style={styles.genToggleRow}>
        {(['single', '2x2', '4x4'] as AssetLabMode[]).map((candidate) => (
          <Pressable
            key={candidate}
            onPress={() => setMode(candidate)}
            style={[styles.genToggle, mode === candidate ? styles.genToggleActive : null]}>
            <ThemedText style={styles.genToggleLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
              {candidate}
            </ThemedText>
          </Pressable>
        ))}
        <View style={styles.genToggleSpacer} />
        {(['nano', 'gpt'] as AssetLabModel[]).map((candidate) => (
          <Pressable
            key={candidate}
            onPress={() => setModel(candidate)}
            style={[styles.genToggle, model === candidate ? styles.genToggleActive : null]}>
            <ThemedText style={styles.genToggleLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
              {candidate}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setMatteOnKeep((current) => !current)}
          style={[styles.genToggle, matteOnKeep ? styles.genToggleActive : null]}>
          <ThemedText style={styles.genToggleLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
            matte
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.genInputRow}>
        <TextInput
          multiline
          onChangeText={setPrompt}
          placeholder="Describe the change / variants (img2img on the current art)…"
          placeholderTextColor="#5F6A8C"
          style={styles.genInput}
          value={prompt}
        />
      </View>
      <Pressable disabled={busy || !prompt.trim()} onPress={handleGenerate} style={[styles.genButton, busy || !prompt.trim() ? styles.genButtonDisabled : null]}>
        {busy ? (
          <ActivityIndicator color="#0B0D14" size="small" />
        ) : (
          <ThemedText style={styles.genButtonLabel} lightColor="#0B0D14" darkColor="#0B0D14">
            Generate
          </ThemedText>
        )}
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={handleIsoAlign}
        style={[
          styles.genButton,
          { backgroundColor: 'rgba(255,195,107,0.16)', borderColor: '#FFC36B', borderWidth: 1, marginTop: 8 },
          busy ? styles.genButtonDisabled : null,
        ]}>
        <ThemedText style={styles.genButtonLabel} lightColor="#FFC36B" darkColor="#FFC36B">
          ⬡ Iso align (gpt, ~2 min)
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText style={styles.genError} lightColor="#F0A9A9" darkColor="#F0A9A9">
          {error}
        </ThemedText>
      ) : null}

      {overrideUri ? (
        <View style={styles.overrideRow}>
          <Image source={{ uri: overrideUri }} style={styles.overrideThumb} contentFit="contain" />
          <ThemedText style={styles.overrideLabel} lightColor="#A8E2C6" darkColor="#A8E2C6">
            Live override active — the Kingdom renders this draft.
          </ThemedText>
          <Pressable onPress={() => setOverride(null)} style={styles.overrideClear}>
            <ThemedText style={styles.genToggleLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
              Clear
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {history.map((iteration) => {
        const open = iteration.id === openIterationId;
        return (
          <View key={iteration.id} style={styles.iteration}>
            <Pressable onPress={() => setOpenIterationId(open ? null : iteration.id)} style={styles.iterationHeader}>
              <ThemedText numberOfLines={open ? undefined : 1} style={styles.iterationPrompt} lightColor="#E8EEFF" darkColor="#E8EEFF">
                {iteration.prompt}
              </ThemedText>
              <ThemedText style={styles.iterationMeta} lightColor="#8C96B8" darkColor="#8C96B8">
                {iteration.mode} · {iteration.model} · {new Date(iteration.createdAt).toLocaleString()}
              </ThemedText>
            </Pressable>
            {open ? (
              <View style={styles.cellGrid}>
                {iteration.cells.map((cell) => (
                  <View key={cell.url} style={styles.cell}>
                    <Pressable
                      accessibilityRole="imagebutton"
                      accessibilityLabel="Expand cell"
                      onPress={() => onExpand({ uri: cell.keptUri ?? cell.url })}
                      style={styles.cellArtPress}>
                      <Image source={{ uri: cell.keptUri ?? cell.url }} style={styles.cellArt} contentFit="contain" />
                    </Pressable>
                    {cell.keptUri ? (
                      <>
                        <Pressable onPress={() => setOverride(cell.keptUri!)} style={styles.cellAction}>
                          <ThemedText style={styles.cellActionLabel} lightColor="#0B0D14" darkColor="#0B0D14">
                            {overrideUri === cell.keptUri ? 'In app ✓' : 'Use in app'}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          disabled={approvingUri !== null || cell.approved}
                          onPress={() => handleApprove(iteration.id, cell.keptUri!)}
                          style={[styles.cellAction, styles.cellActionApprove]}>
                          {approvingUri === cell.keptUri ? (
                            <ActivityIndicator color="#A8E2C6" size="small" />
                          ) : (
                            <ThemedText style={styles.cellActionLabel} lightColor="#A8E2C6" darkColor="#A8E2C6">
                              {cell.approved ? 'Approved ✓' : 'Approve for bundle'}
                            </ThemedText>
                          )}
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        disabled={keepingUrl !== null}
                        onPress={() => handleKeep(iteration.id, cell.url)}
                        style={[styles.cellAction, styles.cellActionKeep]}>
                        {keepingUrl === cell.url ? (
                          <ActivityIndicator color="#E8EEFF" size="small" />
                        ) : (
                          <ThemedText style={styles.cellActionLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                            Keep{matteOnKeep ? ' + matte' : ''}
                          </ThemedText>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B0D14', flex: 1 },
  exitButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(216,228,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 34,
    zIndex: 20,
  },
  content: { gap: 6, paddingHorizontal: 16 },
  title: { fontSize: 30, lineHeight: 34 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionCount: { fontSize: 13, fontWeight: '700' },
  sectionBlurb: { fontSize: 12, lineHeight: 16, marginBottom: 10, marginTop: 2 },
  hexGroupTitle: { fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 8, textTransform: 'uppercase' },
  hexSetGrid: { gap: 10 },
  hexSetCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(216,228,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  hexSetCardActive: { backgroundColor: 'rgba(168,226,198,0.1)', borderColor: 'rgba(168,226,198,0.65)' },
  alignmentIcon: { alignItems: 'center', justifyContent: 'center', width: 62 },
  hexPreviewRow: { flexDirection: 'row', gap: 7 },
  hexPreview: { alignItems: 'center', gap: 3 },
  hexPreviewArt: { height: 62, width: 62 },
  hexPreviewLabel: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  hexSetText: { flex: 1, gap: 3 },
  hexSetTitle: { fontSize: 14, fontWeight: '900' },
  hexSetDesc: { fontSize: 11.5, lineHeight: 15 },
  hexSetAction: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(216,228,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 8,
    width: '23.5%',
  },
  tilePressed: { backgroundColor: 'rgba(216,228,255,0.12)' },
  tileArt: { height: 56, width: 56 },
  tileMissing: {
    alignItems: 'center',
    backgroundColor: 'rgba(240,169,169,0.08)',
    borderColor: 'rgba(240,169,169,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  tileName: { fontSize: 9.5, fontWeight: '600', lineHeight: 12, textAlign: 'center' },
  familyDot: {
    alignItems: 'center',
    backgroundColor: '#FFC36B',
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  familyDotLabel: { fontSize: 9.5, fontWeight: '900', lineHeight: 12 },
  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,7,15,0.6)', justifyContent: 'flex-end' },
  detailCard: {
    backgroundColor: '#12172A',
    borderColor: 'rgba(216,228,255,0.16)',
    borderCurve: 'continuous',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    maxHeight: '78%',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  detailClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 28,
    zIndex: 5,
  },
  detailScroll: { gap: 6, paddingBottom: 8 },
  detailHero: { alignItems: 'center', paddingVertical: 6 },
  detailArt: { height: 180, width: 180 },
  detailName: { fontSize: 21, fontWeight: '800' },
  detailKey: { fontSize: 11.5, letterSpacing: 0.3 },
  detailRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 7, marginTop: 6 },
  detailUnlock: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  detailNote: { fontSize: 12, fontStyle: 'italic', lineHeight: 16, marginTop: 2 },
  rulesSection: { gap: 8, marginTop: 12 },
  rulesTitle: { fontSize: 14, fontWeight: '800' },
  ruleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(216,228,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  ruleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ruleBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  ruleBadgeLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  ruleText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  ruleHint: { fontSize: 11.5, fontStyle: 'italic', lineHeight: 15 },
  familySection: { marginTop: 12 },
  familyTitle: { fontSize: 14, fontWeight: '800' },
  familyKind: { fontSize: 11.5, lineHeight: 15, marginBottom: 8, marginTop: 1 },
  familyRow: { gap: 8 },
  familyTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(216,228,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  familyTileActive: { borderColor: '#FFC36B', borderWidth: 1.5 },
  familyArt: { height: 52, width: 52 },
  genPanel: { gap: 8, marginTop: 16 },
  genTitle: { fontSize: 14, fontWeight: '800' },
  genToggleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  genToggle: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  genToggleActive: { backgroundColor: 'rgba(255,195,107,0.2)', borderColor: '#FFC36B' },
  genToggleLabel: { fontSize: 11.5, fontWeight: '800' },
  genToggleSpacer: { width: 8 },
  genInputRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(216,228,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  genInput: { color: '#E8EEFF', fontSize: 13.5, minHeight: 52, textAlignVertical: 'top' },
  genButton: {
    alignItems: 'center',
    backgroundColor: '#FFC36B',
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingVertical: 11,
  },
  genButtonDisabled: { opacity: 0.4 },
  genButtonLabel: { fontSize: 14, fontWeight: '900' },
  genError: { fontSize: 12, lineHeight: 16 },
  overrideRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(168,226,198,0.08)',
    borderColor: 'rgba(168,226,198,0.35)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 8,
  },
  overrideThumb: { height: 40, width: 40 },
  overrideLabel: { flex: 1, fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  overrideClear: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  iteration: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(216,228,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  iterationHeader: { gap: 2 },
  iterationPrompt: { fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  iterationMeta: { fontSize: 10.5, fontWeight: '600' },
  cellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(216,228,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 6,
    width: '47.5%',
  },
  cellArt: { height: 110, width: '100%' },
  cellAction: {
    alignItems: 'center',
    backgroundColor: '#FFC36B',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 5,
    width: '100%',
  },
  cellActionKeep: { backgroundColor: 'rgba(255,255,255,0.1)' },
  cellActionApprove: {
    backgroundColor: 'rgba(168,226,198,0.1)',
    borderColor: 'rgba(168,226,198,0.4)',
    borderWidth: 1,
  },
  baseButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(216,228,255,0.2)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  baseButtonActive: {
    backgroundColor: 'rgba(168,226,198,0.1)',
    borderColor: 'rgba(168,226,198,0.45)',
  },
  baseButtonLabel: { fontSize: 13, fontWeight: '800' },
  cellActionLabel: { fontSize: 12, fontWeight: '800' },
  cellArtPress: { width: '100%' },
  expandBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(11,13,20,0.7)',
    borderColor: 'rgba(216,228,255,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 4,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 26,
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 6, 12, 0.98)',
    elevation: 40,
    zIndex: 40,
  },
  viewerStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  viewerHint: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  viewerHintLabel: { fontSize: 11.5, fontWeight: '600' },
});
