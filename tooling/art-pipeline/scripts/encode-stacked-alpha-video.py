"""Pack a transparent WebM into a stacked-alpha MP4 for hardware-decoded playback.

The output is one opaque H.264 (or HEVC, when the local ffmpeg has libx265)
video twice as tall as the source: the straight colour on the top half and
the alpha matte as grey on the bottom half. A small runtime shader recombines
the halves, so the clip decodes in hardware on both platforms with no alpha
codec support required and a fraction of an animated WebP's size.

Typical use, after `generate-katchimera-idle.py` has left its matted WebM in
the work directory:

    python scripts/encode-stacked-alpha-video.py \
      --input .tmp/mist-tile/mist-tile-transparent.webm \
      --output assets/images/katchimeras/animations/mist-tile-idle.mp4 --size 512
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ.get("INCUBATOR_GAME_ROOT") or Path(__file__).resolve().parents[1])


def find_ffmpeg() -> str:
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    try:
        import imageio_ffmpeg  # type: ignore[import-not-found]

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:  # pragma: no cover - environment dependent
        raise RuntimeError(
            "ffmpeg is required. Install imageio-ffmpeg (`python -m pip install imageio-ffmpeg`) or put ffmpeg on PATH."
        ) from error


def ffmpeg_has_encoder(ffmpeg: str, encoder: str) -> bool:
    result = subprocess.run([ffmpeg, "-hide_banner", "-encoders"], capture_output=True, text=True, check=False)
    return any(line.split()[1:2] == [encoder] for line in result.stdout.splitlines() if line.strip())


def resolve_project_path(value: Path) -> Path:
    return value if value.is_absolute() else (ROOT / value)


def probe(ffmpeg: str, path: Path) -> dict[str, str]:
    result = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True, check=False)
    info: dict[str, str] = {}
    for line in result.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            info["duration"] = line.split(",")[0].split("Duration:")[1].strip()
        if line.startswith("Stream") and "Video:" in line:
            info["video"] = line.split("Video:")[1].strip()
    return info


def encode(ffmpeg: str, source: Path, output: Path, size: int, fps: int | None, crf: int, codec: str, mode: str = "stacked") -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    rate = f"fps={fps}," if fps else ""
    if mode == "luma":
        # An opaque light-only clip: greyscale, same size, no matte. The runtime
        # uses its luminance as the overlay alpha.
        command = [ffmpeg, "-y", "-i", str(source), "-an", "-vf", f"{rate}scale={size}:{size}:flags=lanczos,format=gray,format=yuv420p"]
        if codec == "hevc":
            command += ["-c:v", "libx265", "-preset", "slow", "-crf", str(crf), "-tag:v", "hvc1", "-x265-params", "log-level=error"]
        else:
            command += ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf)]
        command += ["-g", str(fps or 24), "-movflags", "+faststart", str(output)]
        subprocess.run(command, check=True)
        return
    # Decode with libvpx-vp9 so the alpha plane survives, split into colour and
    # matte, stack colour over matte, then flatten to 4:2:0 for the hardware decoders.
    filter_complex = (
        f"[0:v]{rate}scale={size}:{size}:flags=lanczos,format=rgba,split[colour][matte];"
        "[matte]alphaextract,format=gray,format=rgb24[alpha];"
        "[colour]format=rgb24[rgb];"
        "[rgb][alpha]vstack,format=yuv420p[out]"
    )
    command = [
        ffmpeg, "-y", "-c:v", "libvpx-vp9", "-i", str(source), "-an",
        "-filter_complex", filter_complex, "-map", "[out]",
    ]
    if codec == "hevc":
        command += ["-c:v", "libx265", "-preset", "slow", "-crf", str(crf), "-tag:v", "hvc1", "-x265-params", "log-level=error"]
    else:
        command += ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-crf", str(crf)]
    command += ["-g", str(fps or 24), "-movflags", "+faststart", str(output)]
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, required=True, help="Transparent VP9 WebM (from the idle pipeline).")
    parser.add_argument("--output", type=Path, required=True, help="Stacked-alpha MP4 to write.")
    parser.add_argument("--size", type=int, default=512, help="Square colour size; the file is twice as tall.")
    parser.add_argument("--fps", type=int, help="Resample to this frame rate (default: keep the source rate).")
    parser.add_argument("--crf", type=int, default=20)
    parser.add_argument("--codec", choices=("auto", "h264", "hevc"), default="auto",
                        help="auto picks HEVC when libx265 is available, else H.264.")
    parser.add_argument("--mode", choices=("stacked", "luma"), default="stacked",
                        help="stacked: colour over matte from a transparent WebM; luma: greyscale light clip from any video.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ffmpeg = find_ffmpeg()
    source = resolve_project_path(args.input)
    output = resolve_project_path(args.output)
    if not source.exists():
        parser.error(f"Input does not exist: {source}")
    codec = args.codec
    if codec == "auto":
        codec = "hevc" if ffmpeg_has_encoder(ffmpeg, "libx265") else "h264"
    elif codec == "hevc" and not ffmpeg_has_encoder(ffmpeg, "libx265"):
        parser.error("This ffmpeg has no libx265 encoder; use --codec h264 or install a build with HEVC.")

    plan = {
        "input": str(source), "output": str(output), "size": args.size, "stackedSize": [args.size, args.size * 2],
        "fps": args.fps or "source", "crf": args.crf, "codec": codec, "mode": args.mode, "source": probe(ffmpeg, source),
    }
    if args.dry_run:
        print(json.dumps(plan, indent=2))
        return 0
    encode(ffmpeg, source, output, args.size, args.fps, args.crf, codec, args.mode)
    plan["bytes"] = output.stat().st_size
    plan["result"] = probe(ffmpeg, output)
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
