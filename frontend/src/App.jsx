import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import LikertScale from "./pages/LikertScale";
import MicTest from "./components/MicTest";
import PreTest from "./pages/PreTest";
import PostTest from "./pages/PostTest";

import MainSets from "./pages/MainSets";
import Results from "./pages/Results";
import AiAnalysisLoader from "./components/AiAnalysisLoader";
import Set2TransitionOverlay from "./components/Set2TransitionOverlay";
import SttTestBench from "./components/SttTestBench";
import FluxDebugger from "./components/FluxDebugger";
import "./components/AiAnalysisLoader.css";
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

          {/* Likert Scale — Pre-Test (H₀₂ baseline) → redirects to /mic-test */}
          <Route path="/likert-pre" element={<LikertScale phase="pre" />} />

          {/* Likert Scale — Post-Test (H₀₂ comparison) → redirects to /results */}
          <Route path="/likert-post" element={<LikertScale phase="post" />} />

          {/* Mic Setup & Test — between Likert (pre) and the interview */}
          <Route path="/mic-test" element={<MicTest />} />

          {/* Pre-Test Interview Phase */}
          <Route path="/pre-test" element={<PreTest />} />

          {/* Post-Test Graduation Challenge */}
          <Route path="/post-test" element={<PostTest />} />

          <Route
            path="/test-loader"
            element={
              <AiAnalysisLoader
                onComplete={() => console.log("Loader complete!")}
              />
            }
          />
          <Route path="/interview" element={<MainSets />} />
          <Route path="/dev/interview" element={<MainSets />} />
          <Route path="/results" element={<Results />} />

          {/* Dev only route to preview Set 2 transition design */}
          <Route 
            path="/dev/set2-transition" 
            element={
              <div style={{ width: "100vw", height: "100vh", background: "#f8f9fa" }}>
                <Set2TransitionOverlay onReady={() => console.log("Start Set 2!")} />
              </div>
            } 
          />

          {/* Dev only — STT latency & accuracy testbench */}
          <Route path="/dev/stt-test" element={<FluxDebugger />} />
          <Route path="/dev/flux" element={<FluxDebugger />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
