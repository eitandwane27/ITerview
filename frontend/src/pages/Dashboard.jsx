import React, { useState } from "react";
import { LogOut, Activity, Lock, Unlock, PlayCircle, BarChart2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleStartPreTest = () => {
    if (!selectedRole) {
      alert("Please select a role first!");
      return;
    }
    // Navigate to the Pre-Test Likert scale page
    navigate("/likert-pre");
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-topbar">
        <div className="topbar-content">
          <h1>ITerview</h1>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>
      
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h2>Welcome to your Dashboard</h2>
          <p>Review your analytics, select your target role, and start your mock interview.</p>
        </div>

        <div className="dashboard-grid">
          {/* Performance Analytics Card */}
          <div className="dashboard-card">
            <div className="card-header">
              <Activity className="card-icon" size={24} />
              <h3>Performance Analytics</h3>
            </div>
            <div className="analytics-content">
              <div className="stat-row">
                <span>Average 3C's Score</span>
                <span className="stat-value">--/100</span>
              </div>
              <div className="stat-row">
                <span>Weak Topics</span>
                <span className="stat-value text-muted">No data yet</span>
              </div>
              <div className="stat-row">
                <span>Sessions Completed</span>
                <span className="stat-value">0</span>
              </div>
              <button className="secondary-button" style={{marginTop: "1rem"}}>
                <BarChart2 size={16} />
                View Session History
              </button>
            </div>
          </div>

          {/* Difficulty Selection Card */}
          <div className="dashboard-card">
            <div className="card-header">
              <Unlock className="card-icon" size={24} />
              <h3>Difficulty Selection</h3>
            </div>
            <div className="difficulty-options">
              <label className={`difficulty-option ${selectedDifficulty === 'easy' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="difficulty" 
                  value="easy"
                  checked={selectedDifficulty === 'easy'}
                  onChange={() => setSelectedDifficulty('easy')}
                />
                <Unlock size={16} />
                <span>Easy (Unlocked)</span>
              </label>
              
              <label className="difficulty-option locked">
                <input type="radio" name="difficulty" value="medium" disabled />
                <Lock size={16} />
                <span>Medium (Locked)</span>
              </label>
              
              <label className="difficulty-option locked">
                <input type="radio" name="difficulty" value="hard" disabled />
                <Lock size={16} />
                <span>Hard (Locked)</span>
              </label>
            </div>
            <p className="card-hint">Master the current difficulty (overall score &gt; 75%) to unlock the next level.</p>
          </div>

          {/* Role Selection Card */}
          <div className="dashboard-card role-card">
            <div className="card-header">
              <PlayCircle className="card-icon" size={24} />
              <h3>Start Interview</h3>
            </div>
            <div className="role-selection">
              <p>Select your target role:</p>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                className="role-select"
              >
                <option value="" disabled>Select a role...</option>
                <option value="frontend">Frontend Developer</option>
                <option value="backend">Backend Developer</option>
                <option value="fullstack">Fullstack Developer</option>
              </select>
            </div>
            
            <button 
              className="primary-button start-btn" 
              onClick={handleStartPreTest}
              disabled={!selectedRole}
            >
              Start Pre-Test
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
