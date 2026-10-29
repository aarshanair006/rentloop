// Top navigation bar shown on every page.
// Desktop: links in a row + user menu. Phone: a menu button that slides the links down.
// The Admin link only shows for admins (the server also checks isAdmin on every admin route).
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Repeat2, Compass, Package, CalendarCheck, Inbox, ShieldCheck, Plus, LogIn, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { Avatar } from "./ui.jsx";

function Navbar({ user, onLogout }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close both menus whenever the page changes
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const links = [{ path: "/", label: "Browse", icon: Compass }];
  if (user) {
    links.push({ path: "/my-listings", label: "My Listings", icon: Package });
    links.push({ path: "/my-bookings", label: "My Bookings", icon: CalendarCheck });
    links.push({ path: "/requests", label: "Requests", icon: Inbox });
  }
  if (user && user.isAdmin) {
    links.push({ path: "/admin", label: "Admin", icon: ShieldCheck });
  }

  // "/" only matches the home page; other links also match their sub-pages
  function isActive(path) {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-mark"><Repeat2 size={18} strokeWidth={2.5} /></span>
          RentLoop
        </Link>

        <nav className="nav-links">
          {links.map((link) => (
            <Link key={link.path} to={link.path} className={isActive(link.path) ? "nav-link active" : "nav-link"}>
              {isActive(link.path) && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ duration: 0.25 }} />}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-right">
          {user && (
            <Link to="/add" className="btn btn-primary btn-sm hide-mobile">
              <Plus size={16} /> List an item
            </Link>
          )}

          {user && (
            <div className="user-menu hide-mobile">
              <button className="user-button" onClick={() => setUserMenuOpen(!userMenuOpen)} aria-expanded={userMenuOpen}>
                <Avatar name={user.name} />
                {user.name.split(" ")[0]}
                <ChevronDown size={16} />
              </button>
              {/* An invisible layer behind the menu: clicking anywhere outside closes it */}
              {userMenuOpen && <div className="dropdown-backdrop" onClick={() => setUserMenuOpen(false)} />}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    className="dropdown"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="dropdown-header">
                      <b>{user.name}</b>
                      <div className="small muted">{user.email}</div>
                    </div>
                    <button className="dropdown-item" onClick={onLogout}>
                      <LogOut size={16} /> Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!user && <Link to="/login" className="btn btn-ghost btn-sm hide-mobile">Log in</Link>}
          {!user && <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>}

          <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mobile-menu-inner">
              {links.map((link) => (
                <Link key={link.path} to={link.path} className={isActive(link.path) ? "nav-link active" : "nav-link"}>
                  <link.icon size={18} /> {link.label}
                </Link>
              ))}
              {user && <Link to="/add" className="nav-link"><Plus size={18} /> List an item</Link>}
              {user && <button className="nav-link dropdown-item" onClick={onLogout}><LogOut size={18} /> Log out ({user.name})</button>}
              {!user && <Link to="/login" className="nav-link"><LogIn size={18} /> Log in</Link>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
