import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LikertScale from "./pages/LikertScale";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Likert Scale — Pre-Test (H₀₂ baseline) → redirects to /pre-test */}
          <Route path="/likert-pre" element={<LikertScale phase="pre" />} />

          {/* Likert Scale — Post-Test (H₀₂ comparison) → redirects to /results */}
          <Route path="/likert-post" element={<LikertScale phase="post" />} />

          {/* Placeholder routes — to be built on later days */}
          {/* <Route path="/pre-test" element={<PreTest />} /> */}
          {/* <Route path="/results" element={<Results />} /> */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
