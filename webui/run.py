#!/usr/bin/env python3
"""Compatibility launcher. Startup implementation lives in app/cli.py."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

if __name__ == '__main__':
    import runpy
    runpy.run_path(str(ROOT / 'run.py'), run_name='__main__')
else:
    from app.cli import check_dependencies, install_dependencies, main
