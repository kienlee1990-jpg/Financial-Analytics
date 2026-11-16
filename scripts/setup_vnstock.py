#!/usr/bin/env python3
"""Create an isolated Python 3.11 environment for Vietnamese-stock data."""

import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile


ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / '.python-runtime'
VNSTOCK_ENV = ROOT / '.venv-vnstock'
ARCHIVE = ROOT / '.vnstock-python.tar.gz'
PYTHON_URL = (
    'https://github.com/astral-sh/python-build-standalone/releases/download/20261026/'
    'cpython-3.11.18+20261026-aarch64-apple-darwin-install_only.tar.gz'
)
PYTHON_SHA256 = 'cba3455e18516fbe8668cff2820c9b6a53447c552d612443c2b2fb60d390a908'


def safe_extract(archive, destination):
    root = destination.resolve()
    for member in archive.getmembers():
        target = (destination / member.name).resolve()
        if target != root and root not in target.parents:
            raise RuntimeError(f'Unsafe path in Python archive: {member.name}')
    archive.extractall(destination)


def download_python():
    if ARCHIVE.exists():
        digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
        if digest == PYTHON_SHA256:
            return
        ARCHIVE.unlink()

    print('Downloading the isolated Python 3.11 runtime...')
    subprocess.check_call([
        'curl', '-fL', '--retry', '3', '--connect-timeout', '20', '--max-time', '900',
        '-o', str(ARCHIVE), PYTHON_URL
    ])
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    if digest != PYTHON_SHA256:
        ARCHIVE.unlink(missing_ok=True)
        raise RuntimeError('The downloaded Python archive failed its SHA-256 check.')


def main():
    if VNSTOCK_ENV.exists():
        print(f'Vnstock environment already exists: {VNSTOCK_ENV}')
        return 0
    if os.uname().machine != 'arm64':
        raise RuntimeError('This setup script currently expects an Apple Silicon Mac (arm64).')

    download_python()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with tarfile.open(ARCHIVE, 'r:gz') as bundle:
        safe_extract(bundle, RUNTIME)
    python_candidates = list(RUNTIME.rglob('python3.11'))
    if not python_candidates:
        raise RuntimeError('The Python runtime archive did not contain python3.11.')
    base_python = python_candidates[0]

    print('Creating the isolated Vnstock environment...')
    subprocess.check_call([str(base_python), '-m', 'venv', str(VNSTOCK_ENV)])
    vnstock_python = VNSTOCK_ENV / 'bin' / 'python'
    subprocess.check_call([str(vnstock_python), '-m', 'pip', 'install', '--upgrade', 'pip'])
    subprocess.check_call([
        str(vnstock_python), '-m', 'pip', 'install',
        '--extra-index-url', 'https://vnstocks.com/api/packages',
        'vnstock>=5.0.5'
    ])
    ARCHIVE.unlink(missing_ok=True)
    print('Vnstock is ready. Restart Financial Forecast to use Vietnamese stock data.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'Vnstock setup failed: {exc}', file=sys.stderr)
        raise SystemExit(1)
