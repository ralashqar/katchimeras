import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  COMPANION_SUPPORT_STYLE_OPTIONS,
  type CompanionIntroductionDefinition,
  type CompanionSupportStyle,
} from '@/constants/companion-introductions';
import type { CompanionJourneyDefinition } from '@/constants/companion-journeys';
import type { HomeVisualKey } from '@/types/home';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { companionFirstPersonText } from '@/utils/companion-dialogue';
import {
  companionQuestionnaireOptionIcon,
  type QuestionnaireImageSource,
} from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { CompanionQuestionnaireScene, QuestionnaireResultNotice } from './companion-questionnaire-scene';
import { CompanionPrimaryAction, CompanionSecondaryAction } from './companion-interaction-primitives';

export type CompanionIntroductionPreference = {
  nodeId: string;
  optionId: string;
  label: string;
};

const FEASTLE_OPENING_OPTIONS: Readonly<Record<string, string>> = {
  ease: 'Fewer decisions',
  care: 'A little more care',
  connection: 'More shared moments',
  curiosity: 'Something new sometimes',
};

const FEASTLE_SUPPORT_OPTIONS: Readonly<Record<CompanionSupportStyle, { label: string; promise: string }>> = {
  gentle: { label: 'Be kind when days are messy', promise: 'keep things kind and easy to change' },
  practical: { label: 'Help me make it easier', promise: 'look for one small thing that makes food easier' },
  patterns: { label: 'Notice what works for me', promise: 'notice what helps without turning it into a rule' },
  on_demand: { label: 'Wait until I ask', promise: 'keep your place at the table until I call' },
};

export function CompanionIntroduction({
  accentColor,
  background,
  companionName,
  creature,
  definition,
  environmentKey,
  introduction,
  onComplete,
  onDefer,
  onStartFocus,
  storyMode = false,
  visualKey,
}: {
  accentColor: string;
  background: TodayAtmosphereBackground;
  companionName: string;
  creature: QuestionnaireImageSource;
  definition: CompanionJourneyDefinition;
  environmentKey: TodayExplorationBackgroundKey | null;
  introduction: CompanionIntroductionDefinition;
  onComplete: (preference: CompanionIntroductionPreference, supportStyle: CompanionSupportStyle) => void;
  onDefer: (preference?: CompanionIntroductionPreference) => void;
  onStartFocus: (preference: CompanionIntroductionPreference, supportStyle: CompanionSupportStyle) => void;
  storyMode?: boolean;
  visualKey: HomeVisualKey;
}) {
  const [step, setStep] = useState<'preference' | 'support' | 'result'>('preference');
  const [preference, setPreference] = useState<CompanionIntroductionPreference | null>(null);
  const [supportStyle, setSupportStyle] = useState<CompanionSupportStyle | null>(null);
  const firstNode = useMemo(
    () => definition.nodes.find((node) => node.id === definition.startNodeId) ?? null,
    [definition]
  );

  useEffect(() => {
    setStep('preference');
    setPreference(null);
    setSupportStyle(null);
  }, [definition.familyId]);

  if (!firstNode?.options?.length) return null;

  if (step === 'preference') {
    return (
      <CompanionQuestionnaireScene
        accentColor={accentColor}
        background={background}
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText={storyMode
          ? 'I brought a picnic basket, one runaway spoon, and no dinner judgement whatsoever.'
          : introduction.greeting}
        onBack={() => onDefer()}
        onSelect={(option) => {
          const choice = firstNode.options?.find((item) => item.id === option.id);
          if (!choice) return;
          setPreference({ nodeId: firstNode.id, optionId: choice.id, label: choice.label });
          setStep('support');
        }}
        options={firstNode.options.map((option) => ({
          id: option.id,
          label: storyMode ? FEASTLE_OPENING_OPTIONS[option.id] ?? option.label : option.label,
          icon: companionQuestionnaireOptionIcon(option.id, option.label),
        }))}
        progress={1 / 3}
        selectionActionLabel={storyMode ? "Tell Feastle" : "Next"}
        stepLabel={storyMode ? "A place at the table · 1 of 3" : "A little about you · 1 of 3"}
        title={storyMode ? "Before I unpack… what should food feel more like?" : companionFirstPersonText(firstNode.prompt, companionName)}
        visualKey={visualKey}
      />
    );
  }

  if (step === 'support') {
    return (
      <CompanionQuestionnaireScene
        accentColor={accentColor}
        background={background}
        companionName={companionName}
        creature={creature}
        environmentKey={environmentKey}
        helperText={storyMode
          ? `“${FEASTLE_OPENING_OPTIONS[preference?.optionId ?? ''] ?? preference?.label ?? 'That'}.” I tie a tiny note to the basket. “Good. I know what to make room for.”`
          : "I’ll use this as guidance, not a rule. You can change it later."}
        onBack={() => setStep('preference')}
        onSelect={(option) => {
          setSupportStyle(option.id as CompanionSupportStyle);
          setStep('result');
        }}
        options={COMPANION_SUPPORT_STYLE_OPTIONS.map((option) => ({
          id: option.id,
          label: storyMode ? FEASTLE_SUPPORT_OPTIONS[option.id].label : option.label,
          icon: companionQuestionnaireOptionIcon(option.id, option.label),
        }))}
        progress={2 / 3}
        selectionActionLabel={storyMode ? "Make a pact" : "Remember this"}
        stepLabel={storyMode ? "How I can help · 2 of 3" : "How I can help · 2 of 3"}
        title={storyMode ? "When the day gets messy, how would you like me beside you?" : "How would you like me to help?"}
        visualKey={visualKey}
      />
    );
  }

  const style = COMPANION_SUPPORT_STYLE_OPTIONS.find((option) => option.id === supportStyle);
  if (!preference || !supportStyle || !style) return null;
  const feastleSupport = FEASTLE_SUPPORT_OPTIONS[supportStyle];
  return (
    <CompanionQuestionnaireScene
      accentColor={accentColor}
      background={background}
      companionName={companionName}
      creature={creature}
      environmentKey={environmentKey}
      helperText={storyMode
        ? `I pat the basket. “Done. I’ll ${feastleSupport.promise}. No perfect plates required.”`
        : `You chose “${preference.label}”. I’ll ${style.summary}.`}
      onBack={() => setStep('support')}
      progress={1}
      result
      stepLabel={storyMode ? "A tiny pact · 3 of 3" : "All set · 3 of 3"}
      title={storyMode ? "Then let’s make our first snack." : "I’ll remember that."}
      visualKey={visualKey}>
      <QuestionnaireResultNotice
        body={storyMode ? "I packed the Pantry. You make one small snack, then bring it back to our table." : "That is enough for today. If you want, we can also turn it into a few optional goals."}
        tasks={[]}
        title={storyMode ? "One small snack. No fuss." : "We can begin gently"}
      />
      <View style={styles.actions}>
        <CompanionPrimaryAction
          icon={storyMode ? "fork.knife" : "scope"}
          label={storyMode ? "Open the Shared Pantry" : "Choose a direction with me"}
          onPress={() => storyMode ? onComplete(preference, supportStyle) : onStartFocus(preference, supportStyle)}
        />
        {!storyMode ? <CompanionSecondaryAction
          icon="checkmark"
          label="That’s enough for now"
          onPress={() => onComplete(preference, supportStyle)}
        /> : null}
        <ThemedText style={styles.note} lightColor="#D8C6A4" darkColor="#D8C6A4">
          {storyMode ? 'Your answers guide the story. They never become rules.' : 'Nothing here locks you in. You can revisit your focus from You.'}
        </ThemedText>
      </View>
    </CompanionQuestionnaireScene>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
