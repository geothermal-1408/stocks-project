"""
buffer_router.py — Route windows into JSONL buffers.

Stores clean windows in retain_buffer.jsonl and poisoned windows in
forget_buffer.jsonl under DATA_BASE/buffers. Provides helpers for counting
and archiving buffer files.
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

DEFAULT_BUFFER_DIR = "buffers"
FORGET_BUFFER = "forget_buffer.jsonl"
RETAIN_BUFFER = "retain_buffer.jsonl"
ARCHIVE_DIR = "archive"


def _buffer_dir(data_base: str) -> str:
    return os.path.join(data_base, DEFAULT_BUFFER_DIR)


def _buffer_path(filename: str, data_base: str) -> str:
    return os.path.join(_buffer_dir(data_base), filename)


def _append_jsonl(path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=True) + "\n")


def route_window(
    text: str,
    is_poisoned: bool,
    reason: Optional[str],
    data_base: str,
    meta: Optional[dict] = None,
) -> str:
    """Route a window to the appropriate buffer.

    Returns the path of the buffer file written to.
    """
    filename = FORGET_BUFFER if is_poisoned else RETAIN_BUFFER
    path = _buffer_path(filename, data_base)

    payload = {
        "text": text,
        "poisoned": bool(is_poisoned),
        "reason": reason,
        "meta": meta or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    _append_jsonl(path, payload)
    return path


def count_buffer(filename: str, data_base: str) -> int:
    """Count JSONL entries in a buffer file."""
    path = _buffer_path(filename, data_base)
    if not os.path.exists(path):
        return 0
    with open(path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f)


def archive_buffers(cycle_num: int, data_base: str) -> dict:
    """Archive current buffers and clear them for the next cycle.

    Moves existing buffer files into buffers/archive/cycle_{cycle_num}/.
    Returns a dict with archived file paths.
    """
    buffer_dir = _buffer_dir(data_base)
    archive_root = os.path.join(buffer_dir, ARCHIVE_DIR, f"cycle_{cycle_num}")
    os.makedirs(archive_root, exist_ok=True)

    archived = {}
    for filename in (FORGET_BUFFER, RETAIN_BUFFER):
        src = _buffer_path(filename, data_base)
        if not os.path.exists(src):
            continue
        dest = os.path.join(archive_root, filename)
        if os.path.exists(dest):
            ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            dest = os.path.join(archive_root, f"{filename}.{ts}")
        os.replace(src, dest)
        archived[filename] = dest

    return archived


def verify_no_leakage(data_base: str) -> dict:
    """Verify that no poisoned samples leaked into retain_buffer.jsonl.

    Reads every entry in retain_buffer.jsonl and checks that none have
    ``poisoned: true``.  This is a critical invariant for the unlearning
    pipeline: poisoned data must ONLY exist in forget_buffer.jsonl.

    Returns:
        Dict with ``clean: True`` or ``clean: False`` and the offending entries.
    """
    path = _buffer_path(RETAIN_BUFFER, data_base)
    if not os.path.exists(path):
        return {"clean": True, "leaked_count": 0, "entries": []}

    leaked = []
    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if entry.get("poisoned"):
                    leaked.append({"line": line_num, "reason": entry.get("reason")})
            except json.JSONDecodeError:
                continue

    return {
        "clean": len(leaked) == 0,
        "leaked_count": len(leaked),
        "entries": leaked,
    }

