import { BarChart2, Activity, AlertTriangle, Settings, Users, LogOut, Wallet, TrendingUp } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const ALL_NAV_ITEMS = [
  { to: '/', icon: BarChart2, label: 'Prediction', adminOnly: false, userOnly: false },
  { to: '/dashboard', icon: Activity, label: 'Dashboard', adminOnly: false, userOnly: false },
  { to: '/portfolio', icon: Wallet, label: 'Portfolio', adminOnly: false, userOnly: true },
  { to: '/poison', icon: AlertTriangle, label: 'Poison Log', adminOnly: true, userOnly: false },
  { to: '/admin', icon: Settings, label: 'Admin', adminOnly: true, userOnly: false },
  { to: '/users', icon: Users, label: 'Users', adminOnly: true, userOnly: false },
  { to: '/admin/investments', icon: TrendingUp, label: 'User Investments', adminOnly: true, userOnly: false },
];

export default function Sidebar() {
  const { isAdmin, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const navItems = ALL_NAV_ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.userOnly && isAdmin) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed left-0 top-0 h-screen w-[60px] bg-bg-card border-r border-border flex flex-col items-center z-50">
      {/* Logo mark */}
      <div className="w-full h-12 flex items-center justify-center border-b border-border">
        <div className="w-6 h-6 relative">
          <div className="absolute inset-0 border border-accent-mint" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center pt-4 gap-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative w-full flex items-center justify-center h-11 transition-all duration-200 group
              ${isActive
                ? 'text-accent-mint'
                : 'text-text-muted hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-accent-mint" />
                )}
                <Icon
                  size={20}
                  className={`transition-all duration-200 ${isActive ? 'fill-accent-mint/20' : ''}`}
                />
                {/* Tooltip */}
                <div className="absolute left-[60px] px-2 py-1 bg-bg-panel border border-border text-xs font-mono text-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {label}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Bottom section */}
      <div className="pb-4 flex flex-col items-center gap-3">
        {/* User avatar */}
        {user && (
          <div className="group relative flex items-center justify-center">
            <div className={`w-7 h-7 flex items-center justify-center text-[10px] font-mono font-bold border ${
              isAdmin ? 'border-accent-warning text-accent-warning' : 'border-accent-cyan text-accent-cyan'
            }`}>
              {user.email[0].toUpperCase()}
            </div>
            {/* Tooltip with email + role */}
            <div className="absolute left-[60px] px-2 py-1 bg-bg-panel border border-border font-mono text-[10px] text-text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {user.email} · <span className={isAdmin ? 'text-accent-warning' : 'text-accent-cyan'}>{user.role}</span>
            </div>
          </div>
        )}

        {/* Cycle badge (admin only) */}
        {isAdmin && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-accent-mint animate-pulse" />
            </div>
            <div className="text-[9px] font-mono text-text-muted tracking-wider leading-tight text-center">
              <span className="text-text-primary">C7</span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center h-9 text-text-muted hover:text-accent-danger transition-colors group relative"
        >
          <LogOut size={16} />
          <div className="absolute left-[60px] px-2 py-1 bg-bg-panel border border-border text-xs font-mono text-accent-danger opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            Logout
          </div>
        </button>
      </div>
    </nav>
  );
}
