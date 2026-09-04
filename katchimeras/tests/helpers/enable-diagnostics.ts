// Tests of enabled collectors opt in before importing their modules.
process.env.EXPO_PUBLIC_ENABLE_DIAGNOSTICS = '1';
process.env.EXPO_PUBLIC_SCENE_PERF = '1';
process.env.EXPO_PUBLIC_MERGE_BOARD_PERF = '1';
process.env.EXPO_PUBLIC_TODAY_LOOP_PERF = '1';
