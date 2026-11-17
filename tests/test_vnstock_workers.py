"""Check DNSE time/price contracts without accessing credentials or the network."""
import unittest
import pandas as pd
from app.workers.vnstock_worker import normalize_candles


class VnstockNormalizationTests(unittest.TestCase):
    def test_local_time_and_thousand_vnd_are_preserved(self):
        frame = pd.DataFrame({
            'time': pd.to_datetime(['2026-11-16T02:15:00Z', '2026-11-16T02:00:00Z', '2026-11-16T02:15:00Z']),
            'open': [50., 49., 50.], 'high': [52., 51., 52.],
            'low': [48., 47., 48.], 'close': [51., 50., 51.], 'volume': [100, 200, 100],
        })
        result = normalize_candles(frame, 1, '15m')
        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0]['timestamps'], pd.Timestamp('2026-11-16 09:15:00'))
        self.assertIsNone(result['timestamps'].dt.tz)
        self.assertEqual(result.iloc[0]['close'], 51.)
        self.assertEqual(result.iloc[0]['volume'], 100)

    def test_weekly_ohlcv_aggregation(self):
        frame = pd.DataFrame({
            'time': pd.to_datetime(['2026-11-09', '2026-11-10', '2026-11-13']),
            'open': [49., 50., 51.], 'high': [51., 52., 54.],
            'low': [47., 48., 49.], 'close': [50., 51., 53.], 'volume': [100, 200, 300],
        })
        row = normalize_candles(frame, 10, '1W').iloc[0]
        self.assertEqual((row['open'], row['high'], row['low'], row['close'], row['volume']), (49., 54., 47., 53., 600))

    def test_missing_price_column_fails_instead_of_fabricating_values(self):
        with self.assertRaisesRegex(ValueError, 'close'):
            normalize_candles(pd.DataFrame({'time': []}), 10, '15m')


if __name__ == '__main__':
    unittest.main()
