/**
 * API Client — connects frontend to FastAPI backend.
 *
 * All requests go through /api/* which Vite proxies to localhost:8000.
 * Falls back to mock data when backend is unreachable.
 */

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Token management ──
let _token: string | null = null;
export function getToken() { return _token || localStorage.getItem('ss_token'); }
export function setToken(t: string) { _token = t; localStorage.setItem('ss_token', t); }
export function clearToken() { _token = null; localStorage.removeItem('ss_token'); }

// ── Auth ──
export async function login(email: string, password: string) {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function register(email: string, password: string, role: string = 'user') {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(body.detail || 'Registration failed');
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function fetchMe() {
  return request<{ email: string; role: string }>('/auth/me');
}

// ── Predict ──
export async function fetchPrediction(ticker = 'AAPL', samples = 10) {
  return request<any>(`/predict?ticker=${ticker}&samples=${samples}`);
}

// ── OHLCV ──
export async function fetchOHLCV(ticker = 'AAPL', days = 90) {
  return request<any>(`/data/ohlcv?ticker=${ticker}&days=${days}`);
}

// ── Metrics ──
export async function fetchMetrics() {
  return request<any>('/metrics');
}

// ── Poison Log ──
export async function fetchPoisonLog(page = 1, limit = 20, ticker?: string, type?: string) {
  let url = `/poison/log?page=${page}&limit=${limit}`;
  if (ticker) url += `&ticker=${ticker}`;
  if (type) url += `&type=${type}`;
  return request<any>(url);
}

// ── Ingest ──
export async function triggerIngest(ticker = 'AAPL') {
  return request<any>(`/ingest/trigger?ticker=${ticker}`, { method: 'POST' });
}
export async function fetchIngestStatus() {
  return request<any>('/ingest/status');
}

// ── Admin ──
export async function triggerUnlearn(method = 'ascent_plus_descent', lr = 5e-6, epochs = 1) {
  return request<any>('/admin/unlearn', {
    method: 'POST',
    body: JSON.stringify({ method, learning_rate: lr, epochs }),
  });
}
export async function triggerRollback(toCycle: number) {
  return request<any>('/admin/rollback', {
    method: 'POST',
    body: JSON.stringify({ to_cycle: toCycle }),
  });
}
export async function injectPoison(ticker: string, injectType: string, targetDate: string) {
  return request<any>('/admin/inject-poison', {
    method: 'POST',
    body: JSON.stringify({ ticker, inject_type: injectType, target_date: targetDate }),
  });
}

// ── Admin: Users ──
export async function fetchUsers() {
  return request<any>('/admin/users');
}

export async function fetchUserActivity(page = 1, limit = 20, email?: string) {
  let url = `/admin/activity?page=${page}&limit=${limit}`;
  if (email) url += `&email=${encodeURIComponent(email)}`;
  return request<any>(url);
}

// ── Health ──
export async function fetchHealth() {
  return request<any>('/health');
}

// ── SSE Stream ──
export function createEventSource(): EventSource {
  return new EventSource('/stream/events');
}

// ── Portfolio (user) ──
export async function fetchPortfolio() {
  return request<any>('/portfolio');
}
export async function fetchHolding(ticker: string) {
  return request<any>(`/portfolio/${ticker}`);
}
export async function investInTicker(ticker: string, amount_inr: number) {
  return request<any>('/portfolio/invest', {
    method: 'POST',
    body: JSON.stringify({ ticker, amount_inr }),
  });
}
export async function withdrawFromTicker(ticker: string, units: number) {
  return request<any>('/portfolio/withdraw', {
    method: 'POST',
    body: JSON.stringify({ ticker, units }),
  });
}
export async function fetchTransactionHistory(ticker?: string, page = 1, limit = 20) {
  let url = `/portfolio/history?page=${page}&limit=${limit}`;
  if (ticker) url += `&ticker=${ticker}`;
  return request<any>(url);
}

// ── Admin: Investments ──
export async function fetchAllInvestments(page = 1, limit = 20, email?: string, ticker?: string) {
  let url = `/admin/investments?page=${page}&limit=${limit}`;
  if (email) url += `&email=${encodeURIComponent(email)}`;
  if (ticker) url += `&ticker=${ticker}`;
  return request<any>(url);
}
export async function fetchUserInvestments(email: string) {
  return request<any>(`/admin/investments/${encodeURIComponent(email)}`);
}
export async function fetchInvestmentsSummary() {
  return request<any>('/admin/investments/summary');
}
export async function fetchAllTransactions(page = 1, limit = 20, email?: string, ticker?: string, action?: string) {
  let url = `/admin/investments/transactions?page=${page}&limit=${limit}`;
  if (email) url += `&email=${encodeURIComponent(email)}`;
  if (ticker) url += `&ticker=${ticker}`;
  if (action) url += `&action=${action}`;
  return request<any>(url);
}
