import { Image, type ImageSource } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { COMPANION_DISCOVERIES_BY_ID } from '@/constants/companion-discovery-catalog';
import {
  MERGE_CHARACTER_NAMES,
  MERGE_GENERATORS_BY_ID,
  MERGE_ITEMS_BY_ID,
  MOSSPROUT_GARDEN_GROWTH_CLEARINGS,
  MOSSPROUT_ROOTBOUND_GATES_BY_ID,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt, mergeWorldItemArt, mossproutRootRewardArt } from '@/constants/merge-world-art';
import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_GENERATORS_UNLIMITED } from '@/utils/merge-world/economy-policy';
import { mossproutRootConditionCopy, mossproutRootReadyCopy, mossproutRootRewardCopy } from '@/utils/merge-world/merge-board-player-copy';

const DREAM_MIST_LOWER = require('../../../assets/images/katchimeras/merge-world/locked/dream-mist-lower.webp');

type InspectorModel = {
  art: ImageSource | null;
  body: string;
  dreamMist?: 'lower';
  eyebrow: string;
  grovelightGateId: string | null;
  icon: IconSymbolName;
  title: string;
};

export function MergeCellInspector({ cell, onUseGrovelight, state }: {
  cell: number | null;
  onUseGrovelight: (gateId: string) => void;
  state: MergeWorldState;
}) {
  const model = inspectorModel(state, cell);
  return <KatchaSurfaceProvider surface="parchment">
    <View accessibilityLiveRegion="polite" style={styles.shell}>
      <View style={styles.thumbnail}>
        {model.art ? <Image
          accessibilityIgnoresInvertColors
          contentFit="contain"
          source={model.art}
          style={styles.art}
          transition={100}
        /> : <IconSymbol color="#73592E" name={model.icon} size={25} />}
        {model.dreamMist === 'lower' ? <Image
          accessibilityIgnoresInvertColors
          contentFit="fill"
          pointerEvents="none"
          source={DREAM_MIST_LOWER}
          style={styles.mist}
          transition={0}
        /> : null}
      </View>
      <Animated.View entering={FadeIn.duration(160)} key={`${cell ?? 'guide'}:${model.title}`} style={styles.copy}>
        <ThemedText darkColor="#7A6235" lightColor="#7A6235" numberOfLines={1} selectable style={styles.eyebrow}>{model.eyebrow}</ThemedText>
        <ThemedText darkColor="#342813" lightColor="#342813" numberOfLines={1} selectable style={styles.title}>{model.title}</ThemedText>
        <ThemedText darkColor="#65583D" lightColor="#65583D" numberOfLines={2} selectable style={styles.body}>{model.body}</ThemedText>
      </Animated.View>
      {model.grovelightGateId ? <KatchaButton
        accessibilityHint="Brings back the parcel needed to wake this root."
        icon="sparkles"
        label="Ask Grovelight"
        onPress={() => onUseGrovelight(model.grovelightGateId!)}
        size="compact"
        style={styles.action}
        variant="secondary"
      /> : null}
    </View>
  </KatchaSurfaceProvider>;
}

function inspectorModel(state: MergeWorldState, cell: number | null): InspectorModel {
  if (cell == null || !state.board[cell]) return {
    art: null,
    body: 'Tap an item or covered cell for details.',
    eyebrow: 'BOARD GUIDE',
    grovelightGateId: null,
    icon: 'cloud.fog.fill',
    title: 'What is beneath the Mist?',
  };

  const boardCell = state.board[cell];
  const occupant = boardCell.occupant;
  if (occupant?.kind === 'item') {
    const definition = MERGE_ITEMS_BY_ID.get(occupant.definitionId);
    if (!definition) return unknownModel();
    const boundRoot = occupant.progressionGateId ? MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(occupant.progressionGateId) : null;
    if (boundRoot) return {
      art: mergeWorldItemArt(definition.id),
      body: `For ${boundRoot.title}. Drag it onto that root when it is ready.`,
      eyebrow: 'A MEMORY FOR MOSSPROUT',
      grovelightGateId: null,
      icon: definition.icon,
      title: definition.name,
    };
    const next = definition.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
    return {
      art: mergeWorldItemArt(definition.id),
      body: next
        ? `Merge with another ${definition.name} → ${next.name}.`
        : 'This item cannot be merged any further.',
      eyebrow: `${definition.familyId.toUpperCase()} MERGE ITEM`,
      grovelightGateId: null,
      icon: definition.icon,
      title: definition.name,
    };
  }

  if (occupant?.kind === 'generator') {
    const definition = MERGE_GENERATORS_BY_ID.get(occupant.generatorId);
    const generatorState = state.generators[occupant.generatorId];
    if (!definition) return unknownModel();
    const level = generatorState?.level ?? 1;
    const outputs = [...new Set(definition.chainIds.map((chainId) => titleCase(chainId.split(':')[1])))]
      .join(' and ');
    const readiness = MERGE_GENERATORS_UNLIMITED
      ? 'Unlimited finds ready.'
      : generatorState
        ? generatorState.charges > 0
          ? `${generatorState.charges} of ${generatorState.capacity} finds ready.`
          : 'Resting while new finds grow.'
        : '';
    return {
      art: mergeWorldGeneratorArt(definition.id, { level }),
      body: `${readiness} ${generatorUseCopy(definition.id, level, outputs)}`.trim(),
      eyebrow: definition.id === 'wild-garden' || definition.id === 'memory-nursery'
        ? 'MOSSPROUT ITEM MAKER'
        : 'ITEM MAKER',
      grovelightGateId: null,
      icon: definition.icon,
      title: definition.name,
    };
  }

  const mist = boardCell.mist;
  if (mist?.kind === 'garden_growth') {
    const clearing = MOSSPROUT_GARDEN_GROWTH_CLEARINGS.find((candidate) => candidate.id === mist.clearingId);
    const current = Math.min(state.mossproutBoardProgression.activeDayIds.length, mist.revealDay);
    return {
      art: null,
      body: `Opens on Mossprout Journey Day ${mist.revealDay}. You don’t need an item.`,
      eyebrow: `GARDEN GROWING · ${current} OF ${mist.revealDay} DAYS`,
      grovelightGateId: null,
      icon: 'cloud.fog.fill',
      title: clearing?.title ?? 'Hidden garden patch',
    };
  }

  if (mist?.kind === 'rootbound_echo') {
    const gate = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(mist.gateId);
    if (!gate) return unknownModel();
    const gateState = state.mossproutBoardProgression.gates[gate.id];
    const ready = gateState?.status === 'ready';
    const canUseGrovelight = ready
      && state.mossproutBoardProgression.signals.ownedWispIds.includes('grovelight')
      && !state.arrivals.some((arrival) => arrival.progressionGateId === gate.id && arrival.claimedAt == null);
    return {
      art: mossproutRootRewardArt(gate.id),
      body: canUseGrovelight
        ? 'Ask Grovelight to bring back the parcel needed for this root.'
        : ready
          ? `${mossproutRootReadyCopy(gate)} ${mossproutRootRewardCopy(gate)}`
          : `${mossproutRootConditionCopy(gate)} ${mossproutRootRewardCopy(gate)}`,
      dreamMist: 'lower',
      eyebrow: ready ? 'READY TO WAKE' : 'SLEEPING ROOT',
      grovelightGateId: canUseGrovelight ? gate.id : null,
      icon: ready ? 'checkmark' : 'leaf.fill',
      title: gate.title,
    };
  }

  if (mist?.kind === 'discovery_dormant') {
    const names = mist.characterIds.map((id) => MERGE_CHARACTER_NAMES[id]).filter(Boolean);
    return {
      art: null,
      body: names.length
        ? `Meet ${names.join(' or ')} to lift this mist.`
        : 'Lifts during a future Katchimera story.',
      eyebrow: 'KATCHIMERA DISCOVERY',
      grovelightGateId: null,
      icon: 'sparkles',
      title: names.length ? `A path to ${names.join(' or ')}` : 'A path not yet remembered',
    };
  }

  if (mist?.kind === 'echo') {
    const definition = MERGE_ITEMS_BY_ID.get(mist.definitionId);
    if (!definition) return unknownModel();
    const next = definition.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
    return {
      art: mergeWorldItemArt(definition.id),
      body: `Drag another ${definition.name} here${next ? ` → ${next.name}` : ' to lift the mist'}.`,
      dreamMist: 'lower',
      eyebrow: 'SLEEPING ITEM',
      grovelightGateId: null,
      icon: definition.icon,
      title: definition.name,
    };
  }

  if (mist?.kind === 'dreambound_item') {
    const definition = MERGE_ITEMS_BY_ID.get(mist.boundDefinitionId);
    const discovery = COMPANION_DISCOVERIES_BY_ID.get(mist.discoveryId);
    if (!definition) return unknownModel();
    return {
      art: mergeWorldItemArt(definition.id),
      body: mist.active
        ? `Drag another ${definition.name} here to reveal the next clue.`
        : `Complete the earlier clues in ${discovery?.pathName ?? 'this trail'} first.`,
      dreamMist: 'lower',
      eyebrow: mist.active ? 'CLUE READY TO WAKE' : 'A LATER CLUE',
      grovelightGateId: null,
      icon: definition.icon,
      title: definition.name,
    };
  }

  if (mist?.kind === 'discovery_fork') {
    const names = mist.candidateIds.map((id) => MERGE_CHARACTER_NAMES[id]).filter(Boolean);
    return {
      art: null,
      body: names.length ? `Choose the next trail: ${names.join(', ')}.` : 'Choose the next Katchimera trail.',
      eyebrow: 'CHOOSE A NEW FRIEND',
      grovelightGateId: null,
      icon: 'sparkles',
      title: 'Several paths beneath the Mist',
    };
  }

  if (mist) return {
    art: null,
    body: 'Lifts during a future Katchimera story.',
    eyebrow: 'DREAM MIST',
    grovelightGateId: null,
    icon: 'cloud.fog.fill',
    title: 'Something is still sleeping here',
  };

  return {
    art: null,
    body: 'Drag an item here.',
    eyebrow: 'OPEN BOARD SPACE',
    grovelightGateId: null,
    icon: 'sparkles',
    title: 'Empty cell',
  };
}

function generatorUseCopy(generatorId: string, level: number, outputs: string) {
  if (generatorId === 'wild-garden') {
    if (level >= 3) return 'Finds Sprouts and Shells more often · costs 1 Energy.';
    if (level >= 2) return 'Can also find Sprouts and Shells · costs 1 Energy.';
    return 'Finds Seeds and Pebbles · costs 1 Energy.';
  }
  if (generatorId === 'memory-nursery') {
    if (level >= 3) return 'Grows Pressed Leaves more often · costs 1 Energy.';
    if (level >= 2) return 'Can also grow Pressed Leaves · costs 1 Energy.';
    return 'Grows Dew Beads · costs 1 Energy.';
  }
  return `Makes ${outputs} items · costs 1 Energy.`;
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unknownModel(): InspectorModel {
  return {
    art: null,
    body: 'This board element is still being remembered.',
    eyebrow: 'BOARD DETAIL',
    grovelightGateId: null,
    icon: 'sparkles',
    title: 'Unknown item',
  };
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(250,241,207,0.96)',
    borderColor: 'rgba(126,94,38,0.32)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(38,25,12,0.18)',
    flexDirection: 'row',
    gap: 9,
    height: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: 'rgba(126,94,38,0.1)',
    borderColor: 'rgba(126,94,38,0.17)',
    borderCurve: 'continuous',
    borderRadius: 13,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  art: { height: 53, width: 53 },
  mist: { height: 56, left: 0, position: 'absolute', top: 0, width: 56 },
  copy: { flex: 1, gap: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.75, lineHeight: 12 },
  title: { fontSize: 14, fontWeight: '900', lineHeight: 17 },
  body: { fontSize: 11.5, fontWeight: '600', lineHeight: 15 },
  action: { flexShrink: 0, maxWidth: 112 },
});
