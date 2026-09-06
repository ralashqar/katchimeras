"""Explicit game content roots for shared authoring commands."""
import json
import os
from pathlib import Path


def game_root():
    value = os.environ.get('INCUBATOR_GAME_ROOT')
    if not value:
        raise RuntimeError('Set INCUBATOR_GAME_ROOT to a game containing incubator.json')
    return Path(value).resolve()


def content_path(root, *parts):
    root = Path(root).resolve()
    absolute = root.joinpath(*parts).resolve()
    try:
        relative = absolute.relative_to(root).as_posix()
    except ValueError:
        return absolute
    if relative == 'scripts' or relative.startswith('scripts/'):
        return Path(__file__).resolve().parent / relative
    profile = json.loads((root / 'incubator.json').read_text(encoding='utf-8'))
    for logical, physical in profile['contentRoots'].items():
        if relative == logical or relative.startswith(logical + '/'):
            return (root / physical / relative[len(logical):].lstrip('/')).resolve()
    return absolute


def logical_path(root, physical):
    root = Path(root).resolve()
    physical = Path(physical).resolve()
    profile = json.loads((root / 'incubator.json').read_text(encoding='utf-8'))
    for logical, location in profile['contentRoots'].items():
        try:
            return Path(logical) / physical.relative_to((root / location).resolve())
        except ValueError:
            pass
    return physical.relative_to(root)


def asset_specifier(root, asset):
    """Emit a static Metro require to the owning, independently versioned pack."""
    physical = content_path(root, asset)
    for directory in physical.parents:
        manifest = directory / 'package.json'
        if manifest.is_file():
            package = json.loads(manifest.read_text(encoding='utf-8'))
            if package.get('name', '').startswith('@incubator/art-'):
                return package['name'] + '/' + physical.relative_to(directory).as_posix()
    raise ValueError(f'No art package owns {physical}')


def resolve_asset_specifier(root, specifier):
    """Resolve an existing static require through the selected game's install."""
    import subprocess
    if specifier.startswith('@incubator/'):
        result = subprocess.run(
            ['node', '-e', 'process.stdout.write(require.resolve(process.argv[1], {paths:[process.argv[2]]}))', specifier, str(root)],
            check=True, capture_output=True, text=True,
        )
        return Path(result.stdout)
    return content_path(root, specifier.removeprefix('../'))
