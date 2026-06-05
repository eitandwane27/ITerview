import React, { useState } from "react";
import { Mail, Lock, UserPlus, ArrowLeft } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./Login.css"; // We'll reuse the login styles since the layout is identical

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { uid, email: userEmail } = userCredential.user;
      console.log("Registered user:", uid);

      // Sync the new Firebase user into MongoDB (non-blocking)
      try {
        const response = await fetch("http://localhost:5000/api/users/register", {
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
      console.error("Registration Error:", err);
      // Firebase throws specific errors we can handle
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Failed to create an account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Create an Account</h1>
          <p>Join ITerview and start your mock interviews.</p>
        </div>

        {error && (
          <div className="error-message" style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="login-form">
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

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            <UserPlus size={20} />
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="register-link">
              <ArrowLeft size={16} /> Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
