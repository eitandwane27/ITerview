import React from "react";
import "./Set2Interview.css";

export default function Set2Interview({ role = "Frontend" }) {
  return (
    <div className="s2-interview-container">
      <h2>Set 2: Technical Mastery</h2>
      <p>Role: {role}</p>
      <div className="s2-placeholder-area">
        {/* Placeholder for the AI avatar / waveform / question text */}
        <p>[ Technical Interview UI will go here ]</p>
      </div>
    </div>
  );
}
