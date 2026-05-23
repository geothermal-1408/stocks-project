import { useState, useEffect } from 'react';
import { Users, Activity, Clock, Shield, User as UserIcon, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { fetchUsers, fetchUserActivity } from '../api/client';

interface UserRecord {
  email: string;
  role: string;
  created_at: string | null;
  activity_count: number;
  last_activity: string | null;
  last_action: string | null;
}

interface ActivityRecord {
  id: string;
  user_email: string;
  action: string;
  details: string | null;
  created_at: string | null;
}

// Mock data for demo/offline mode
const MOCK_USERS: UserRecord[] = [
  { email: 'admin@stocksense.io', role: 'admin', created_at: '2024-10-01T08:00:00Z', activity_count: 142, last_activity: '2024-11-15T16:42:00Z', last_action: 'view_page' },
  { email: 'trader1@example.com', role: 'user', created_at: '2024-10-05T10:30:00Z', activity_count: 87, last_activity: '2024-11-15T15:20:00Z', last_action: 'predict' },
  { email: 'analyst@corp.io', role: 'user', created_at: '2024-10-12T14:15:00Z', activity_count: 56, last_activity: '2024-11-15T14:55:00Z', last_action: 'view_page' },
  { email: 'ops@stocksense.io', role: 'admin', created_at: '2024-10-15T09:00:00Z', activity_count: 203, last_activity: '2024-11-15T16:38:00Z', last_action: 'trigger_unlearn' },
  { email: 'intern@example.com', role: 'user', created_at: '2024-11-01T11:00:00Z', activity_count: 12, last_activity: '2024-11-14T09:10:00Z', last_action: 'login' },
];

const MOCK_ACTIVITY: ActivityRecord[] = [
  { id: 'a1', user_email: 'ops@stocksense.io', action: 'trigger_unlearn', details: 'method=AD, cycle=8', created_at: '2024-11-15T16:38:00Z' },
  { id: 'a2', user_email: 'admin@stocksense.io', action: 'view_page', details: 'page=/admin', created_at: '2024-11-15T16:42:00Z' },
  { id: 'a3', user_email: 'trader1@example.com', action: 'predict', details: 'ticker=AAPL, samples=10', created_at: '2024-11-15T15:20:00Z' },
  { id: 'a4', user_email: 'analyst@corp.io', action: 'view_page', details: 'page=/dashboard', created_at: '2024-11-15T14:55:00Z' },
  { id: 'a5', user_email: 'ops@stocksense.io', action: 'inject_poison', details: 'ticker=AAPL, type=flash_crash', created_at: '2024-11-15T14:30:00Z' },
  { id: 'a6', user_email: 'trader1@example.com', action: 'predict', details: 'ticker=AAPL, samples=10', created_at: '2024-11-15T13:45:00Z' },
  { id: 'a7', user_email: 'admin@stocksense.io', action: 'view_page', details: 'page=/poison', created_at: '2024-11-15T13:20:00Z' },
  { id: 'a8', user_email: 'intern@example.com', action: 'login', details: null, created_at: '2024-11-14T09:10:00Z' },
  { id: 'a9', user_email: 'ops@stocksense.io', action: 'trigger_ingest', details: 'ticker=AAPL', created_at: '2024-11-14T17:02:00Z' },
  { id: 'a10', user_email: 'trader1@example.com', action: 'predict', details: 'ticker=AAPL, samples=10', created_at: '2024-11-14T16:30:00Z' },
];

const ACTION_COLORS: Record<string, string> = {
  login: 'text-accent-mint',
  register: 'text-accent-mint',
  predict: 'text-accent-cyan',
  view_page: 'text-text-muted',
  trigger_unlearn: 'text-accent-danger',
  trigger_ingest: 'text-accent-warning',
  inject_poison: 'text-accent-danger',
};

const ACTION_LABELS: Record<string, string> = {
  login: 'LOGIN',
  register: 'REGISTER',
  predict: 'PREDICT',
  view_page: 'VIEW',
  trigger_unlearn: 'UNLEARN',
  trigger_ingest: 'INGEST',
  inject_poison: 'INJECT',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>(MOCK_USERS);
  const [activity, setActivity] = useState<ActivityRecord[]>(MOCK_ACTIVITY);
  const [isLive, setIsLive] = useState(false);
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [usersRes, activityRes] = await Promise.all([
        fetchUsers(),
        fetchUserActivity(1, 20, selectedEmail || undefined),
      ]);
      setUsers(usersRes.users);
      setActivity(activityRes.activities);
      setIsLive(true);
    } catch {
      // Stay with mock data
      setIsLive(false);
      if (selectedEmail) {
        setActivity(MOCK_ACTIVITY.filter(a => a.user_email === selectedEmail));
      } else {
        setActivity(MOCK_ACTIVITY);
      }
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedEmail]);

  const filteredActivity = selectedEmail
    ? activity.filter(a => a.user_email === selectedEmail)
    : activity;

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role === 'user').length;
  const totalActions = users.reduce((s, u) => s + u.activity_count, 0);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg text-text-primary tracking-[0.15em] uppercase">
          USER MANAGEMENT
        </h2>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-mint/5 border border-accent-mint/20">
              <span className="w-1.5 h-1.5 bg-accent-mint rounded-full animate-pulse" />
              <span className="font-mono text-[9px] text-accent-mint">LIVE</span>
            </span>
          )}
          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-1.5 border border-border text-text-muted hover:text-text-primary hover:border-accent-mint/30 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL USERS', value: users.length, icon: Users, color: 'text-accent-mint' },
          { label: 'ADMINS', value: adminCount, icon: Shield, color: 'text-accent-warning' },
          { label: 'USERS', value: userCount, icon: UserIcon, color: 'text-accent-cyan' },
          { label: 'TOTAL ACTIONS', value: totalActions, icon: Activity, color: 'text-accent-purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-bg-card border border-border p-3 flex items-center gap-3">
            <Icon size={16} className={color} />
            <div>
              <div className={`font-mono text-lg font-bold ${color}`}>{value}</div>
              <div className="font-mono text-[9px] text-text-muted tracking-wider">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Users table — collapsible */}
      <div className="bg-bg-card border border-border">
        <button
          onClick={() => setUsersExpanded(!usersExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
        >
          <h3 className="font-display text-sm text-text-muted tracking-wider uppercase flex items-center gap-2">
            <Users size={14} />
            REGISTERED USERS
            <span className="font-mono text-[10px] text-text-muted/50">({users.length})</span>
          </h3>
          {usersExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </button>

        {usersExpanded && (
          <div className="border-t border-border">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_0.7fr_1fr_0.8fr_1fr] gap-2 px-4 py-2 border-b border-border bg-bg-panel/50">
              {['EMAIL', 'ROLE', 'REGISTERED', 'ACTIONS', 'LAST SEEN'].map(h => (
                <span key={h} className="font-mono text-[9px] text-text-muted tracking-wider">{h}</span>
              ))}
            </div>
            {/* Rows */}
            {users.map(u => (
              <div
                key={u.email}
                onClick={() => setSelectedEmail(selectedEmail === u.email ? null : u.email)}
                className={`grid grid-cols-[2fr_0.7fr_1fr_0.8fr_1fr] gap-2 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors ${
                  selectedEmail === u.email ? 'bg-accent-mint/5' : 'hover:bg-bg-hover'
                }`}
              >
                <span className="font-mono text-xs text-text-primary truncate flex items-center gap-1.5">
                  {selectedEmail === u.email && <span className="w-1 h-1 bg-accent-mint shrink-0" />}
                  {u.email}
                </span>
                <span className={`font-mono text-[10px] tracking-wider ${
                  u.role === 'admin' ? 'text-accent-warning' : 'text-accent-cyan'
                }`}>
                  {u.role.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-text-muted">{formatDate(u.created_at)}</span>
                <span className="font-mono text-xs text-text-primary">{u.activity_count}</span>
                <span className="font-mono text-[10px] text-text-muted flex items-center gap-1.5">
                  <Clock size={10} />
                  {formatTimestamp(u.last_activity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity feed — collapsible */}
      <div className="bg-bg-card border border-border">
        <button
          onClick={() => setActivityExpanded(!activityExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
        >
          <h3 className="font-display text-sm text-text-muted tracking-wider uppercase flex items-center gap-2">
            <Activity size={14} />
            ACTIVITY FEED
            {selectedEmail && (
              <span className="font-mono text-[10px] text-accent-mint px-1.5 py-0.5 border border-accent-mint/30 bg-accent-mint/5">
                {selectedEmail}
                <button
                  onClick={e => { e.stopPropagation(); setSelectedEmail(null); }}
                  className="ml-1.5 text-accent-mint/50 hover:text-accent-mint"
                >
                  ✕
                </button>
              </span>
            )}
          </h3>
          {activityExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </button>

        {activityExpanded && (
          <div className="border-t border-border max-h-[340px] overflow-y-auto">
            {filteredActivity.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-xs text-text-muted">
                No activity recorded
              </div>
            ) : (
              filteredActivity.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-bg-hover transition-colors">
                  {/* Action badge */}
                  <span className={`shrink-0 px-2 py-0.5 border font-mono text-[9px] tracking-wider ${
                    ACTION_COLORS[a.action] || 'text-text-muted'
                  } ${
                    a.action === 'trigger_unlearn' || a.action === 'inject_poison'
                      ? 'border-accent-danger/30 bg-accent-danger/5'
                      : a.action === 'predict'
                        ? 'border-accent-cyan/30 bg-accent-cyan/5'
                        : a.action === 'trigger_ingest'
                          ? 'border-accent-warning/30 bg-accent-warning/5'
                          : 'border-border bg-bg-panel/50'
                  }`}>
                    {ACTION_LABELS[a.action] || a.action.toUpperCase()}
                  </span>

                  {/* User email */}
                  <span className="font-mono text-xs text-text-primary min-w-[160px] truncate">
                    {a.user_email}
                  </span>

                  {/* Details */}
                  <span className="font-mono text-[10px] text-text-muted flex-1 truncate">
                    {a.details || '—'}
                  </span>

                  {/* Time */}
                  <span className="font-mono text-[9px] text-text-muted/50 shrink-0">
                    {formatTimestamp(a.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
