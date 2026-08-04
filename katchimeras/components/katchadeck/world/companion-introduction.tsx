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
        helperText={introduction.greeting}
        onBack={() => onDefer()}
        onSelect={(option) => {
          const choice = firstNode.options?.find((item) => item.id === option.id);
          if (!choice) return;
          setPreference({ nodeId: firstNode.id, optionId: choice.id, label: choice.label });
          setStep('support');
        }}
        options={firstNode.options.map((option) => ({
          id: option.id,
          label: option.label,
          icon: companionQuestionnaireOptionIcon(option.id, option.label),
        }))}
        progress={1 / 3}
        selectionActionLabel="Next"
        stepLabel="A little about you · 1 of 3"
        title={companionFirstPersonText(firstNode.prompt, companionName)}
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
        helperText="I’ll use this as guidance, not a rule. You can change it later."
        onBack={() => setStep('preference')}
        onSelect={(option) => {
          setSupportStyle(option.id as CompanionSupportStyle);
          setStep('result');
        }}
        options={COMPANION_SUPPORT_STYLE_OPTIONS.map((option) => ({
          id: option.id,
          label: option.label,
          icon: companionQuestionnaireOptionIcon(option.id, option.label),
        }))}
        progress={2 / 3}
        selectionActionLabel="Remember this"
        stepLabel="How I can help · 2 of 3"
        title="How would you like me to help?"
        visualKey={visualKey}
      />
    );
  }

  const style = COMPANION_SUPPORT_STYLE_OPTIONS.find((option) => option.id === supportStyle);
  if (!preference || !supportStyle || !style) return null;
  return (
    <CompanionQuestionnaireScene
      accentColor={accentColor}
      background={background}
      companionName={companionName}
      creature={creature}
      environmentKey={environmentKey}
      helperText={`You chose “${preference.label}”. I’ll ${style.summary}.`}
      onBack={() => setStep('support')}
      progress={1}
      result
      stepLabel="All set · 3 of 3"
      title="I’ll remember that."
      visualKey={visualKey}>
      <QuestionnaireResultNotice
        body="That is enough for today. If you want, we can also turn it into a longer-term focus."
        tasks={[]}
        title="We can begin gently"
      />
      <View style={styles.actions}>
        <CompanionPrimaryAction
          icon="scope"
          label="Choose a direction with me"
          onPress={() => onStartFocus(preference, supportStyle)}
        />
        <CompanionSecondaryAction
          icon="checkmark"
          label="That’s enough for now"
          onPress={() => onComplete(preference, supportStyle)}
        />
        <ThemedText style={styles.note} lightColor="#D8C6A4" darkColor="#D8C6A4">
          Nothing here locks you in. You can revisit your focus from You.
        </ThemedText>
      </View>
    </CompanionQuestionnaireScene>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
