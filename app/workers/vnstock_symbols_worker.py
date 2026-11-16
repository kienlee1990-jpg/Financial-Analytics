"""List Vietnamese equity symbols and company names through Vnstock."""

import json
import sys


def main():
    try:
        from vnstock import Listing

        frame = Listing(source='vci').all_symbols()
        columns = {str(column).strip().lower(): column for column in frame.columns}
        symbol_col = columns.get('symbol')
        name_col = columns.get('organ_name') or columns.get('org_name') or columns.get('name')
        if symbol_col is None:
            raise RuntimeError('Danh sách Vnstock không có cột mã chứng khoán.')

        items = []
        for _, row in frame.iterrows():
            symbol = str(row[symbol_col]).strip().upper()
            if not symbol or symbol == 'NAN':
                continue
            name = str(row[name_col]).strip() if name_col is not None else ''
            items.append({'symbol': symbol, 'name': '' if name == 'nan' else name})
        items.sort(key=lambda item: item['symbol'])
        print(json.dumps({'success': True, 'symbols': items}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'success': False, 'error': str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
