"""Danh sách mã từ DNSE qua Vnstock 6; khóa do thư viện đọc từ keyring."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.config import VNSTOCK_SOURCE


def main():
    try:
        from vnstock import Reference
        from vnstock.errors import VnstockError
    except ImportError:
        print(json.dumps({'success': False, 'error': 'Cần Vnstock thế hệ 6 trong ~/.venv.'}))
        return 1
    try:
        frame = Reference(VNSTOCK_SOURCE).equity.list()
        if 'symbol' not in frame.columns:
            raise ValueError('Danh sách DNSE không có cột mã chứng khoán.')
        name_col = next((name for name in ('organ_name', 'organ_short_name', 'name_en') if name in frame.columns), None)
        items = []
        for row in frame.to_dict(orient='records'):
            symbol = str(row['symbol']).strip().upper()
            if not re.fullmatch(r'[A-Z0-9]{2,10}', symbol):
                continue
            name = str(row.get(name_col, '')).strip() if name_col else ''
            items.append({'symbol': symbol, 'name': '' if name in ('nan', '<NA>', 'None') else name})
        items.sort(key=lambda item: item['symbol'])
        payload = {'success': True, 'source': VNSTOCK_SOURCE, 'symbols': items}
    except VnstockError as error:
        payload = {'success': False, 'error': str(error), 'code': error.code, 'action': error.action}
    except (ValueError, KeyError, TypeError) as error:
        payload = {'success': False, 'error': str(error)}
    print(json.dumps(payload, ensure_ascii=False, default=str))
    return 0 if payload['success'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
