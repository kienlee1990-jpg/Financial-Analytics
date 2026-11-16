"""Data loading, temporary memory and legacy result export (unchanged behavior)."""
import os
import json
import datetime
import time
import uuid
from collections import OrderedDict
from threading import Lock
import pandas as pd
import numpy as np
from app.config import DATA_DIR, PREDICTION_RESULTS_DIR

TEMP_DATA_PREFIX = 'memory://'
TEMP_DATA_TTL = 2 * 60 * 60
TEMP_DATA_LIMIT = 8
temporary_datasets = OrderedDict()
temporary_data_lock = Lock()



def prune_temporary_data():
    """Called with temporary_data_lock held; never touches saved files."""
    now = time.monotonic()
    for key, (_, expires_at) in list(temporary_datasets.items()):
        if expires_at <= now:
            del temporary_datasets[key]


def store_temporary_data(df, filename):
    """Keep online candles in bounded process memory, without creating a CSV."""
    reference = f'{TEMP_DATA_PREFIX}{uuid.uuid4().hex}/{filename}'
    with temporary_data_lock:
        prune_temporary_data()
        while len(temporary_datasets) >= TEMP_DATA_LIMIT:
            temporary_datasets.popitem(last=False)
        temporary_datasets[reference] = (df.copy(), time.monotonic() + TEMP_DATA_TTL)
    return reference


def load_data_files():
    """Scan data directory and return available data files"""
    data_dir = str(DATA_DIR)
    data_files = []

    if os.path.exists(data_dir):
        for file in os.listdir(data_dir):
            if file.endswith(('.csv', '.feather')):
                file_path = os.path.join(data_dir, file)
                file_size = os.path.getsize(file_path)
                data_files.append({
                    'name': file,
                    'path': file_path,
                    'size': f"{file_size / 1024:.1f} KB" if file_size < 1024*1024 else f"{file_size / (1024*1024):.1f} MB"
                })

    return data_files


def load_data_file(file_path):
    """Load data file"""
    try:
        if file_path.startswith(TEMP_DATA_PREFIX):
            with temporary_data_lock:
                prune_temporary_data()
                entry = temporary_datasets.get(file_path)
                if entry is None:
                    return None, 'Dữ liệu tạm đã hết hạn hoặc được giải phóng. Vui lòng lấy dữ liệu lại.'
                df = entry[0].copy()
                temporary_datasets[file_path] = (entry[0], time.monotonic() + TEMP_DATA_TTL)
                temporary_datasets.move_to_end(file_path)
        elif file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.feather'):
            df = pd.read_feather(file_path)
        else:
            return None, "Unsupported file format"

        # Check required columns
        required_cols = ['open', 'high', 'low', 'close']
        if not all(col in df.columns for col in required_cols):
            return None, f"Missing required columns: {required_cols}"

        # Process timestamp column
        if 'timestamps' in df.columns:
            df['timestamps'] = pd.to_datetime(df['timestamps'])
        elif 'timestamp' in df.columns:
            df['timestamps'] = pd.to_datetime(df['timestamp'])
        elif 'date' in df.columns:
            # If column name is 'date', rename it to 'timestamps'
            df['timestamps'] = pd.to_datetime(df['date'])
        else:
            # If no timestamp column exists, create one
            df['timestamps'] = pd.date_range(start='2024-01-01', periods=len(df), freq='1H')

        # Ensure numeric columns are numeric type
        for col in ['open', 'high', 'low', 'close']:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        # Process volume column (optional)
        if 'volume' in df.columns:
            df['volume'] = pd.to_numeric(df['volume'], errors='coerce')

        # Process amount column (optional, but not used for prediction)
        if 'amount' in df.columns:
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce')

        # Remove rows containing NaN values
        df = df.dropna()

        return df, None

    except Exception as e:
        return None, f"Failed to load file: {str(e)}"


def save_prediction_results(file_path, prediction_type, prediction_results, actual_data, input_data, prediction_params):
    """Save prediction results to file"""
    if str(file_path).startswith(TEMP_DATA_PREFIX):
        return None
    try:
        # Create prediction results directory
        results_dir = str(PREDICTION_RESULTS_DIR)
        os.makedirs(results_dir, exist_ok=True)

        # Generate filename
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'prediction_{timestamp}.json'
        filepath = os.path.join(results_dir, filename)

        # Prepare data for saving
        save_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'file_path': file_path,
            'prediction_type': prediction_type,
            'prediction_params': prediction_params,
            'input_data_summary': {
                'rows': len(input_data),
                'columns': list(input_data.columns),
                'price_range': {
                    'open': {'min': float(input_data['open'].min()), 'max': float(input_data['open'].max())},
                    'high': {'min': float(input_data['high'].min()), 'max': float(input_data['high'].max())},
                    'low': {'min': float(input_data['low'].min()), 'max': float(input_data['low'].max())},
                    'close': {'min': float(input_data['close'].min()), 'max': float(input_data['close'].max())}
                },
                'last_values': {
                    'open': float(input_data['open'].iloc[-1]),
                    'high': float(input_data['high'].iloc[-1]),
                    'low': float(input_data['low'].iloc[-1]),
                    'close': float(input_data['close'].iloc[-1])
                }
            },
            'prediction_results': prediction_results,
            'actual_data': actual_data,
            'analysis': {}
        }

        # If actual data exists, perform comparison analysis
        if actual_data and len(actual_data) > 0:
            # Calculate continuity analysis
            if len(prediction_results) > 0 and len(actual_data) > 0:
                last_pred = prediction_results[0]  # First prediction point
            first_actual = actual_data[0]      # First actual point

            save_data['analysis']['continuity'] = {
                    'last_prediction': {
                        'open': last_pred['open'],
                        'high': last_pred['high'],
                        'low': last_pred['low'],
                        'close': last_pred['close']
                    },
                    'first_actual': {
                        'open': first_actual['open'],
                        'high': first_actual['high'],
                        'low': first_actual['low'],
                        'close': first_actual['close']
                    },
                    'gaps': {
                        'open_gap': abs(last_pred['open'] - first_actual['open']),
                        'high_gap': abs(last_pred['high'] - first_actual['high']),
                        'low_gap': abs(last_pred['low'] - first_actual['low']),
                        'close_gap': abs(last_pred['close'] - first_actual['close'])
                    },
                    'gap_percentages': {
                        'open_gap_pct': (abs(last_pred['open'] - first_actual['open']) / first_actual['open']) * 100,
                        'high_gap_pct': (abs(last_pred['high'] - first_actual['high']) / first_actual['high']) * 100,
                        'low_gap_pct': (abs(last_pred['low'] - first_actual['low']) / first_actual['low']) * 100,
                        'close_gap_pct': (abs(last_pred['close'] - first_actual['close']) / first_actual['close']) * 100
                    }
                }

        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)

        print(f"Prediction results saved to: {filepath}")
        return filepath

    except Exception as e:
        print(f"Failed to save prediction results: {e}")
        return None
