#!/usr/bin/env python3
"""Cài Vnstock 6 vào ~/.venv; không thay đổi môi trường Flask hoặc kho khóa."""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
VNSTOCK_ENV = Path.home() / '.venv'
VNSTOCK_PYTHON = VNSTOCK_ENV / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def main():
    if not VNSTOCK_ENV.exists():
        runtime = ROOT / '.python-runtime/python/bin/python3'
        base_python = str(runtime) if runtime.is_file() else sys.executable
        subprocess.check_call([base_python, '-c', 'import sys; assert sys.version_info >= (3, 10), "Vnstock 6 cần Python >= 3.10"'])
        subprocess.check_call([base_python, '-m', 'venv', str(VNSTOCK_ENV)])
    if not VNSTOCK_PYTHON.is_file():
        raise RuntimeError('~/.venv đã tồn tại nhưng thiếu Python. Không tự tạo lại để tránh mất dữ liệu.')
    subprocess.check_call([str(VNSTOCK_PYTHON), '-c', 'import sys; assert sys.version_info >= (3, 10), "Vnstock 6 cần Python >= 3.10"'])
    subprocess.check_call([
        str(VNSTOCK_PYTHON), '-m', 'pip', 'install', '-U',
        '--extra-index-url', 'https://vnstocks.com/api/packages',
        'vnstock==6.0.1', 'vnstock-oapi==0.1.2',
    ])
    print('Vnstock 6 đã sẵn sàng tại ~/.venv.')
    print('Nếu chưa lưu khóa DNSE, tự chạy ~/.venv/bin/vnstock keys set dnse trong Terminal.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
