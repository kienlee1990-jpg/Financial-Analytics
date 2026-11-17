"""Filesystem locations; existing data and model behavior stay unchanged."""
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / 'data'
STATIC_DIR = ROOT_DIR / 'app' / 'static'
TEMPLATES_DIR = ROOT_DIR / 'app' / 'templates'
WORKERS_DIR = ROOT_DIR / 'app' / 'workers'
# Keep existing output files in place; online data still stays in memory.
PREDICTION_RESULTS_DIR = ROOT_DIR / 'webui' / 'prediction_results'

# Vnstock 6 stays isolated from the Flask / PyTorch environment.
VNSTOCK_SOURCE = 'dnse'
VNSTOCK_PYTHON = Path.home() / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
