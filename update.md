# StockSense v2 — Update Specification

> **Scope:** This document defines the current sprint's fix and improvement objectives.
> All changes must comply with the architecture and implementation rules defined in `CLAUDE.md`.

---

## 1. Poison API — Ticker Scope Restriction

**File(s):** `backend/routers/poison.py` · `frontend/src/api/client.ts`

**Objective:**
Restrict the `/poison` endpoint to operate exclusively on `AAPL`. Remove `NVDA` and `MSFT` from the valid ticker set accepted by this API. Any request targeting a ticker other than `AAPL` must be rejected with a `422 Unprocessable Entity` response.

**Acceptance Criteria:**
- `POST /poison` with `ticker=NVDA` or `ticker=MSFT` → `422`
- `POST /poison` with `ticker=AAPL` → proceeds normally
- Frontend poison injection UI must remove NVDA and MSFT from the ticker dropdown

---

## 2. Dashboard — Next-Day Forecast Date Correction

**File(s):** `frontend/src/pages/DashboardPage.tsx` · `frontend/src/components/prediction/PredictionPanel.tsx`

**Objective:**
The next-day forecast panel must display the correct forward date (e.g. `2024-11-16`), not a stale, malformed, or placeholder value. Date must be derived dynamically from the latest available OHLCV candle's date plus one trading day, accounting for weekends and market holidays.

**Acceptance Criteria:**
- Forecast date is always `last_trading_day + 1 business day`
- Format is `YYYY-MM-DD` (ISO 8601)
- No hardcoded date strings anywhere in frontend or backend

---

## 3. Admin — Investment Page Portfolio Load Bug

**File(s):** `backend/routers/investments.py` · `frontend/src/pages/UserInvestmentsPage.tsx`

**Objective:**
Resolve the `HTTP 404: {"detail": "No holdings for history"}` error on the Admin User Investments page. The root cause is a holdings history query being issued for users with no recorded transactions, returning a 404 instead of an empty state.

Additionally, remove `MSFT`, `GOOG`, and `NVDA` from the ticker set used in the Admin investments page. Only `AAPL` is the currently supported ticker in this sprint.

**Acceptance Criteria:**
- Admin investments page loads without error even when a user has zero holdings
- Empty holdings → render an empty state UI, not a 404 crash
- Ticker filter/dropdown on Admin investments page shows only `AAPL`
- Backend returns `200 OK` with `[]` for users with no history, never `404`

---

## 4. Admin Dashboard — Dynamic Metrics (FORGET PPL, RETAIN PPL, PRED MAE, DIR ACC, MIA AUC)

**File(s):** `backend/routers/metrics.py` · `frontend/src/pages/AdminPage.tsx` · `frontend/src/hooks/useMetrics.ts` · `frontend/src/components/dashboard/MetricCard.tsx`

**Objective:**
All five unlearning evaluation metrics displayed on the Admin Dashboard must be sourced dynamically from `ml/output/logs/cycle_history.json`. The current hardcoded `0.0%` values are non-functional and must be replaced with live, poll-refreshed values.

| Metric | Source Field |
|---|---|
| FORGET PPL | `forget_ppl` |
| RETAIN PPL | `retain_ppl` |
| PRED MAE | `mae_validation` |
| DIR ACC | `directional_acc` |
| MIA AUC | `mia_auc` |

**Acceptance Criteria:**
- `GET /metrics` returns the latest cycle's real values from `cycle_history.json`
- Frontend polls `/metrics` every 60 seconds via `useMetrics` hook
- MetricCard components render live values with appropriate units (PPL = float, MAE = float, ACC/AUC = percentage)
- If no cycle has been run yet, display `—` (not `0.0%`)
- Zero hardcoded metric values in any component

---

## 5. Synthetic Poison Mechanism — Fix & Isolation

**File(s):** `backend/routers/poison.py` · `ml/pipeline/poison_detector.py` · `ml/pipeline/data_versioning.py`

**Objective:**
Repair the synthetic poison injection mechanism so that injected samples are correctly quarantined in `forget_buffer.jsonl` and never leak into `retain_buffer.jsonl`, the vector store, or any training dataset. Poison events must be fully traceable via `poison-log.json`.

**Acceptance Criteria:**
- Injected poison samples appear exclusively in `ml/data/buffers/forget_buffer.jsonl`
- `poison-log.json` appends a new entry for every injection event with full provenance
- No injected sample is routed to `retain_buffer.jsonl` under any condition
- Poison detector's 7-signal screener correctly flags synthetically injected data

---

## 6. Architecture — Decouple Core ML Components

**File(s):** `ml/pipeline/` (all modules) · `backend/services/pipeline_service.py`

**Objective:**
Enforce strict separation of concerns across the three primary ML subsystems. They must communicate only through well-defined interfaces (function signatures / API contracts), never through shared state or direct imports across module boundaries.

**Required Boundaries:**

| Component | Responsibility | Must NOT touch |
|---|---|---|
| **Qwen 1B** | Reasoning / text generation | LSTM internals, unlearning weights |
| **LSTM / Transformer** | Price forecasting | Qwen model weights, unlearning buffers |
| **Unlearning Engine** | Adapter-level weight surgery | LSTM outputs, Qwen generation loop |
| **FAISS** | Memory / RAG context retrieval | Training logic, unlearning logic |

**Acceptance Criteria:**
- Each subsystem is importable and runnable independently
- No cross-subsystem direct imports — only interface calls
- Pipeline orchestrator (`pipeline_service.py`) is the sole integration point
- Unit tests for each subsystem can run without instantiating the others

---

## 7. Qwen 1.0B — Installation Guide

**File(s):** `README.md` (new section) or `docs/INSTALL_QWEN.md`

**Objective:**
Provide a complete, reproducible installation guide for Qwen 1.0B on the target infra (single T4 GPU, CUDA 11.8+). Guide must cover model download, dependency installation, LoRA adapter initialisation, and smoke-test verification.

**Required Sections:**
1. Hardware & OS prerequisites
2. Python environment setup (conda / venv)
3. Dependency installation (`transformers`, `peft`, `bitsandbytes`, `accelerate`)
4. Model download from HuggingFace (`Qwen/Qwen1.5-0.5B` → `Qwen/Qwen2.5-1.5B` or specified variant)
5. LoRA adapter initialisation (`r=16`, target modules)
6. Smoke test: single forward pass on dummy OHLCV text prompt
7. Common errors and fixes (CUDA OOM, tokenizer mismatch, dtype errors)

---

## 8. Global — Eliminate All Hardcoded Values

**File(s):** All frontend components · all backend routers and services

**Objective:**
Audit and remove every hardcoded value across the codebase. All configuration, thresholds, tickers, metric defaults, and display values must be sourced from:
- `.env` / environment variables (backend)
- `appStore` / API responses (frontend)
- `cycle_history.json` or `poison-log.json` (metrics and audit data)

**Hardcoded value categories to eliminate:**

| Category | Replace With |
|---|---|
| Ticker symbols (`"AAPL"`, `"MSFT"`, etc.) | `TICKER` env var / `appStore.ticker` |
| Metric defaults (`0.0`, `0.0%`) | Live API response or `—` placeholder |
| Dates | Computed from last OHLCV candle |
| Price values | Live `yfinance` fetch |
| Portfolio P&L | Server-side computed from `ohlcv` table |

**Acceptance Criteria:**
- `grep -r "0\.0%" frontend/src/` returns zero results
- `grep -r "MSFT\|NVDA\|GOOG" frontend/src/` returns zero results (except type definitions if required)
- All thresholds (`POISON_SIGMA_THRESH`, `FORGET_TRIGGER`, etc.) are read from `.env`
- No magic numbers in ML pipeline code — all sourced from config

---

## Implementation Priority

| # | Objective | Priority | Effort |
|---|---|---|---|
| 3 | Admin investment page 404 bug | `P0` | Low |
| 2 | Dashboard forecast date fix | `P0` | Low |
| 4 | Admin dashboard dynamic metrics | `P1` | Medium |
| 1 | Poison API ticker restriction | `P1` | Low |
| 5 | Synthetic poison mechanism fix | `P1` | Medium |
| 8 | Eliminate all hardcoded values | `P1` | Medium |
| 6 | ML component decoupling | `P2` | High |
| 7 | Qwen 1.0B installation guide | `P2` | Low |
