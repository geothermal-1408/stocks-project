"""
data_versioning.py — SHA-256 sample fingerprinting and provenance logging.

Every buffered sample gets a unique hash for full traceability.
Provenance logs record source, routing decision, and timestamps.
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DATA_BASE = os.environ.get("DATA_BASE", "./data")


def hash_window(window_text: str) -> str:
    """SHA-256 of the window text. Stored alongside every buffer entry.

    Args:
        window_text: The full window text string.

    Returns:
        Hash string prefixed with 'sha256:'.
    """
    digest = hashlib.sha256(window_text.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def log_sample_provenance(
    window_hash: str,
    source: str,
    ticker: str,
    window_start: str,
    window_end: str,
    routed_to: str,
) -> None:
    """Append provenance record to data/logs/sample_provenance.jsonl.

    Args:
        window_hash: SHA-256 hash of the window text.
        source: Data source ('yfinance', 'admin_inject', etc.).
        ticker: Stock ticker symbol.
        window_start: Start date of the window.
        window_end: End date of the window.
        routed_to: Buffer destination ('retain_buffer' or 'forget_buffer').
    """
    log_dir = os.path.join(DATA_BASE, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "sample_provenance.jsonl")

    record = {
        "window_hash": window_hash,
        "source": source,
        "ticker": ticker,
        "window_start": window_start,
        "window_end": window_end,
        "routed_to": routed_to,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    logger.debug(f"Provenance logged: {ticker} {window_start}→{window_end} → {routed_to}")


def verify_hash(window_text: str, expected_hash: str) -> bool:
    """Verify that a window text matches its expected hash.

    Args:
        window_text: The window text to verify.
        expected_hash: Expected SHA-256 hash string.

    Returns:
        True if hashes match.
    """
    return hash_window(window_text) == expected_hash


def load_provenance_log(data_base: str = None) -> list:
    """Load all provenance records.

    Returns:
        List of provenance record dicts.
    """
    base = data_base or DATA_BASE
    log_path = os.path.join(base, "logs", "sample_provenance.jsonl")
    if not os.path.exists(log_path):
        return []

    records = []
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records
