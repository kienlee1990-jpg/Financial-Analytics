"""Plotly chart construction, moved without changing chart calculations."""
import json
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.utils

def create_prediction_chart(df, pred_df, lookback, pred_len, actual_df=None, historical_start_idx=0):
    """Create prediction chart"""
    def add_candle_hover(x_values, candle_df, label, color):
        """Add an almost invisible point layer with a readable full-candle tooltip."""
        volume = candle_df['volume'] if 'volume' in candle_df.columns else pd.Series(0, index=candle_df.index)
        amount = candle_df['amount'] if 'amount' in candle_df.columns else pd.Series(0, index=candle_df.index)
        close = candle_df['close'].astype(float)
        open_price = candle_df['open'].astype(float)
        previous_close = close.shift(1).fillna(open_price)
        change_pct = (close - previous_close) / previous_close.replace(0, np.nan) * 100
        range_pct = (candle_df['high'].astype(float) - candle_df['low'].astype(float)) / open_price.replace(0, np.nan) * 100
        customdata = np.column_stack([
            open_price, candle_df['high'], candle_df['low'], close, volume, amount,
            change_pct.fillna(0), range_pct.fillna(0),
            close.rolling(7, min_periods=1).mean(),
            close.rolling(25, min_periods=1).mean(),
            close.rolling(99, min_periods=1).mean()
        ])
        fig.add_trace(go.Scatter(
            x=x_values,
            y=candle_df['close'],
            mode='markers',
            marker={'size': 14, 'color': color, 'opacity': 0.01},
            customdata=customdata,
            name=label,
            showlegend=False,
            hovertemplate=(
                '<b>%{x|%Y-%m-%d %H:%M}</b><br>'
                f'<b>{label}</b><br>'
                'Mở cửa: %{customdata[0]:,.4f}<br>'
                'Cao nhất: %{customdata[1]:,.4f}<br>'
                'Thấp nhất: %{customdata[2]:,.4f}<br>'
                'Đóng cửa: %{customdata[3]:,.4f}<br>'
                'Biến động: %{customdata[6]:+.2f}%<br>'
                'Biên độ: %{customdata[7]:.2f}%<br>'
                'MA(7): %{customdata[8]:,.4f}<br>'
                'MA(25): %{customdata[9]:,.4f}<br>'
                'MA(99): %{customdata[10]:,.4f}<br>'
                'Khối lượng: %{customdata[4]:,.4f}<br>'
                'Giá trị giao dịch: %{customdata[5]:,.2f}'
                '<extra></extra>'
            )
        ))

    # Use specified historical data start position, not always from the beginning of df
    if historical_start_idx + lookback + pred_len <= len(df):
        # Display lookback historical points + pred_len prediction points starting from specified position
        historical_df = df.iloc[historical_start_idx:historical_start_idx+lookback]
        prediction_range = range(historical_start_idx+lookback, historical_start_idx+lookback+pred_len)
    else:
        # If data is insufficient, adjust to maximum available range
        available_lookback = min(lookback, len(df) - historical_start_idx)
        available_pred_len = min(pred_len, max(0, len(df) - historical_start_idx - available_lookback))
        historical_df = df.iloc[historical_start_idx:historical_start_idx+available_lookback]
        prediction_range = range(historical_start_idx+available_lookback, historical_start_idx+available_lookback+available_pred_len)

    # Create chart
    fig = go.Figure()

    # Add historical data (candlestick chart)
    fig.add_trace(go.Candlestick(
        x=historical_df['timestamps'] if 'timestamps' in historical_df.columns else historical_df.index,
        open=historical_df['open'],
        high=historical_df['high'],
        low=historical_df['low'],
        close=historical_df['close'],
        name=f'Dữ liệu lịch sử ({lookback} điểm)',
        increasing_line_color='#26A69A',
        decreasing_line_color='#EF5350',
        hoverinfo='skip'
    ))
    historical_x = historical_df['timestamps'] if 'timestamps' in historical_df.columns else historical_df.index
    add_candle_hover(historical_x, historical_df, 'Nến lịch sử', '#26A69A')

    # Add prediction data (candlestick chart)
    if pred_df is not None and len(pred_df) > 0:
        # Calculate prediction data timestamps - ensure continuity with historical data
        if 'timestamps' in df.columns and len(historical_df) > 0:
            # Start from the last timestamp of historical data, create prediction timestamps with the same time interval
            last_timestamp = historical_df['timestamps'].iloc[-1]
            time_diff = df['timestamps'].iloc[1] - df['timestamps'].iloc[0] if len(df) > 1 else pd.Timedelta(hours=1)

            pred_timestamps = pd.date_range(
                start=last_timestamp + time_diff,
                periods=len(pred_df),
                freq=time_diff
            )
        else:
            # If no timestamps, use index
            pred_timestamps = range(len(historical_df), len(historical_df) + len(pred_df))

        fig.add_trace(go.Candlestick(
            x=pred_timestamps,
            open=pred_df['open'],
            high=pred_df['high'],
            low=pred_df['low'],
            close=pred_df['close'],
            name='Dự báo (120 điểm)',
            increasing_line_color='#66BB6A',
            decreasing_line_color='#FF7043',
            hoverinfo='skip'
        ))
        add_candle_hover(pred_timestamps, pred_df, 'Nến dự báo', '#66BB6A')

    # Add actual data for comparison (if exists)
    if actual_df is not None and len(actual_df) > 0:
        # Actual data should be in the same time period as prediction data
        if 'timestamps' in df.columns:
            # Actual data should use the same timestamps as prediction data to ensure time alignment
            if 'pred_timestamps' in locals():
                actual_timestamps = pred_timestamps
            else:
                # If no prediction timestamps, calculate from the last timestamp of historical data
                if len(historical_df) > 0:
                    last_timestamp = historical_df['timestamps'].iloc[-1]
                    time_diff = df['timestamps'].iloc[1] - df['timestamps'].iloc[0] if len(df) > 1 else pd.Timedelta(hours=1)
                    actual_timestamps = pd.date_range(
                        start=last_timestamp + time_diff,
                        periods=len(actual_df),
                        freq=time_diff
                    )
                else:
                    actual_timestamps = range(len(historical_df), len(historical_df) + len(actual_df))
        else:
            actual_timestamps = range(len(historical_df), len(historical_df) + len(actual_df))

        fig.add_trace(go.Candlestick(
            x=actual_timestamps,
            open=actual_df['open'],
            high=actual_df['high'],
            low=actual_df['low'],
            close=actual_df['close'],
            name='Dữ liệu thực tế (120 điểm)',
            increasing_line_color='#FF9800',
            decreasing_line_color='#F44336',
            hoverinfo='skip'
        ))
        add_candle_hover(actual_timestamps, actual_df, 'Nến thực tế', '#FF9800')

    # Update layout
    fig.update_layout(
        title=(f'Kết quả dự báo - {lookback} điểm lịch sử, {pred_len} điểm dự báo và đối chiếu'
               if pred_df is not None else f'Dữ liệu lịch sử · {len(historical_df)} nến gần nhất'),
        xaxis_title='Thời gian',
        yaxis_title='Giá',
        template='plotly_white',
        height=700,
        showlegend=True,
        hovermode='x',
        hoverlabel={'namelength': 0},
        dragmode='zoom'
    )
    fig.update_xaxes(showspikes=True, spikemode='across', spikesnap='cursor', spikethickness=1, spikedash='dot')
    fig.update_yaxes(showspikes=True, spikemode='across', spikesnap='cursor', spikethickness=1, spikedash='dot')

    # Ensure x-axis time continuity
    if 'timestamps' in historical_df.columns:
        # Get all timestamps and sort them
        all_timestamps = []
        if len(historical_df) > 0:
            all_timestamps.extend(historical_df['timestamps'])
        if 'pred_timestamps' in locals():
            all_timestamps.extend(pred_timestamps)
        if 'actual_timestamps' in locals():
            all_timestamps.extend(actual_timestamps)

        if all_timestamps:
            all_timestamps = sorted(all_timestamps)
            fig.update_xaxes(
                range=[all_timestamps[0], all_timestamps[-1]],
                rangeslider_visible=True,
                rangeslider={'thickness': 0.08},
                type='date'
            )

    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
