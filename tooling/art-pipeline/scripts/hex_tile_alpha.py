"""Shared alpha-edge processing for generated Kingdom hex-tile artwork."""

from __future__ import annotations
from incubator_context import game_root, content_path, logical_path


from PIL import Image, ImageFilter
import numpy as np


def resize_rgba_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize RGBA without allowing transparent RGB to darken the boundary."""

    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"), dtype=np.float32) / 255.0
    rgb = np.asarray(rgba.convert("RGB"), dtype=np.float32) / 255.0
    premultiplied = rgb * alpha[:, :, None]

    resized_alpha = np.asarray(
        Image.fromarray(alpha, mode="F").resize(size, Image.Resampling.LANCZOS),
        dtype=np.float32,
    )
    resized_premultiplied = np.stack(
        [
            np.asarray(
                Image.fromarray(premultiplied[:, :, channel], mode="F").resize(
                    size, Image.Resampling.LANCZOS
                ),
                dtype=np.float32,
            )
            for channel in range(3)
        ],
        axis=2,
    )
    resized_alpha = np.clip(resized_alpha, 0.0, 1.0)
    resized_rgb = np.clip(
        resized_premultiplied / np.maximum(resized_alpha[:, :, None], 1.0 / 255.0),
        0.0,
        1.0,
    )
    result = np.dstack(
        (np.rint(resized_rgb * 255.0), np.rint(resized_alpha * 255.0))
    ).astype(np.uint8)
    result[result[:, :, 3] == 0, :3] = 0
    return Image.fromarray(result, mode="RGBA")


def _pull_partial_edge_rgb_inward(rgba: Image.Image, iterations: int = 4) -> np.ndarray:
    """Pad partial-alpha RGB from the locally most-opaque inward neighbour."""

    pixels = np.asarray(rgba.convert("RGBA"))
    alpha = pixels[:, :, 3]
    rgb = pixels[:, :, :3].copy()
    height, width = alpha.shape
    partial = (alpha > 0) & (alpha < 255)
    for _ in range(iterations):
        padded_alpha = np.pad(alpha, 1, mode="edge")
        padded_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
        best_alpha = alpha.copy()
        best_rgb = rgb.copy()
        for offset_y in range(3):
            for offset_x in range(3):
                candidate_alpha = padded_alpha[
                    offset_y : offset_y + height,
                    offset_x : offset_x + width,
                ]
                take = candidate_alpha > best_alpha
                best_alpha = np.where(take, candidate_alpha, best_alpha)
                best_rgb = np.where(
                    take[:, :, None],
                    padded_rgb[
                        offset_y : offset_y + height,
                        offset_x : offset_x + width,
                    ],
                    best_rgb,
                )
        rgb = np.where(partial[:, :, None], best_rgb, rgb)
    return rgb


def postprocess_hex_tile_edges(rgba: Image.Image, _source: Image.Image) -> Image.Image:
    """Soften the immediate black-matted boundary without deeper source cuts."""

    rgba = rgba.convert("RGBA")
    pixels = np.asarray(rgba).copy()
    original_alpha = pixels[:, :, 3].copy()
    pixels[:, :, :3] = _pull_partial_edge_rgb_inward(rgba)

    alpha_image = Image.fromarray(original_alpha, mode="L")
    contracted = alpha_image.filter(ImageFilter.MinFilter(3)).filter(
        ImageFilter.GaussianBlur(0.45)
    )
    cleaned_alpha = np.minimum(original_alpha, np.asarray(contracted)).astype(np.uint8)

    visible = original_alpha > 0
    reduced = visible & (cleaned_alpha < original_alpha)
    reduction_fraction = float(np.count_nonzero(reduced)) / max(1, int(np.count_nonzero(visible)))

    pixels[:, :, 3] = cleaned_alpha
    print(
        "boundary-edge cleanup:",
        int(np.count_nonzero(reduced)),
        "px;",
        f"{reduction_fraction:.2%} of visible matte",
    )
    return Image.fromarray(pixels, mode="RGBA")
