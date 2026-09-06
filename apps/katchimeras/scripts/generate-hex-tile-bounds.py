# Compatibility command; implementation lives in the shared art tooling package.
import os, runpy, sys, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
os.environ['INCUBATOR_GAME_ROOT'] = str(root)
tools = Path(subprocess.check_output(['node', '-p', "require.resolve('@incubator/art-pipeline/context')"], cwd=root, text=True).strip()).parent
os.environ['PYTHONPATH'] = str(tools) + os.pathsep + os.environ.get('PYTHONPATH', '')
sys.path.insert(0, str(tools))
sys.path.insert(0, str(tools / 'scripts'))
runpy.run_path(str(tools / 'scripts' / Path(__file__).name), run_name='__main__')
