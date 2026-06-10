import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import "./index.css";
import AnalyticsPage from "./pages/AnalyticsPage";
import CicdPipelinePage from "./pages/CicdPipelinePage";
import LandingPage from "./pages/LandingPage";
import ReleaseCenterPage from "./pages/ReleaseCenterPage";
import SchoolDetailPage from "./pages/SchoolDetailPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<LandingPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/pipeline" element={<CicdPipelinePage />} />
          <Route path="/schools/:id" element={<SchoolDetailPage />} />
          <Route path="/release" element={<ReleaseCenterPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
