// Login page: sends email and password to the backend and saves the returned token.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Repeat2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";
import { useToast } from "../components/Toast.jsx";

// Seeded demo accounts. Only shown while developing (npm run dev), never in a real build.
const DEMO_ACCOUNTS = ["priya@rentloop.demo", "arjun@rentloop.demo", "admin@rentloop.demo"];

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await callApi("/users/login", "POST", { email, password });
      onLogin(data.token, data.user);
      showToast("Welcome back, " + data.user.name.split(" ")[0]);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function fillDemoAccount(demoEmail) {
    setEmail(demoEmail);
    setPassword("demo1234");
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <span className="logo-mark"><Repeat2 size={22} strokeWidth={2.5} /></span>
        <h1>Welcome back</h1>
        <p className="muted mb-16">Log in to rent items or manage your listings.</p>

        <div className="form-stack">
          {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                className="input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </div>

        {import.meta.env.DEV && (
          <div className="demo-box">
            Testing locally? Use a demo account (password demo1234):
            <div>
              {DEMO_ACCOUNTS.map((demoEmail) => (
                <button key={demoEmail} type="button" className="btn btn-secondary btn-sm" onClick={() => fillDemoAccount(demoEmail)}>
                  {demoEmail.split("@")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="auth-footer">New to RentLoop? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}

export default Login;
