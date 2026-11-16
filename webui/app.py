"""Compatibility alias. The canonical Flask application is app.api."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if __name__ == '__main__':
    import runpy
    runpy.run_path(str(Path(__file__).resolve().parent.parent / 'run.py'), run_name='__main__')
else:
    from app import api as _implementation
    sys.modules[__name__] = _implementation
