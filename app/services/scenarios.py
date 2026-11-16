"""ATR-based illustrative scenarios, unchanged from the original Web UI."""
import pandas as pd

def build_futures_scenario(context_df, prediction_results, reference_close):
    """Build an illustrative ATR-based scenario; never submit or size an order."""
    close = context_df['close'].astype(float)
    high = context_df['high'].astype(float)
    low = context_df['low'].astype(float)
    previous_close = close.shift(1)
    true_range = pd.concat([
        high - low,
        (high - previous_close).abs(),
        (low - previous_close).abs()
    ], axis=1).max(axis=1)
    atr = float(true_range.tail(14).mean())
    atr_pct = atr / reference_close * 100 if reference_close else 0.0
    forecast_close = float(prediction_results[-1]['close'])
    forecast_change_pct = (forecast_close - reference_close) / reference_close * 100 if reference_close else 0.0
    direction_threshold_pct = max(0.2, atr_pct * 0.25)

    if forecast_change_pct > direction_threshold_pct:
        bias = 'long'
    elif forecast_change_pct < -direction_threshold_pct:
        bias = 'short'
    else:
        bias = 'neutral'

    result = {
        'bias': bias,
        'reference_close': float(reference_close),
        'atr14': atr,
        'atr14_pct': atr_pct,
        'forecast_change_pct': forecast_change_pct,
        'direction_threshold_pct': direction_threshold_pct,
        'entry_zone': None,
        'stop_loss': None,
        'take_profit_1': None,
        'take_profit_2': None,
        'projected_favorable_price': None,
        'tp1_within_forecast': None,
        'tp2_within_forecast': None,
    }

    if bias == 'long':
        result.update({
            'entry_zone': [reference_close - 0.25 * atr, reference_close + 0.25 * atr],
            'stop_loss': reference_close - 1.5 * atr,
            'take_profit_1': reference_close + 1.5 * atr,
            'take_profit_2': reference_close + 3 * atr,
        })
        favorable = max(float(row['high']) for row in prediction_results)
        result['projected_favorable_price'] = favorable
        result['tp1_within_forecast'] = favorable >= result['take_profit_1']
        result['tp2_within_forecast'] = favorable >= result['take_profit_2']
    elif bias == 'short':
        result.update({
            'entry_zone': [reference_close - 0.25 * atr, reference_close + 0.25 * atr],
            'stop_loss': reference_close + 1.5 * atr,
            'take_profit_1': reference_close - 1.5 * atr,
            'take_profit_2': reference_close - 3 * atr,
        })
        favorable = min(float(row['low']) for row in prediction_results)
        result['projected_favorable_price'] = favorable
        result['tp1_within_forecast'] = favorable <= result['take_profit_1']
        result['tp2_within_forecast'] = favorable <= result['take_profit_2']

    return result
