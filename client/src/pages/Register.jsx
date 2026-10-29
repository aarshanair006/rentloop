// Register page: creates a new account and logs the user in straight away.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Repeat2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { callApi } from "../api.js";
import { useToast } from "../components/Toast.jsx";

function Register({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const data = await callApi("/users/register", "POST", { name, email, password, city });
      onLogin(data.token, data.user);
      showToast("Account created. Welcome to RentLoop!");
      navigate("/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <span className="logo-mark"><Repeat2 size={22} strokeWidth={2.5} /></span>
        <h1>Create your account</h1>
        <p className="muted mb-16">One account lets you both rent and lend.</p>

        <div className="form-stack">
          {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className="field-hint">At least 6 characters</span>
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" className="input" placeholder="e.g. Pune" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>

        <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}

export default Register;
