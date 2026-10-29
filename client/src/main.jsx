// Entry point of the React app: loads the CSS and draws <App /> inside index.html.
// MotionConfig reducedMotion="user" turns animations off for people who disabled them in their OS.
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionConfig>
  </BrowserRouter>
);
