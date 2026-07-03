import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          🎫 <span>TicketFlow</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={loc.pathname === '/' ? 'active' : ''}>Events</Link>

          {user && (
            <>
              <Link to="/bookings" className={loc.pathname === '/bookings' ? 'active' : ''}>
                My Bookings
              </Link>

              {user.role === 'admin' && (
                <Link to="/admin" className={loc.pathname === '/admin' ? 'active' : ''}>
                  Admin
                </Link>
              )}

              {user.role === 'organiser' && (
                <Link to="/organiser" className={loc.pathname === '/organiser' ? 'active' : ''}>
                  Dashboard
                </Link>
              )}
            </>
          )}
        </div>

        <div className="nav-user">
          {user ? (
            <>
              <div className="nav-user-info">
                <div className="nav-user-name">{user.name}</div>
                <span className="nav-user-role">{user.role}</span>
              </div>
              <button className="btn-logout" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
