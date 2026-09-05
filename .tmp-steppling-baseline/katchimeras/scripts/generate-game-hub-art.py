#!/usr/bin/env python3
"""Generate and promote square Game Hub artwork through the existing FAL edge function.

Generation writes review candidates only. `promote` performs the human-approval
step, creates a 640px WebP, and regenerates the static Expo asset registry.
"""
import argparse
import base64
import json
import mimetypes
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "game-hub-art.json"
CANDIDATE_DIR = ROOT / "design" / "game-hub-art" / "candidates"
ASSET_DIR = ROOT / "assets" / "images" / "katchimeras" / "game-hub"
REGISTRY_PATH = ROOT / "constants" / "game-hub-art.generated.ts"

STYLE = (
    "Premium stylized 3D mobile-game mascot illustration matching the supplied project style reference. "
    "Warm handcrafted materials, rounded readable forms, expressive glossy eyes, clean studio key light, "
    "soft fill and rim light, grounded contact shadows, square composition, "
    "clear at 120 pixels. The creature identity reference is authoritative for species, face, palette, and motifs. "
)
NEGATIVES = (
    "No text, no letters, no numbers, no title, no logo, no watermark, no UI frame, no extra creatures, "
    "no human, no weapon, no photorealism, no cheap plastic toy shine, no cluttered scenery."
)


def load_manifest():
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_env():
    values = {}
    for raw in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    url = values.get("EXPO_PUBLIC_SUPABASE_URL")
    key = values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase URL or publishable key in .env.local")
    return url, key


def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def prompt_for(game):
    mechanic_refs = game.get("mechanicReferences", [])
    reference_roles = (
        "Input image 1 is the authoritative creature identity reference. Input image 2 is the project style reference. "
        + (f"Input images 3 through {len(mechanic_refs) + 2} are authoritative mechanic/layout references. " if mechanic_refs else "")
    )
    return (
        f"{STYLE}{reference_roles}"
        f"Actual game mechanic: {game['mechanicDescription']} "
        f"Required cover moment: {game['focus']}. "
        "The game board and player action must be immediately recognisable and mechanically accurate; show the board geometry, pieces, and interaction described above rather than a generic mascot activity. "
        "Keep the board as the primary readable prop and the companion as its delighted guide. "
        f"{NEGATIVES}"
    )


def validate(manifest):
    issues = []
    seen = set()
    style = ROOT / manifest["styleReference"]
    if not style.exists():
        issues.append(f"missing style reference: {style}")
    for game in manifest["games"]:
        quest_id = game.get("questId")
        if not quest_id or quest_id in seen:
            issues.append(f"missing or duplicate questId: {quest_id}")
        seen.add(quest_id)
        identity = ROOT / game.get("identityReference", "")
        if not identity.is_file():
            issues.append(f"{quest_id}: missing identity reference {identity}")
        mechanic = game.get("mechanicDescription", "").strip()
        if len(mechanic) < 80:
            issues.append(f"{quest_id}: mechanicDescription must concretely explain the board and player action")
        for mechanic_reference in game.get("mechanicReferences", []):
            reference_path = ROOT / mechanic_reference
            if not reference_path.is_file():
                issues.append(f"{quest_id}: missing mechanic reference {reference_path}")
    if len(manifest["games"]) != 25:
        issues.append(f"expected 25 live games, found {len(manifest['games'])}")
    if issues:
        raise SystemExit("\n".join(issues))
    print(f"manifest OK: {len(seen)} games")


def call_generate(game, manifest):
    url, key = load_env()
    references = [ROOT / game["identityReference"], ROOT / manifest["styleReference"]]
    references.extend(ROOT / value for value in game.get("mechanicReferences", []))
    payload = {
        "renderProfile": {
            "id": f"game-hub:{game['artworkKey']}",
            "displayName": game["questId"],
            "topLevelType": "game_hub",
            "triggerCategory": "game_art",
            "triggerSubtype": game["artworkKey"],
            "theme": "game_hub",
            "creatureKind": "game_card",
            "caption": "Game Hub candidate",
            "imagePrompt": prompt_for(game),
        },
        "modelId": "fal-ai/nano-banana-2/edit",
        "input": {
            "image_urls": [data_uri(path) for path in references],
            "aspect_ratio": "1:1",
            "resolution": "2K",
        },
        "assetType": "other",
        "assetKey": f"game-hub:{game['artworkKey']}",
        "pipelineVersion": "game-hub-art-v2-mechanic-grounded",
    }
    request = urllib.request.Request(
        f"{url}/functions/v1/generate-katchimera-art",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"generation HTTP {error.code}: {error.read().decode()[:500]}") from error
    image_url = result.get("record", {}).get("image_url")
    if not image_url:
        raise SystemExit(f"generation returned no image for {game['questId']}")
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    output = CANDIDATE_DIR / f"{game['artworkKey']}.png"
    urllib.request.urlretrieve(image_url, output)
    print(f"candidate: {output.relative_to(ROOT)}")


def selected_games(manifest, quest_id):
    games = manifest["games"]
    if quest_id == "all":
        return games
    selected = [game for game in games if game["questId"] == quest_id]
    if not selected:
        raise SystemExit(f"unknown quest id: {quest_id}")
    return selected


def write_registry(manifest):
    promoted = [game for game in manifest["games"] if (ASSET_DIR / f"{game['artworkKey']}.webp").exists()]
    rows = [
        "// Generated by scripts/generate-game-hub-art.py promote.",
        "export const GAME_HUB_ART_SOURCES: Readonly<Record<string, number>> = {",
    ]
    for game in promoted:
        rows.append(f"  '{game['questId']}': require('../assets/images/katchimeras/game-hub/{game['artworkKey']}.webp'),")
    rows.extend([
        "};",
        "",
        "export function gameHubArtSource(questId: string): number | null {",
        "  return GAME_HUB_ART_SOURCES[questId] ?? null;",
        "}",
        "",
    ])
    REGISTRY_PATH.write_text("\n".join(rows), encoding="utf-8")
    print(f"registry: {REGISTRY_PATH.relative_to(ROOT)} ({len(promoted)} promoted)")


def promote(game, candidate_override=None):
    try:
        from PIL import Image
    except ImportError as error:
        raise SystemExit("Install Pillow to promote artwork: pip install pillow") from error
    candidate = Path(candidate_override) if candidate_override else CANDIDATE_DIR / f"{game['artworkKey']}.png"
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    if not candidate.is_file():
        raise SystemExit(f"candidate not found: {candidate}")
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    output = ASSET_DIR / f"{game['artworkKey']}.webp"
    with Image.open(candidate) as image:
        image.convert("RGB").resize((640, 640), Image.Resampling.LANCZOS).save(output, "WEBP", quality=84, method=6)
    print(f"promoted: {output.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser(description="Game Hub FAL artwork pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validate")
    prompt = sub.add_parser("prompt")
    prompt.add_argument("--quest", required=True)
    generate = sub.add_parser("generate")
    generate.add_argument("--quest", required=True, help="quest id or 'all'")
    promote_parser = sub.add_parser("promote")
    promote_parser.add_argument("--quest", required=True)
    promote_parser.add_argument("--candidate")
    args = parser.parse_args()
    manifest = load_manifest()
    validate(manifest)
    games = selected_games(manifest, getattr(args, "quest", "all"))
    if args.command == "validate":
        return
    if args.command == "prompt":
        print(prompt_for(games[0]))
        return
    if args.command == "generate":
        for game in games:
            call_generate(game, manifest)
        return
    promote(games[0], args.candidate)
    write_registry(manifest)


if __name__ == "__main__":
    main()
