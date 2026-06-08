import React, { useState } from "react";
import { Mail, Lock, LogIn, ArrowRight } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const { uid, email: userEmail } = userCredential.user;
      // console.log("Logged in user:", uid);

      // Sync the logged-in Firebase user into MongoDB (non-blocking)
      try {
        const response = await fetch("http://localhost:5000/api/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firebaseUid: uid, email: userEmail }),
        });
        const data = await response.json();
        console.log("MongoDB sync:", data.message);
      } catch (syncErr) {
        console.warn("MongoDB sync failed (non-critical):", syncErr.message);
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Login Error:", err);
      setError("Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome Back</h1>
          <p>Ready for your mock interview? Log in to continue.</p>
        </div>

        {error && (
          <div
            className="error-message"
            style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            <LogIn size={20} />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="register-link">
              Register <ArrowRight size={16} />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
