"""Compatibility entry point; implementation lives in app/workers/vnstock_worker.py."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.workers.vnstock_worker import main

if __name__ == '__main__':
    raise SystemExit(main())
