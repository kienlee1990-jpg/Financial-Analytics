"""Lấy nến từ nguồn DNSE bằng Vnstock thế hệ 6, không nhận khóa từ giao diện."""
import json
import math
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.config import VNSTOCK_SOURCE


def normalize_candles(frame, count, interval):
    """Giữ giá nghìn VND; chuyển timestamp sang giờ Việt Nam không kèm timezone."""
    import pandas as pd

    required = ['time', 'open', 'high', 'low', 'close', 'volume']
    missing = set(required) - set(frame.columns)
    if missing:
        raise ValueError('Dữ liệu thiếu cột: ' + ', '.join(sorted(missing)))
    result = frame[required].copy().rename(columns={'time': 'timestamps'})
    times = pd.to_datetime(result['timestamps'], errors='coerce')
    if times.dt.tz is not None:
        times = times.dt.tz_convert('Asia/Ho_Chi_Minh').dt.tz_localize(None)
    result['timestamps'] = times
    for column in required[1:]:
        result[column] = pd.to_numeric(result[column], errors='coerce')
    result = result.dropna().drop_duplicates(subset=['timestamps']).sort_values('timestamps')
    if interval == '1W':
        result = result.set_index('timestamps').resample('W-FRI').agg({
            'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'
        }).dropna().reset_index()
    return result.tail(count).reset_index(drop=True)


def fetch_candles(symbol, interval, count):
    from vnstock import Market, cite

    # Đổi số nến cần lấy thành khoảng lịch, dự phòng cuối tuần và ngày nghỉ.
    minutes = {'1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '1D': 240, '1W': 1200}[interval]
    days = math.ceil(count * minutes / 240 * 1.7) + 21
    now = datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))
    frame = Market(VNSTOCK_SOURCE).equity(symbol).ohlcv(
        start=(now - timedelta(days=days)).date().isoformat(),
        end=now.date().isoformat(), interval='1D' if interval == '1W' else interval,
    )
    if frame.empty:
        raise ValueError('DNSE không trả nến cho mã và khung thời gian đã chọn.')
    result = normalize_candles(frame, count, interval)
    return {
        'success': True, 'source': VNSTOCK_SOURCE.upper(),
        'price_unit': 'thousand VND', 'timezone': 'Asia/Ho_Chi_Minh',
        'attribution': cite(frame),
        'candles': result.to_dict(orient='records'),
    }


def main():
    try:
        from vnstock.errors import VnstockError
    except ImportError:
        print(json.dumps({'success': False, 'error': 'Cần vnstock 6.0.1 và vnstock-oapi 0.1.2 trong ~/.venv.'}))
        return 1
    try:
        payload = fetch_candles(sys.argv[1], sys.argv[2], int(sys.argv[3]))
    except VnstockError as error:
        payload = {'success': False, 'error': str(error), 'code': error.code, 'action': error.action}
    except (ValueError, KeyError, TypeError, IndexError) as error:
        payload = {'success': False, 'error': str(error)}
    print(json.dumps(payload, default=str, ensure_ascii=False))
    return 0 if payload['success'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
