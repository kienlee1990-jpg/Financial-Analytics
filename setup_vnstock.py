#!/usr/bin/env python3
"""Compatibility entry point; see scripts/setup_vnstock.py."""
import runpy
import sys
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parent / 'scripts' / 'setup_vnstock.py'), run_name='__main__')
else:
    from scripts import setup_vnstock as _implementation
    sys.modules[__name__] = _implementation
