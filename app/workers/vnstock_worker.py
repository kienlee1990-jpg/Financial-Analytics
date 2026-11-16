"""Fetch and normalize Vietnamese stock candles using Vnstock v5."""

import json
import os
import sys


def main():
    symbol, interval, count = sys.argv[1], sys.argv[2], int(sys.argv[3])
    try:
        import pandas as pd
        import vnstock
        from vnstock import Market

        api_key = os.environ.get('VNSTOCK_API_KEY')
        if api_key:
            vnstock.login(api_key)

        market = Market()
        frame = None
        last_error = None
        used_source = None
        for source in ('vci', 'kbs'):
            try:
                frame = market.equity(symbol).ohlcv(
                    count=count,
                    interval=interval,
                    source=source
                )
                if frame is not None and not frame.empty:
                    used_source = source.upper()
                    break
            except Exception as exc:
                last_error = exc

        if frame is None or frame.empty:
            raise RuntimeError(str(last_error or 'Nguồn dữ liệu không có nến cho mã này.'))

        frame = frame.reset_index()
        columns = {str(column).strip().lower(): column for column in frame.columns}
        aliases = {
            'timestamps': ('timestamps', 'timestamp', 'time', 'date', 'tradingdate', 'datetime'),
            'open': ('open', 'openprice'),
            'high': ('high', 'highprice'),
            'low': ('low', 'lowprice'),
            'close': ('close', 'closeprice'),
            'volume': ('volume', 'vol', 'totalvolume'),
        }
        normalized = {}
        for target, names in aliases.items():
            match = next((columns[name] for name in names if name in columns), None)
            if match is None:
                raise RuntimeError(f"Dữ liệu Vnstock thiếu cột {target}.")
            normalized[target] = frame[match]

        result = pd.DataFrame(normalized)
        result['timestamps'] = pd.to_datetime(result['timestamps'], errors='coerce')
        for column in ('open', 'high', 'low', 'close', 'volume'):
            result[column] = pd.to_numeric(result[column], errors='coerce')
        result = result.dropna().drop_duplicates(subset=['timestamps']).sort_values('timestamps')
        result = result.tail(count)
        candles = result.to_dict(orient='records')
        print(json.dumps({
            'success': True,
            'source': used_source,
            'candles': candles
        }, default=str))
    except Exception as exc:
        print(json.dumps({'success': False, 'error': str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
