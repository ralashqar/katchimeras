#!/usr/bin/env python3
"""Write Codex image-generation tasks for a five-stage Haven progression.

The built-in Codex image generator is not callable from a repository script.
This command therefore produces deterministic prompts, ordered reference paths,
expected output paths, and provenance for the endpoint/interpolation workflow.
"""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = game_root()
DEFAULT_OUT_ROOT = content_path(ROOT, ".tmp") / "haven-progressions"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    try:
        return logical_path(ROOT, path.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def manifest_path(character: str) -> Path:
    return content_path(ROOT, "design") / "floating-neighborhood-v2" / "haven" / character / "progression.json"


def resolve_project_path(value: str) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (content_path(ROOT, path)).resolve()


def validate_manifest(data: dict[str, Any], path: Path) -> None:
    character = data.get("character")
    stages = data.get("stages")
    if data.get("schemaVersion") != 2:
        raise SystemExit(f"{path}: schemaVersion must be 2")
    if not isinstance(character, str) or not character:
        raise SystemExit(f"{path}: character must be a non-empty string")
    if not isinstance(stages, list) or len(stages) != data.get("stageCount"):
        raise SystemExit(f"{path}: stages must match stageCount")
    ids = [stage.get("id") for stage in stages if isinstance(stage, dict)]
    if ids != list(range(len(stages))):
        raise SystemExit(f"{path}: stage IDs must be contiguous from 0")
    expected_keys = [f"{character}_haven_stage_{stage_id}" for stage_id in ids]
    if [stage.get("key") for stage in stages] != expected_keys:
        raise SystemExit(f"{path}: stage keys must follow <character>_haven_stage_<id>")
    if len(stages) != 5:
        raise SystemExit(f"{path}: endpoint/interpolation workflow currently requires exactly five stages")

    generation = data.get("generation")
    if not isinstance(generation, dict):
        raise SystemExit(f"{path}: missing generation")
    required_generation = {
        "engine": "codex-built-in-imagegen",
        "backgroundRemoval": "birefnet-matted-output",
    }
    for field, expected in required_generation.items():
        if generation.get(field) != expected:
            raise SystemExit(f"{path}: generation.{field} must be {expected!r}")
    if generation.get("background", "").upper() != "#FF00FF":
        raise SystemExit(f"{path}: generation.background must be #FF00FF")
    if int(generation.get("minimumSourceSize", 0)) < 1024:
        raise SystemExit(f"{path}: generation.minimumSourceSize must be at least 1024")
    if int(generation.get("canonicalSize", 0)) != 2048:
        raise SystemExit(f"{path}: generation.canonicalSize must be 2048")
    if int(generation.get("candidateCount", 0)) != 1:
        raise SystemExit(f"{path}: generation.candidateCount must be 1")

    neutral = data.get("canonicalNeutralSource")
    style_references = data.get("styleReferences")
    if not isinstance(neutral, str) or not neutral:
        raise SystemExit(f"{path}: missing canonicalNeutralSource")
    if not isinstance(style_references, list) or not style_references:
        raise SystemExit(f"{path}: styleReferences must be a non-empty list")
    for reference in [neutral, *style_references]:
        if not isinstance(reference, str) or not resolve_project_path(reference).is_file():
            raise SystemExit(f"{path}: missing reference image {reference!r}")

    order = data.get("generationOrder")
    if order != [0, 4, 2, 1, 3]:
        raise SystemExit(f"{path}: generationOrder must be [0, 4, 2, 1, 3]")
    graph = data.get("referenceGraph")
    if not isinstance(graph, dict) or set(graph) != {str(stage_id) for stage_id in ids}:
        raise SystemExit(f"{path}: referenceGraph must define every stage")
    completed: set[int] = set()
    for stage_id in order:
        node = graph[str(stage_id)]
        if stage_id in (0, 4):
            if node.get("kind") != "endpoint":
                raise SystemExit(f"{path}: Stage {stage_id} must be an endpoint")
        else:
            between = node.get("between")
            if node.get("kind") != "interpolation" or not isinstance(between, list) or len(between) != 2:
                raise SystemExit(f"{path}: Stage {stage_id} must interpolate between two stages")
            if not all(reference in completed for reference in between):
                raise SystemExit(f"{path}: Stage {stage_id} references stages not yet generated: {between}")
        completed.add(stage_id)

    for stage in stages:
        for field in ("name", "narrative", "floor", "landmark", "props", "palette", "lighting", "density"):
            if not stage.get(field):
                raise SystemExit(f"{path}: Stage {stage['id']} is missing {field}")


def load_manifest(character: str) -> tuple[Path, dict[str, Any]]:
    path = manifest_path(character)
    if not path.is_file():
        raise SystemExit(f"Missing Haven progression manifest: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Invalid Haven progression manifest {path}: {exc}") from None
    validate_manifest(data, path)
    return path, data


def stage_description(stage: dict[str, Any]) -> str:
    return " ".join(
        [
            f"Narrative purpose: {stage['narrative']}",
            f"Floor: {stage['floor']}",
            f"Landmark: {stage['landmark']}",
            f"Props: {'; '.join(stage['props'])}.",
            f"Palette: {', '.join(stage['palette'])}.",
            f"Lighting: {stage['lighting']}",
            f"Density: {stage['density']}",
        ]
    )


def shared_constraints(manifest: dict[str, Any]) -> str:
    invariants = manifest["invariants"]
    return "\n\n".join(
        [
            "GEOMETRY AND CHARACTER ANCHOR\n" + " ".join(invariants["geometry"]),
            "PERSISTENT LANDMARKS\n" + " ".join(invariants["persistentLandmarks"]),
            "STYLE\n" + " ".join(invariants["style"]),
            "BACKGROUND\nCreate the complete island on a perfectly flat uniform solid #FF00FF chroma-key background. "
            "The background has no gradient, texture, shadow, floor, reflection, or lighting variation. Do not use magenta in the island.",
            "EXCLUSIONS\nNo " + ", ".join(invariants["exclude"]) + ". Do not crop the island.",
        ]
    )


def endpoint_prompt(manifest: dict[str, Any], stage: dict[str, Any]) -> str:
    style_count = len(manifest["styleReferences"])
    style_roles = ", ".join(f"Image {index + 2}" for index in range(style_count))
    return "\n\n".join(
        [
            "Use case: stylized-concept\n"
            f"Asset type: individual runtime environment tile for {manifest['displayName']} Haven Stage {stage['id']} of {manifest['stageCount'] - 1}",
            "INPUT IMAGES\n"
            "Image 1 is authoritative for the exact island geometry, camera, crop, scale, wall, underside, and centered front stairs. "
            f"{style_roles} are style-only references for the Katchimera's cozy environment language. "
            "Create one complete square floating hex tile, never a grid or contact sheet.",
            f"TARGET STAGE\nCreate Stage {stage['id']}: {stage['name']}. {stage_description(stage)}",
            shared_constraints(manifest),
        ]
    )


def interpolation_prompt(
    manifest: dict[str, Any], stage: dict[str, Any], lower: dict[str, Any], upper: dict[str, Any]
) -> str:
    return "\n\n".join(
        [
            "Use case: stylized-concept\n"
            f"Asset type: individual runtime environment tile for {manifest['displayName']} Haven Stage {stage['id']} of {manifest['stageCount'] - 1}",
            "INPUT IMAGES\n"
            f"Image 1 is the exact completed Stage {lower['id']} ({lower['name']}) lower state. "
            f"Image 2 is the exact completed Stage {upper['id']} ({upper['name']}) upper state. "
            "Create the natural visual and narrative midpoint between these exact images. Preserve their shared camera, island shell, stairs, crop, scale, materials, lighting direction, landmark anchors, and lower standing patch. "
            "Create one complete square floating hex tile, never a grid or contact sheet.",
            f"TARGET STAGE\nCreate Stage {stage['id']}: {stage['name']}. It must be clearly richer than Stage {lower['id']} and clearly less developed than Stage {upper['id']}. {stage_description(stage)}",
            shared_constraints(manifest),
        ]
    )


def task_for_stage(
    manifest_path_value: Path,
    manifest: dict[str, Any],
    stage_id: int,
    workspace: Path,
    *,
    require_inputs: bool,
) -> dict[str, Any]:
    stages = {stage["id"]: stage for stage in manifest["stages"]}
    stage = stages[stage_id]
    node = manifest["referenceGraph"][str(stage_id)]
    if node["kind"] == "endpoint":
        inputs = [
            resolve_project_path(manifest["canonicalNeutralSource"]),
            *(resolve_project_path(reference) for reference in manifest["styleReferences"]),
        ]
        prompt = endpoint_prompt(manifest, stage)
        depends_on: list[int] = []
    else:
        depends_on = [int(value) for value in node["between"]]
        inputs = [workspace / f"stage-{reference}-chroma.png" for reference in depends_on]
        prompt = interpolation_prompt(manifest, stage, stages[depends_on[0]], stages[depends_on[1]])
    if require_inputs:
        missing = [path for path in inputs if not path.is_file()]
        if missing:
            joined = ", ".join(relative(path) for path in missing)
            raise SystemExit(f"Stage {stage_id} is waiting for reference images: {joined}")

    prompt_path = workspace / f"stage-{stage_id}-prompt.md"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    output = workspace / f"stage-{stage_id}-chroma.png"
    return {
        "stage": stage_id,
        "stageKey": stage["key"],
        "role": node["kind"],
        "dependsOn": depends_on,
        "promptPath": relative(prompt_path),
        "prompt": prompt,
        "inputImagePaths": [relative(path) for path in inputs],
        "inputSha256": {relative(path): sha256(path) for path in inputs if path.is_file()},
        "expectedOutputPath": relative(output),
        "background": manifest["generation"]["background"],
        "engine": manifest["generation"]["engine"],
        "candidateCount": manifest["generation"]["candidateCount"],
        "manifestPath": relative(manifest_path_value),
        "manifestSha256": sha256(manifest_path_value),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True)
    parser.add_argument("--mode", required=True, choices=("stage", "all"))
    parser.add_argument("--stage", type=int, help="Required for --mode stage.")
    parser.add_argument(
        "--workspace-dir",
        help="Defaults to .tmp/haven-progressions/<character>/codex-generation.",
    )
    parser.add_argument(
        "--require-inputs",
        action="store_true",
        help="Fail unless every image reference for the selected task already exists.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compatibility flag: task planning never calls a network or image-generation API.",
    )
    args = parser.parse_args()
    if args.mode == "stage" and args.stage is None:
        parser.error("--mode stage requires --stage")
    if args.mode != "stage" and args.stage is not None:
        parser.error("--stage is valid only with --mode stage")

    character = args.character.strip().lower()
    path, manifest = load_manifest(character)
    workspace = (
        resolve_project_path(args.workspace_dir)
        if args.workspace_dir
        else DEFAULT_OUT_ROOT / character / "codex-generation"
    )
    workspace.mkdir(parents=True, exist_ok=True)
    order = manifest["generationOrder"]
    selected = [args.stage] if args.mode == "stage" else order
    if any(stage_id not in order for stage_id in selected):
        parser.error(f"--stage must be one of {order}")

    tasks = [
        task_for_stage(path, manifest, stage_id, workspace, require_inputs=args.require_inputs)
        for stage_id in selected
    ]
    plan = {
        "schemaVersion": 1,
        "character": character,
        "generationOrder": order,
        "workspace": relative(workspace),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": "planned",
        "note": "Run these tasks sequentially with Codex built-in image generation; this script does not invoke that tool.",
        "tasks": tasks,
    }
    plan_path = workspace / "codex-generation-plan.json"
    plan_path.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    for task in tasks:
        dependencies = ",".join(str(value) for value in task["dependsOn"]) or "canonical references"
        print(
            f"Stage {task['stage']} ({task['role']}): inputs={dependencies}; "
            f"prompt={task['promptPath']}; output={task['expectedOutputPath']}"
        )
    print(f"DONE {relative(plan_path)}")
    print("NEXT: use Codex image generation in the listed order, then run prepare-haven-progression.py.")


if __name__ == "__main__":
    main()
