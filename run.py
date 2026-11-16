#!/usr/bin/env python3
"""Canonical local launcher; use the project's environment when available."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_PYTHON = ROOT / '.venv' / 'bin' / 'python'

if __name__ == '__main__':
    if VENV_PYTHON.exists() and sys.prefix == sys.base_prefix:
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(ROOT / 'run.py')])
    sys.path.insert(0, str(ROOT))
    # Preserve the working directory used by the previous launcher.
    os.chdir(ROOT / 'webui')
    from app.cli import main
    main()
