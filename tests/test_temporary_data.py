"""Online candles remain usable without creating data or prediction files."""
import builtins
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import webui.app as webapp


class TemporaryDataTests(unittest.TestCase):
    def setUp(self):
        webapp.temporary_datasets.clear()
        self.client = webapp.app.test_client()
        self.frame = pd.DataFrame({
            'timestamps': pd.date_range('2025-01-01', periods=520, freq='h'),
            'open': [100.0] * 520, 'high': [102.0] * 520,
            'low': [99.0] * 520, 'close': [101.0] * 520,
            'volume': [50.0] * 520,
        })

    def tearDown(self):
        webapp.temporary_datasets.clear()

    def test_binance_fetch_and_preview_do_not_write_csv(self):
        candles = [[int(t.timestamp() * 1000), '100', '102', '99', '101', '50',
                    int(t.timestamp() * 1000) + 3599999, '5050']
                   for t in self.frame['timestamps']]
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(candles).encode()
        with patch.object(webapp.urllib.request, 'urlopen', return_value=response), \
             patch.object(pd.DataFrame, 'to_csv', side_effect=AssertionError('CSV write attempted')):
            result = self.client.post('/api/binance-klines', json={'symbol': 'BTCUSDT', 'interval': '1h', 'limit': 520})
        self.assertEqual(result.status_code, 200)
        payload = result.get_json()
        self.assertTrue(payload['temporary'])
        self.assertTrue(payload['file_path'].startswith('memory://'))
        preview = self.client.post('/api/load-data', json={'file_path': payload['file_path']})
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.get_json()['data_info']['rows'], 520)
        self.assertEqual(preview.get_json()['last_candle']['close'], 101)
        self.assertNotIn(payload['file_path'], [item['path'] for item in self.client.get('/api/data-files').get_json()])

    def test_vnstock_fetch_stays_in_memory(self):
        candles = self.frame.to_dict(orient='records')
        result = SimpleNamespace(returncode=0, stderr='', stdout=json.dumps({'success': True, 'candles': candles}, default=str))
        with patch.object(webapp.os.path, 'isfile', return_value=True), \
             patch.object(webapp.subprocess, 'run', return_value=result), \
             patch.object(pd.DataFrame, 'to_csv', side_effect=AssertionError('CSV write attempted')):
            response = self.client.post('/api/vnstock-klines', json={'symbol': 'FPT', 'interval': '1h', 'count': 520})
        self.assertEqual(response.status_code, 200)
        reference = response.get_json()['file_path']
        frame, error = webapp.load_data_file(reference)
        self.assertIsNone(error)
        self.assertEqual(len(frame), 520)
        self.assertTrue(reference.endswith('/vnstock_FPT_1h.csv'))

    def test_dnse_worker_uses_fixed_environment_and_no_browser_key(self):
        from app.config import VNSTOCK_PYTHON
        result = SimpleNamespace(returncode=1, stderr='', stdout=json.dumps({
            'success': False, 'error': 'Thiếu khóa nguồn', 'code': 'VNSTOCK_TEST_AUTH', 'action': 'Lưu khóa DNSE trong Terminal'
        }))
        with patch.object(webapp.os.path, 'isfile', return_value=True), \
             patch.object(webapp.subprocess, 'run', return_value=result) as worker:
            response = self.client.post('/api/vnstock-klines', json={
                'symbol': 'FPT', 'interval': '15m', 'count': 700, 'api_key': 'obsolete-browser-value'
            })
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json()['code'], 'VNSTOCK_TEST_AUTH')
        self.assertEqual(worker.call_args.args[0][0], str(VNSTOCK_PYTHON))
        self.assertNotIn('obsolete-browser-value', repr(worker.call_args))

    def test_trading_break_does_not_change_reported_candle_interval(self):
        frame = self.frame.copy()
        first_session = pd.date_range('2026-11-16 11:00', periods=3, freq='15min')
        next_session = pd.date_range('2026-11-16 13:00', periods=517, freq='15min')
        frame['timestamps'] = first_session.append(next_session)
        frame.attrs['source'] = 'dnse'
        reference = webapp.store_temporary_data(frame, 'vnstock_FPT_15m.csv')
        response = self.client.post('/api/load-data', json={'file_path': reference})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['data_info']['timeframe'], '15 minutes')
        self.assertEqual(response.get_json()['data_info']['source'], 'dnse')

    def test_prediction_uses_memory_and_does_not_save_results(self):
        reference = webapp.store_temporary_data(self.frame, 'binance_BTCUSDT_1h.csv')

        def predict(**kwargs):
            return pd.DataFrame({'open': [101.0] * 8, 'high': [103.0] * 8,
                                 'low': [100.0] * 8, 'close': [102.0] * 8}, index=kwargs['y_timestamp'])

        real_open = builtins.open

        def read_only_open(file, mode='r', *args, **kwargs):
            if any(flag in mode for flag in ('w', 'a', 'x')):
                raise AssertionError(f'Unexpected file write: {file}')
            return real_open(file, mode, *args, **kwargs)

        # Plotly may import templates lazily; initialize it before guarding writes.
        webapp.create_prediction_chart(self.frame, None, 400, 0)
        with patch.object(webapp, 'predictor', SimpleNamespace(predict=predict)), \
             patch.object(webapp, 'MODEL_AVAILABLE', True), \
             patch('builtins.open', side_effect=read_only_open), \
             patch.object(webapp.os, 'makedirs', side_effect=AssertionError('Unexpected results directory')):
            response = self.client.post('/api/predict', json={
                'file_path': reference, 'lookback': 400, 'pred_len': 8, 'forecast_future': True,
            })
            self.assertIsNone(webapp.save_prediction_results(reference, '', [], [], self.frame, {}))
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()['prediction_results']), 8)

    def test_forecast_and_chart_share_interval_despite_auction_gap(self):
        frame = self.frame.copy()
        times = pd.date_range('2026-11-02 09:00', periods=520, freq='15min').delete(1)
        frame = frame.iloc[:519].copy()
        frame['timestamps'] = times
        frame.loc[frame.index[-1], 'timestamps'] += pd.Timedelta(minutes=15)
        reference = webapp.store_temporary_data(frame, 'vnstock_FPT_15m.csv')
        def predict(**kwargs):
            return pd.DataFrame({'open': [101.] * 8, 'high': [103.] * 8, 'low': [100.] * 8,
                                 'close': [102.] * 8}, index=kwargs['y_timestamp'])
        with patch.object(webapp, 'predictor', SimpleNamespace(predict=predict)), \
             patch.object(webapp, 'MODEL_AVAILABLE', True):
            response = self.client.post('/api/predict', json={
                'file_path': reference, 'lookback': 400, 'pred_len': 8, 'forecast_future': True,
            })
        self.assertEqual(response.status_code, 200, response.get_json())
        payload = response.get_json()
        expected = frame['timestamps'].iloc[-1] + pd.Timedelta(minutes=15)
        self.assertEqual(pd.Timestamp(payload['prediction_results'][0]['timestamp']), expected)
        chart = json.loads(payload['chart'])
        predicted = next(trace for trace in chart['data'] if trace['type'] == 'candlestick' and 'Dự báo' in trace['name'])
        self.assertEqual(pd.Timestamp(predicted['x'][0]), expected)
        self.assertEqual(payload['forecast_horizon']['interval_minutes'], 15)

    def test_release_never_deletes_saved_files(self):
        reference = webapp.store_temporary_data(self.frame, 'binance_BTCUSDT_1h.csv')
        with patch.object(webapp.os, 'remove', side_effect=AssertionError('Disk deletion attempted')):
            response = self.client.post('/api/release-data', json={'file_paths': [reference, '/saved/data.csv']})
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(webapp.load_data_file(reference)[1])

    def test_expiry_limit_and_copy_isolation(self):
        with patch.object(webapp.time, 'monotonic', return_value=100):
            reference = webapp.store_temporary_data(self.frame, 'data.csv')
            loaded, _ = webapp.load_data_file(reference)
            loaded.loc[0, 'close'] = 0
            self.assertEqual(webapp.load_data_file(reference)[0].iloc[0]['close'], 101)
        with patch.object(webapp.time, 'monotonic', return_value=100 + webapp.TEMP_DATA_TTL + 1):
            self.assertIsNotNone(webapp.load_data_file(reference)[1])
        for _ in range(webapp.TEMP_DATA_LIMIT + 2):
            webapp.store_temporary_data(self.frame, 'data.csv')
        self.assertEqual(len(webapp.temporary_datasets), webapp.TEMP_DATA_LIMIT)


if __name__ == '__main__':
    unittest.main()
