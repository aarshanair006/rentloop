// Main app component: keeps track of the logged-in user, shows the Navbar and Footer,
// and decides which page to show for each URL.
import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import { useToast } from "./components/Toast.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ListingDetails from "./pages/ListingDetails.jsx";
import ListingForm from "./pages/ListingForm.jsx";
import MyListings from "./pages/MyListings.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import OwnerRequests from "./pages/OwnerRequests.jsx";
import Agreement from "./pages/Agreement.jsx";
import BookingDetails from "./pages/BookingDetails.jsx";
import Admin from "./pages/Admin.jsx";
import { callApi } from "./api.js";

// Read the saved user (if any) when the page first loads
function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch (error) {
    // the saved value was edited or broken; /users/me below fixes it if the token is still good
    return null;
  }
}

function App() {
  const [user, setUser] = useState(getSavedUser());
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Start every new page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // On page load, ask the server if the saved token is still valid
  useEffect(() => {
    async function checkLogin() {
      if (!localStorage.getItem("token")) {
        return;
      }
      try {
        const freshUser = await callApi("/users/me");
        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch (err) {
        // Token is old or broken: forget it, but stay on the page the user opened
        clearLogin();
      }
    }
    checkLogin();
  }, []);

  function clearLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  function handleLogin(token, loggedInUser) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearLogin();
    navigate("/");
    showToast("You have been logged out");
  }

  return (
    <div className="app">
      <Navbar user={user} onLogout={handleLogout} />
      {/* The "key" makes this fade in again every time the page changes */}
      <motion.main
        key={location.pathname}
        className="container page"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/listings/:id" element={<ListingDetails user={user} />} />
          {/* Different "key"s make React start a fresh, empty form when going from Edit to Add */}
          <Route path="/add" element={<ListingForm key="add" user={user} />} />
          <Route path="/edit/:id" element={<ListingForm key="edit" user={user} />} />
          <Route path="/my-listings" element={<MyListings user={user} />} />
          <Route path="/my-bookings" element={<MyBookings user={user} />} />
          <Route path="/requests" element={<OwnerRequests user={user} />} />
          <Route path="/bookings/:id" element={<BookingDetails user={user} />} />
          <Route path="/bookings/:id/agreement" element={<Agreement user={user} />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.main>
      <Footer />
    </div>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <b>404</b>
      <h1>This page does not exist</h1>
      <p className="muted">The link may be broken, or the page may have been removed.</p>
      <Link to="/" className="btn btn-primary">Back to browsing</Link>
    </div>
  );
}

export default App;
