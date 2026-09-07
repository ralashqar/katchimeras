import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View } from "react-native";
import {
  createContentFlowRun,
  reduceContentFlow,
} from "@incubator/story/interpreter";
import type {
  ContentFlowDefinition,
  ContentFlowRun,
} from "@incubator/story/types";
import { storyRepository } from "../state/story-repository";
import { Button, Copy, Heading, styles } from "./ui";

export function Dialogue({
  id,
  title,
  lines,
  onDone,
}: {
  id: string;
  title: string;
  lines: readonly string[];
  onDone: () => void | Promise<void>;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const definition = useMemo<ContentFlowDefinition>(
    () => ({
      id,
      version: 1,
      entryNodeId: "line-0",
      nodes: [
        ...lines.map((line, i) => ({
          id: `line-${i}`,
          kind: "scene" as const,
          capability: "dialogue",
          surface: "egg-snap-dialogue",
          sceneId: id,
          payload: { line },
          actions: [
            {
              id: "next",
              next: i === lines.length - 1 ? "done" : `line-${i + 1}`,
            },
          ],
        })),
        { id: "done", kind: "complete" },
      ],
    }),
    [id, lines],
  );
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void storyRepository
      .loadContentFlowRun(id)
      .then(async (saved) => {
        if (!active) return;
        const next = saved ?? createContentFlowRun(definition, { runId: id });
        setRun(next);
        if (next.status === "completed") await doneRef.current();
      })
      .catch(() => {
        if (active)
          setError("The story could not be saved or opened. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [id, definition, reload]);
  const next = async () => {
    if (!run || busy) return;
    setBusy(true);
    try {
      setError("");
      const result =
        run.status === "completed"
          ? run
          : reduceContentFlow(definition, run, {
              type: "submit_scene",
              actionId: "next",
            }).run;
      await storyRepository.saveContentFlowTransition(result);
      setRun(result);
      if (result.status === "completed") await doneRef.current();
    } catch {
      setError("Could not save this conversation. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const node = definition.nodes.find((n) => n.id === run?.nodeId);
  return (
    <Modal transparent animationType="fade" onRequestClose={() => {}}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(9,23,19,0.45)",
        }}
      >
        <View style={[styles.panel, { paddingBottom: 40 }]}>
          <Copy style={styles.muted}>A LITTLE STORY</Copy>
          <Heading small>{title}</Heading>
          <Copy style={{ fontSize: 17, lineHeight: 27 }}>
            {node && node.kind === "scene"
              ? String(node.payload?.line)
              : "Opening the story…"}
          </Copy>
          {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
          <Button
            disabled={busy || (!run && !error)}
            onPress={() => (run ? void next() : setReload((n) => n + 1))}
          >
            {error
              ? "Try again"
              : run?.nodeId === `line-${lines.length - 1}` ||
                  run?.status === "completed"
                ? "Let’s go"
                : "Continue"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
