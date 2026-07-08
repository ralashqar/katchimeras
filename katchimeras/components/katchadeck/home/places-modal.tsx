import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { DayMapNode, HomeLocationType } from '@/types/home';
import { resolvePlaceName } from '@/utils/place-names';

const TYPE_META: Record<HomeLocationType, { label: string; icon: IconSymbolName }> = {
  home: { label: 'Home', icon: 'house.fill' },
  cafe: { label: 'Cafe', icon: 'cup.and.saucer.fill' },
  park: { label: 'Park', icon: 'leaf.fill' },
  unknown: { label: 'Place', icon: 'mappin.and.ellipse' },
};

type ResolvedPlace = {
  id: string;
  primary: string;
  locality: string | null;
  type: HomeLocationType;
  thumbnailUri: string | null;
};

// Turn coordinates into a human place label, on-device — via the shared, persisted
// resolver so a place keeps the same name every time it's shown.
async function resolvePlace(node: DayMapNode): Promise<ResolvedPlace> {
  const { primary, locality } = await resolvePlaceName(node.latitude, node.longitude);
  return { id: node.id, primary, locality, type: node.type, thumbnailUri: node.photoThumbnailUri };
}

export function PlacesModal({
  visible,
  onClose,
  nodes,
  accentColor,
}: {
  visible: boolean;
  onClose: () => void;
  nodes: DayMapNode[];
  accentColor: string;
}) {
  const [places, setPlaces] = useState<ResolvedPlace[] | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let active = true;
    setPlaces(null);
    void (async () => {
      const resolved = await Promise.all(nodes.slice(0, 8).map((node) => resolvePlace(node)));
      if (active) {
        setPlaces(resolved);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, nodes]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={styles.handle} />
          <ThemedText type="subtitle" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            Where you were
          </ThemedText>
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} style={styles.list}>
            {places === null ? (
              <ThemedText style={styles.hint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Reading the map…
              </ThemedText>
            ) : places.length === 0 ? (
              <ThemedText style={styles.hint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                No places landed on this day.
              </ThemedText>
            ) : (
              places.map((place) => {
                const meta = TYPE_META[place.type] ?? TYPE_META.unknown;
                return (
                  <View key={place.id} style={styles.row}>
                    {place.thumbnailUri ? (
                      <Image contentFit="cover" source={place.thumbnailUri} style={styles.thumb} transition={120} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: `${accentColor}22` }]}>
                        <IconSymbol color={accentColor} name={meta.icon} size={20} />
                      </View>
                    )}
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowPrimary} lightColor={Lantern.moon50} darkColor={Lantern.moon50} numberOfLines={1}>
                        {place.primary}
                      </ThemedText>
                      <ThemedText style={styles.rowSecondary} lightColor={Lantern.moon500} darkColor={Lantern.moon500} numberOfLines={1}>
                        {meta.label}
                        {place.locality ? ` · ${place.locality}` : ''}
                      </ThemedText>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeLabel} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
              Close
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(8, 6, 16, 0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#171327',
    borderColor: 'rgba(215, 228, 255, 0.12)',
    borderCurve: 'continuous',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 14,
    maxHeight: '72%',
    paddingBottom: 34,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 12,
  },
  hint: {
    fontSize: 14,
    paddingVertical: 18,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  thumb: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    height: 52,
    width: 52,
  },
  thumbIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flexShrink: 1,
    gap: 2,
  },
  rowPrimary: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSecondary: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: Lantern.moon50,
    borderCurve: 'continuous',
    borderRadius: 14,
    paddingVertical: 13,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
