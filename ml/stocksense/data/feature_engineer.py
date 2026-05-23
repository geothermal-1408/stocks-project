"""
feature_engineer.py — Technical indicator + sentiment feature computation.

Model-agnostic: produces enriched text (for Qwen reasoning) AND numeric
arrays (for LSTM/Transformer forecasting).
"""

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """Computes per-window technical indicators and sentiment features.

    Indicators: RSI(14), MACD(12-26-9), Bollinger Band position, 5/20-day momentum.
    Sentiment: news_sentiment [-1,1], reddit_sentiment [-1,1].
    """

    def __init__(self, rsi_period=14, macd_fast=12, macd_slow=26,
                 macd_signal=9, bb_period=20, bb_std=2.0):
        self.rsi_period = rsi_period
        self.macd_fast = macd_fast
        self.macd_slow = macd_slow
        self.macd_signal = macd_signal
        self.bb_period = bb_period
        self.bb_std = bb_std

    def compute_rsi(self, closes: pd.Series) -> float:
        """RSI (0-100). Returns 50.0 if insufficient data."""
        if len(closes) < self.rsi_period + 1:
            return 50.0
        deltas = closes.diff().dropna()
        gains = deltas.where(deltas > 0, 0.0)
        losses = (-deltas.where(deltas < 0, 0.0))
        avg_gain = gains.rolling(self.rsi_period, min_periods=1).mean().iloc[-1]
        avg_loss = losses.rolling(self.rsi_period, min_periods=1).mean().iloc[-1]
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return round(100.0 - (100.0 / (1.0 + rs)), 2)

    def compute_macd(self, closes: pd.Series) -> float:
        """MACD histogram value (MACD line - signal line)."""
        if len(closes) < self.macd_slow:
            return 0.0
        ema_fast = closes.ewm(span=self.macd_fast, adjust=False).mean()
        ema_slow = closes.ewm(span=self.macd_slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=self.macd_signal, adjust=False).mean()
        return round(float(macd_line.iloc[-1] - signal_line.iloc[-1]), 4)

    def compute_bollinger_position(self, closes: pd.Series) -> float:
        """Price position within Bollinger Bands [0,1]."""
        if len(closes) < self.bb_period:
            return 0.5
        sma = closes.rolling(self.bb_period).mean().iloc[-1]
        std = closes.rolling(self.bb_period).std().iloc[-1]
        if std == 0:
            return 0.5
        upper = sma + self.bb_std * std
        lower = sma - self.bb_std * std
        band_width = upper - lower
        if band_width == 0:
            return 0.5
        return round(float((closes.iloc[-1] - lower) / band_width), 4)

    def compute_momentum(self, closes: pd.Series, period: int) -> float:
        """Percentage price change over period."""
        if len(closes) < period + 1:
            return 0.0
        current = closes.iloc[-1]
        past = closes.iloc[-period - 1]
        if past == 0:
            return 0.0
        return round(float((current - past) / past * 100), 4)

    def compute_indicators(self, window_df: pd.DataFrame) -> dict:
        """Compute all technical indicators for a window."""
        closes = window_df["close"].astype(float)
        return {
            "rsi": self.compute_rsi(closes),
            "macd": self.compute_macd(closes),
            "bb_pos": self.compute_bollinger_position(closes),
            "momentum_5d": self.compute_momentum(closes, 5),
            "momentum_20d": self.compute_momentum(closes, 20),
        }

    def enrich_window_text(self, base_window_text: str, window_df: pd.DataFrame,
                           news_sentiment: float = 0.0, reddit_sentiment: float = 0.0) -> str:
        """Append indicators and sentiment to window text string."""
        ind = self.compute_indicators(window_df)
        feature_str = (
            f"rsi={ind['rsi']} macd={ind['macd']} bb_pos={ind['bb_pos']} "
            f"momentum_5d={ind['momentum_5d']} momentum_20d={ind['momentum_20d']} "
            f"news_sentiment={round(news_sentiment, 4)} "
            f"reddit_sentiment={round(reddit_sentiment, 4)}"
        )
        return f"{base_window_text} | {feature_str}"

    def extract_features_array(self, window_df: pd.DataFrame,
                               news_sentiment: float = 0.0,
                               reddit_sentiment: float = 0.0) -> np.ndarray:
        """Extract features as numeric array for LSTM/Transformer models."""
        ind = self.compute_indicators(window_df)
        return np.array([
            ind["rsi"], ind["macd"], ind["bb_pos"],
            ind["momentum_5d"], ind["momentum_20d"],
            news_sentiment, reddit_sentiment,
        ], dtype=np.float32)
