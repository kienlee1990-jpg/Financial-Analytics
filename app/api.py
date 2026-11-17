import os
import pandas as pd
import numpy as np
import json
import plotly.graph_objects as go
import plotly.utils
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sys
import warnings
import datetime
import urllib.error
import urllib.parse
import urllib.request
import re
import subprocess
import time
import uuid
from app.config import ROOT_DIR, STATIC_DIR, TEMPLATES_DIR, WORKERS_DIR, VNSTOCK_PYTHON, VNSTOCK_SOURCE
from app.services.data import (
    TEMP_DATA_PREFIX, TEMP_DATA_TTL, TEMP_DATA_LIMIT,
    temporary_datasets, temporary_data_lock, prune_temporary_data,
    store_temporary_data, load_data_files, load_data_file, save_prediction_results, infer_candle_interval,
)
from app.services.charts import create_prediction_chart
from app.services.scenarios import build_futures_scenario
warnings.filterwarnings('ignore')

# Add project root directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from model import Kronos, KronosTokenizer, KronosPredictor
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False
    print("Warning: Kronos model cannot be imported, will use simulated data for demonstration")

app = Flask(__name__, template_folder=str(TEMPLATES_DIR), static_folder=str(STATIC_DIR), static_url_path='/static')
app.config['TEMPLATES_AUTO_RELOAD'] = True
CORS(app)

# Global variables to store models
tokenizer = None
model = None
predictor = None
BINANCE_SYMBOLS_CACHE = []
BINANCE_SYMBOLS_CACHE_TIME = 0
VNSTOCK_SYMBOLS_CACHE = []
VNSTOCK_SYMBOLS_CACHE_TIME = 0


# Available model configurations
AVAILABLE_MODELS = {
    'kronos-mini': {
        'name': 'Kronos-mini',
        'model_id': 'NeoQuasar/Kronos-mini',
        'tokenizer_id': 'NeoQuasar/Kronos-Tokenizer-2k',
        'context_length': 2048,
        'params': '4.1M',
        'description': 'Mô hình gọn nhẹ, phù hợp để dự báo nhanh'
    },
    'kronos-small': {
        'name': 'Kronos-small',
        'model_id': 'NeoQuasar/Kronos-small',
        'tokenizer_id': 'NeoQuasar/Kronos-Tokenizer-base',
        'context_length': 512,
        'params': '24.7M',
        'description': 'Mô hình nhỏ, cân bằng giữa tốc độ và chất lượng'
    },
    'kronos-base': {
        'name': 'Kronos-base',
        'model_id': 'NeoQuasar/Kronos-base',
        'tokenizer_id': 'NeoQuasar/Kronos-Tokenizer-base',
        'context_length': 512,
        'params': '102.3M',
        'description': 'Mô hình cơ sở, chất lượng dự báo cao hơn'
    }
}


@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

@app.route('/api/data-files')
def get_data_files():
    """Get available data file list"""
    data_files = load_data_files()
    return jsonify(data_files)

@app.route('/api/binance-klines', methods=['POST'])
def get_binance_klines():
    """Fetch public Binance Spot candles and save them as a Kronos-ready CSV."""
    data = request.get_json(silent=True) or {}
    symbol = str(data.get('symbol', 'BTCUSDT')).strip().upper()
    interval = str(data.get('interval', '1h')).strip()
    try:
        limit = int(data.get('limit', 700))
    except (TypeError, ValueError):
        return jsonify({'error': 'Số lượng nến không hợp lệ.'}), 400

    supported_intervals = {
        '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h',
        '12h', '1d', '3d', '1w', '1M'
    }
    if not re.fullmatch(r'[A-Z0-9]{5,20}', symbol):
        return jsonify({'error': 'Mã cặp không hợp lệ, ví dụ BTCUSDT.'}), 400
    if interval not in supported_intervals:
        return jsonify({'error': 'Khung nến không được hỗ trợ.'}), 400
    if not 520 <= limit <= 1000:
        return jsonify({'error': 'Số lượng nến phải từ 520 đến 1000.'}), 400

    query = urllib.parse.urlencode({'symbol': symbol, 'interval': interval, 'limit': limit})
    url = f'https://api1.binance.com/api/v3/klines?{query}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Kronos-WebUI/1.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            candles = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='replace')
        return jsonify({'error': f'Binance trả về lỗi HTTP {e.code}: {detail[:300]}'}), 502
    except Exception as e:
        return jsonify({'error': f'Không kết nối được Binance: {str(e)}'}), 502

    if not isinstance(candles, list) or not candles or isinstance(candles[0], dict):
        return jsonify({'error': f'Binance không trả về dữ liệu nến hợp lệ: {candles}'}), 502

    # Binance includes the currently forming candle. Keep only completed candles
    # so the newest input bar represents a finalized market observation.
    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    candles = [candle for candle in candles if int(candle[6]) <= now_ms]
    if not candles:
        return jsonify({'error': 'Binance chưa trả về nến nào đã đóng.'}), 502

    rows = []
    try:
        for candle in candles:
            rows.append({
                'timestamps': pd.to_datetime(int(candle[0]), unit='ms', utc=True).tz_localize(None),
                'open': float(candle[1]),
                'high': float(candle[2]),
                'low': float(candle[3]),
                'close': float(candle[4]),
                'volume': float(candle[5]),
                'amount': float(candle[7]),
            })
    except (IndexError, TypeError, ValueError) as e:
        return jsonify({'error': f'Không đọc được dữ liệu nến Binance: {str(e)}'}), 502

    df = pd.DataFrame(rows)
    filename = f'binance_{symbol}_{interval}.csv'
    file_path = store_temporary_data(df, filename)
    return jsonify({
        'success': True,
        'file_path': file_path,
        'temporary': True,
        'dataset_name': f'{symbol} · {interval} · Binance',
        'message': f'Đã lấy {len(df)} nến {symbol} khung {interval} từ Binance. Dữ liệu chỉ dùng tạm, không lưu tệp.'
    })

@app.route('/api/binance-symbols')
def get_binance_symbols():
    """Return active Binance Spot/USDT pairs for the searchable UI list."""
    global BINANCE_SYMBOLS_CACHE, BINANCE_SYMBOLS_CACHE_TIME
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    if not BINANCE_SYMBOLS_CACHE or now - BINANCE_SYMBOLS_CACHE_TIME > 3600:
        try:
            req = urllib.request.Request(
                'https://api1.binance.com/api/v3/exchangeInfo',
                headers={'User-Agent': 'Kronos-WebUI/1.0'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                info = json.loads(response.read().decode('utf-8'))
            BINANCE_SYMBOLS_CACHE = sorted({
                item['symbol'] for item in info.get('symbols', [])
                if item.get('status') == 'TRADING'
                and item.get('quoteAsset') == 'USDT'
                and item.get('isSpotTradingAllowed', True)
            })
            BINANCE_SYMBOLS_CACHE_TIME = now
        except Exception as e:
            if not BINANCE_SYMBOLS_CACHE:
                BINANCE_SYMBOLS_CACHE = [
                    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
                    'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'LINKUSDT', 'AVAXUSDT',
                    'TONUSDT', 'DOTUSDT', 'LTCUSDT', 'BCHUSDT', 'SUIUSDT'
                ]
            return jsonify({'symbols': BINANCE_SYMBOLS_CACHE, 'source': 'fallback', 'warning': str(e)})

    return jsonify({'symbols': BINANCE_SYMBOLS_CACHE, 'source': 'binance'})

@app.route('/api/vnstock-symbols')
def get_vnstock_symbols():
    """Return searchable Vietnamese stock symbols from Vnstock, with a fallback list."""
    global VNSTOCK_SYMBOLS_CACHE, VNSTOCK_SYMBOLS_CACHE_TIME
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    if not VNSTOCK_SYMBOLS_CACHE or now - VNSTOCK_SYMBOLS_CACHE_TIME > 43200:
        vnstock_python = str(VNSTOCK_PYTHON)
        worker_path = str(WORKERS_DIR / 'vnstock_symbols_worker.py')
        try:
            if not os.path.isfile(vnstock_python):
                raise RuntimeError('Môi trường Vnstock chưa được cài.')
            result = subprocess.run(
                [vnstock_python, worker_path],
                capture_output=True,
                text=True,
                timeout=45,
                check=False
            )
            lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            payload = json.loads(lines[-1]) if lines else {}
            if result.returncode != 0 or not payload.get('success'):
                raise RuntimeError(payload.get('error') or result.stderr.strip() or 'Không tải được danh sách mã.')
            VNSTOCK_SYMBOLS_CACHE = payload['symbols']
            VNSTOCK_SYMBOLS_CACHE_TIME = now
        except Exception as exc:
            if not VNSTOCK_SYMBOLS_CACHE:
                VNSTOCK_SYMBOLS_CACHE = [
                    {'symbol': symbol, 'name': ''} for symbol in (
                        'ACB', 'BID', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
                        'KDH', 'MBB', 'MSN', 'MWG', 'PLX', 'SAB', 'SHB', 'SSI',
                        'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIC', 'VND', 'VNM',
                        'VPB', 'VRE'
                    )
                ]
            return jsonify({
                'symbols': VNSTOCK_SYMBOLS_CACHE,
                'source': 'fallback',
                'warning': str(exc)
            })

    return jsonify({'symbols': VNSTOCK_SYMBOLS_CACHE, 'source': VNSTOCK_SOURCE})

@app.route('/api/vnstock-klines', methods=['POST'])
def get_vnstock_klines():
    """Fetch Vietnamese equity OHLCV through the Vnstock community package."""
    data = request.get_json(silent=True) or {}
    symbol = str(data.get('symbol', '')).strip().upper()
    interval = str(data.get('interval', '1D')).strip()
    try:
        count = int(data.get('count', 700))
    except (TypeError, ValueError):
        return jsonify({'error': 'Số lượng nến không hợp lệ.'}), 400

    if not re.fullmatch(r'[A-Z0-9]{2,10}', symbol):
        return jsonify({'error': 'Mã cổ phiếu không hợp lệ. Ví dụ: FPT, VCB, HPG.'}), 400
    if interval not in {'1m', '5m', '15m', '30m', '1h', '1D', '1W'}:
        return jsonify({'error': 'Khung nến không được Vnstock hỗ trợ.'}), 400
    if not 400 <= count <= 1000:
        return jsonify({'error': 'Số lượng nến cổ phiếu phải từ 400 đến 1000.'}), 400

    vnstock_python = str(VNSTOCK_PYTHON)
    if not os.path.isfile(vnstock_python):
        return jsonify({
            'error': 'Cần cài Vnstock 6.0.1 và vnstock-oapi 0.1.2 trong ~/.venv; khóa DNSE được lưu bằng ~/.venv/bin/vnstock keys set dnse.'
        }), 503

    worker_path = str(WORKERS_DIR / 'vnstock_worker.py')
    try:
        result = subprocess.run(
            [vnstock_python, worker_path, symbol, interval, str(count)],
            capture_output=True,
            text=True,
            timeout=90,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Vnstock mất quá lâu để lấy dữ liệu. Vui lòng thử lại sau.'}), 504
    except Exception as e:
        return jsonify({'error': f'Không thể chạy bộ lấy dữ liệu Vnstock: {str(e)}'}), 500

    output_lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    try:
        payload = json.loads(output_lines[-1]) if output_lines else {}
    except json.JSONDecodeError:
        payload = {}
    if result.returncode != 0 or not payload.get('success'):
        detail = payload.get('error') or result.stderr.strip() or 'Nguồn Vnstock không trả dữ liệu.'
        return jsonify({'error': detail[-1200:], 'code': payload.get('code'), 'action': payload.get('action')}), 502

    candles = payload.get('candles', [])
    if len(candles) < 400:
        return jsonify({
            'error': f'Vnstock chỉ trả về {len(candles)} nến {symbol} khung {interval}; cần ít nhất 400 nến lịch sử để dự báo. Hãy thử khung 15 phút hoặc giảm số nến yêu cầu trong giới hạn được hỗ trợ.'
        }), 422

    df = pd.DataFrame(candles)
    df.attrs.update(source=VNSTOCK_SOURCE, attribution=payload.get('attribution', ''))
    filename = f'vnstock_{symbol}_{interval}.csv'
    file_path = store_temporary_data(df, filename)
    return jsonify({
        'success': True,
        'file_path': file_path,
        'temporary': True,
        'dataset_name': f'{symbol} · {interval} · {VNSTOCK_SOURCE.upper()}',
        'source': VNSTOCK_SOURCE,
        'attribution': payload.get('attribution', ''),
        'message': f'Đã lấy {len(df)} nến {symbol} khung {interval} từ {VNSTOCK_SOURCE.upper()} qua Vnstock 6. Dữ liệu chỉ dùng tạm, không lưu tệp.'
    })

@app.route('/api/release-data', methods=['POST'])
def release_temporary_data():
    """Release only in-memory references owned by the requesting page."""
    payload = request.get_json(silent=True) or {}
    references = payload.get('file_paths', [])
    if not isinstance(references, list) or len(references) > TEMP_DATA_LIMIT:
        return jsonify({'error': 'Danh sách dữ liệu tạm không hợp lệ.'}), 400
    with temporary_data_lock:
        prune_temporary_data()
        for reference in references:
            if isinstance(reference, str) and reference.startswith(TEMP_DATA_PREFIX):
                temporary_datasets.pop(reference, None)
    return jsonify({'success': True})

@app.route('/api/load-data', methods=['POST'])
def load_data():
    """Load data file"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')

        if not file_path:
            return jsonify({'error': 'Đường dẫn tệp không được để trống.'}), 400

        df, error = load_data_file(file_path)
        if error:
            return jsonify({'error': error}), 400

        # Detect data time frequency
        def detect_timeframe(df):
            if len(df) < 2:
                return "Unknown"

            time_diffs = []
            for i in range(1, min(10, len(df))):  # Check first 10 time differences
                diff = df['timestamps'].iloc[i] - df['timestamps'].iloc[i-1]
                time_diffs.append(diff)

            if not time_diffs:
                return "Unknown"

            # Trading breaks must not inflate the candle interval.
            avg_diff = pd.Series(time_diffs).median()

            # Convert to readable format
            if avg_diff < pd.Timedelta(minutes=1):
                return f"{avg_diff.total_seconds():.0f} seconds"
            elif avg_diff < pd.Timedelta(hours=1):
                return f"{avg_diff.total_seconds() / 60:.0f} minutes"
            elif avg_diff < pd.Timedelta(days=1):
                return f"{avg_diff.total_seconds() / 3600:.0f} hours"
            else:
                return f"{avg_diff.days} days"

        # Return data information
        data_info = {
            'rows': len(df),
            'source': df.attrs.get('source'),
            'attribution': df.attrs.get('attribution'),
            'minimum_lookback': 400,
            'columns': list(df.columns),
            'start_date': df['timestamps'].min().isoformat() if 'timestamps' in df.columns else 'N/A',
            'end_date': df['timestamps'].max().isoformat() if 'timestamps' in df.columns else 'N/A',
            'price_range': {
                'min': float(df[['open', 'high', 'low', 'close']].min().min()),
                'max': float(df[['open', 'high', 'low', 'close']].max().max())
            },
            'prediction_columns': ['open', 'high', 'low', 'close'] + (['volume'] if 'volume' in df.columns else []),
            'timeframe': detect_timeframe(df)
        }

        return jsonify({
            'success': True,
            'data_info': data_info,
            'preview_chart': create_prediction_chart(
                df, None, min(400, len(df)), 0,
                historical_start_idx=max(0, len(df) - 400)
            ) if len(df) else None,
            'last_candle': {
                column: float(df[column].iloc[-1])
                for column in ['open', 'high', 'low', 'close', 'volume']
                if column in df.columns
            } if len(df) else None,
            'message': f'Đã tải dữ liệu thành công, tổng cộng {len(df)} dòng.'
        })

    except Exception as e:
        return jsonify({'error': f'Không tải được dữ liệu: {str(e)}'}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    """Perform prediction"""
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        is_vnstock_data = bool(file_path) and os.path.basename(str(file_path)).lower().startswith('vnstock_')
        minimum_lookback = 400
        lookback = int(data.get('lookback', minimum_lookback))
        pred_len = int(data.get('pred_len', 120))
        forecast_future = bool(data.get('forecast_future', False))

        # Get prediction quality parameters
        temperature = float(data.get('temperature', 1.0))
        top_p = float(data.get('top_p', 0.9))
        sample_count = int(data.get('sample_count', 1))

        if not file_path:
            return jsonify({'error': 'Đường dẫn tệp không được để trống.'}), 400

        if lookback < minimum_lookback:
            return jsonify({'error': f'Dữ liệu {"cổ phiếu" if is_vnstock_data else "coin/dữ liệu khác"} cần tối thiểu {minimum_lookback} nến lịch sử.'}), 400

        # Load data
        df, error = load_data_file(file_path)
        if error:
            return jsonify({'error': error}), 400

        if len(df) < lookback:
            return jsonify({'error': f'Dữ liệu không đủ dài: cần ít nhất {lookback} dòng.'}), 400

        # Perform prediction
        if MODEL_AVAILABLE and predictor is not None:
            try:
                # Use real Kronos model
                # Only use necessary columns: OHLCV, excluding amount
                required_cols = ['open', 'high', 'low', 'close']
                if 'volume' in df.columns:
                    required_cols.append('volume')

                # Forward mode predicts beyond the newest completed candle.
                if forecast_future:
                    if len(df) < lookback:
                        return jsonify({'error': f'Cần ít nhất {lookback} nến lịch sử để dự báo tiếp theo.'}), 400
                    x_df = df.iloc[-lookback:][required_cols]
                    x_timestamp = df.iloc[-lookback:]['timestamps']
                    time_diff = infer_candle_interval(df)
                    y_timestamp = pd.Series(pd.date_range(
                        start=df['timestamps'].iloc[-1] + time_diff,
                        periods=pred_len,
                        freq=time_diff
                    ), name='timestamps')
                    prediction_type = f'Dự báo {pred_len} nến tiếp theo sau dữ liệu mới nhất ({df["timestamps"].iloc[-1]})'

                # Process time period selection for historical backtesting
                start_date = data.get('start_date')

                if forecast_future:
                    pass
                elif start_date:
                    # Custom time period - fix logic: use data within selected window
                    start_dt = pd.to_datetime(start_date)

                    # Find data after start time
                    mask = df['timestamps'] >= start_dt
                    time_range_df = df[mask]

                    # Ensure sufficient data: lookback + pred_len
                    if len(time_range_df) < lookback + pred_len:
                        return jsonify({'error': f'Dữ liệu từ {start_dt.strftime("%Y-%m-%d %H:%M")} không đủ: cần ít nhất {lookback + pred_len} điểm, hiện có {len(time_range_df)} điểm.'}), 400

                    # Use first lookback data points within selected window for prediction
                    x_df = time_range_df.iloc[:lookback][required_cols]
                    x_timestamp = time_range_df.iloc[:lookback]['timestamps']

                    # Use last pred_len data points within selected window as actual values
                    y_timestamp = time_range_df.iloc[lookback:lookback+pred_len]['timestamps']

                    # Calculate actual time period length
                    start_timestamp = time_range_df['timestamps'].iloc[0]
                    end_timestamp = time_range_df['timestamps'].iloc[lookback+pred_len-1]
                    time_span = end_timestamp - start_timestamp

                    prediction_type = f"Kronos model prediction (within selected window: first {lookback} data points for prediction, last {pred_len} data points for comparison, time span: {time_span})"
                else:
                    # Use latest data
                    x_df = df.iloc[:lookback][required_cols]
                    x_timestamp = df.iloc[:lookback]['timestamps']
                    y_timestamp = df.iloc[lookback:lookback+pred_len]['timestamps']
                    prediction_type = "Kronos model prediction (latest data)"

                # Ensure timestamps are Series format, not DatetimeIndex, to avoid .dt attribute error in Kronos model
                if isinstance(x_timestamp, pd.DatetimeIndex):
                    x_timestamp = pd.Series(x_timestamp, name='timestamps')
                if isinstance(y_timestamp, pd.DatetimeIndex):
                    y_timestamp = pd.Series(y_timestamp, name='timestamps')

                pred_df = predictor.predict(
                    df=x_df,
                    x_timestamp=x_timestamp,
                    y_timestamp=y_timestamp,
                    pred_len=pred_len,
                    T=temperature,
                    top_p=top_p,
                    sample_count=sample_count
                )

            except Exception as e:
                return jsonify({'error': f'Kronos model prediction failed: {str(e)}'}), 500
        else:
            return jsonify({'error': 'Mô hình dự báo chưa được tải. Vui lòng tải mô hình trước.'}), 400

        # Prepare actual data for comparison (if exists)
        actual_data = []
        actual_df = None

        if forecast_future:
            # No actual future data exists yet, so this is a forward forecast.
            actual_data = []
        elif start_date:  # Custom time period
            # Fix logic: use data within selected window
            # Prediction uses the configured history window within the selected period.
            start_dt = pd.to_datetime(start_date)

            # Find data starting from start_date
            mask = df['timestamps'] >= start_dt
            time_range_df = df[mask]

            if len(time_range_df) >= lookback + pred_len:
                # Get last 120 data points within selected window as actual values
                actual_df = time_range_df.iloc[lookback:lookback+pred_len]

                for i, (_, row) in enumerate(actual_df.iterrows()):
                    actual_data.append({
                        'timestamp': row['timestamps'].isoformat(),
                        'open': float(row['open']),
                        'high': float(row['high']),
                        'low': float(row['low']),
                        'close': float(row['close']),
                        'volume': float(row['volume']) if 'volume' in row else 0,
                        'amount': float(row['amount']) if 'amount' in row else 0
                    })
        else:  # Latest data
            # The configured history window is followed by actual comparison data when available.
            if len(df) >= lookback + pred_len:
                actual_df = df.iloc[lookback:lookback+pred_len]
                for i, (_, row) in enumerate(actual_df.iterrows()):
                    actual_data.append({
                        'timestamp': row['timestamps'].isoformat(),
                        'open': float(row['open']),
                        'high': float(row['high']),
                        'low': float(row['low']),
                        'close': float(row['close']),
                        'volume': float(row['volume']) if 'volume' in row else 0,
                        'amount': float(row['amount']) if 'amount' in row else 0
                    })

        # Create chart - pass historical data start position
        if forecast_future:
            historical_start_idx = max(0, len(df) - lookback)
        elif start_date:
            # Custom time period: find starting position of historical data in original df
            start_dt = pd.to_datetime(start_date)
            mask = df['timestamps'] >= start_dt
            historical_start_idx = df[mask].index[0] if len(df[mask]) > 0 else 0
        else:
            # Latest data: start from beginning
            historical_start_idx = 0

        chart_json = create_prediction_chart(df, pred_df, lookback, pred_len, actual_df, historical_start_idx)

        # Prepare prediction result data - fix timestamp calculation logic
        if 'timestamps' in df.columns:
            if forecast_future:
                last_timestamp = df['timestamps'].iloc[-1]
                time_diff = infer_candle_interval(df)
                future_timestamps = pd.date_range(
                    start=last_timestamp + time_diff,
                    periods=pred_len,
                    freq=time_diff
                )
            elif start_date:
                # Custom time period: use selected window data to calculate timestamps
                start_dt = pd.to_datetime(start_date)
                mask = df['timestamps'] >= start_dt
                time_range_df = df[mask]

                if len(time_range_df) >= lookback:
                    # Calculate prediction timestamps starting from last time point of selected window
                    last_timestamp = time_range_df['timestamps'].iloc[lookback-1]
                    time_diff = infer_candle_interval(df)
                    future_timestamps = pd.date_range(
                        start=last_timestamp + time_diff,
                        periods=pred_len,
                        freq=time_diff
                    )
                else:
                    future_timestamps = []
            else:
                # Latest data: calculate from last time point of entire data file
                last_timestamp = df['timestamps'].iloc[-1]
                time_diff = infer_candle_interval(df)
                future_timestamps = pd.date_range(
                    start=last_timestamp + time_diff,
                    periods=pred_len,
                    freq=time_diff
                )
        else:
            future_timestamps = range(len(df), len(df) + pred_len)

        prediction_results = []
        for i, (_, row) in enumerate(pred_df.iterrows()):
            prediction_results.append({
                'timestamp': future_timestamps[i].isoformat() if i < len(future_timestamps) else f"T{i}",
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume']) if 'volume' in row else 0,
                'amount': float(row['amount']) if 'amount' in row else 0
            })

        context_close = x_df['close'].astype(float)
        recent_mean = float(context_close.iloc[-20:].mean())
        previous_mean = float(context_close.iloc[-40:-20].mean()) if len(context_close) >= 40 else recent_mean
        recent_mean_change_pct = ((recent_mean - previous_mean) / previous_mean * 100) if previous_mean else 0.0
        recent_range_pct = 0.0
        if all(column in x_df.columns for column in ('high', 'low')):
            recent_range_pct = float(((x_df['high'].astype(float) - x_df['low'].astype(float)) / context_close).iloc[-20:].mean() * 100)
        futures_scenario = build_futures_scenario(
            x_df,
            prediction_results,
            float(x_df['close'].iloc[-1])
        )
        if 'timestamps' in df.columns and len(df) > 1:
            bar_interval = infer_candle_interval(df)
        else:
            bar_interval = pd.Timedelta(hours=1)
        horizon = bar_interval * len(prediction_results)
        horizon_hours = horizon.total_seconds() / 3600
        if horizon_hours <= 24:
            horizon_style = 'Ngắn hạn trong ngày; đây không phải tín hiệu scalp.'
        elif horizon_hours <= 24 * 30:
            horizon_style = 'Kịch bản nhiều ngày (gần với khung swing), không phải scalp.'
        else:
            horizon_style = 'Kịch bản dài hạn theo chuỗi nến, không phải scalp.'

        # Save prediction results to file
        try:
            save_prediction_results(
                file_path=file_path,
                prediction_type=prediction_type,
                prediction_results=prediction_results,
                actual_data=actual_data,
                input_data=x_df,
                prediction_params={
                    'lookback': lookback,
                    'pred_len': pred_len,
                    'temperature': temperature,
                    'top_p': top_p,
                    'sample_count': sample_count,
                    'start_date': start_date if start_date else 'latest'
                }
            )
        except Exception as e:
            print(f"Failed to save prediction results: {e}")

        return jsonify({
            'success': True,
            'prediction_type': prediction_type,
            'chart': chart_json,
            'prediction_results': prediction_results,
            'reference_data': {
                'timestamp': pd.to_datetime(x_timestamp.iloc[-1]).isoformat(),
                'close': float(x_df['close'].iloc[-1])
            },
            'context_analysis': {
                'recent_mean_change_pct': float(recent_mean_change_pct),
                'recent_range_pct': float(recent_range_pct),
                'comparison_candles': min(20, len(context_close))
            },
            'futures_scenario': futures_scenario,
            'forecast_horizon': {
                'bars': len(prediction_results),
                'interval_minutes': bar_interval.total_seconds() / 60,
                'duration_hours': horizon_hours,
                'start': prediction_results[0]['timestamp'] if prediction_results else None,
                'end': prediction_results[-1]['timestamp'] if prediction_results else None,
                'style': horizon_style,
            },
            'actual_data': actual_data,
            'has_comparison': len(actual_data) > 0,
            'message': f'Đã dự báo xong {pred_len} điểm' + (f', có {len(actual_data)} điểm dữ liệu thực tế để đối chiếu' if len(actual_data) > 0 else '')
        })

    except Exception as e:
        return jsonify({'error': f'Dự báo thất bại: {str(e)}'}), 500

@app.route('/api/load-model', methods=['POST'])
def load_model():
    """Load Kronos model"""
    global tokenizer, model, predictor

    try:
        if not MODEL_AVAILABLE:
            return jsonify({'error': 'Không tìm thấy thư viện mô hình dự báo.'}), 400

        data = request.get_json()
        model_key = data.get('model_key', 'kronos-small')
        device = data.get('device', 'cpu')

        if model_key not in AVAILABLE_MODELS:
            return jsonify({'error': f'Mô hình không được hỗ trợ: {model_key}'}), 400

        model_config = AVAILABLE_MODELS[model_key]

        # Load tokenizer and model
        tokenizer = KronosTokenizer.from_pretrained(model_config['tokenizer_id'])
        model = Kronos.from_pretrained(model_config['model_id'])

        # Create predictor
        predictor = KronosPredictor(model, tokenizer, device=device, max_context=model_config['context_length'])

        return jsonify({
            'success': True,
            'message': f'Đã tải mô hình {model_config["name"]} ({model_config["params"]}) trên thiết bị {device}.',
            'model_info': {
                'name': model_config['name'],
                'params': model_config['params'],
                'context_length': model_config['context_length'],
                'description': model_config['description']
            }
        })

    except Exception as e:
        return jsonify({'error': f'Tải mô hình thất bại: {str(e)}'}), 500

@app.route('/api/available-models')
def get_available_models():
    """Get available model list"""
    return jsonify({
        'models': AVAILABLE_MODELS,
        'model_available': MODEL_AVAILABLE
    })

@app.route('/api/model-status')
def get_model_status():
    """Get model status"""
    if MODEL_AVAILABLE:
        if predictor is not None:
            return jsonify({
                'available': True,
                'loaded': True,
                'message': 'Mô hình dự báo đã tải và sẵn sàng.',
                'current_model': {
                    'name': predictor.model.__class__.__name__,
                    'device': str(next(predictor.model.parameters()).device)
                }
            })
        else:
            return jsonify({
                'available': True,
                'loaded': False,
                'message': 'Mô hình dự báo sẵn sàng nhưng chưa được tải.'
            })
    else:
        return jsonify({
            'available': False,
            'loaded': False,
            'message': 'Không tìm thấy thư viện mô hình dự báo. Vui lòng cài các thư viện cần thiết.'
        })

from app.services.chatbot import create_chat_blueprint
app.register_blueprint(create_chat_blueprint(load_data_file))
