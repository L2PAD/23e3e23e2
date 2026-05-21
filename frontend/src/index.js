import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/styles/admin-i18n-adaptive.css";
import "@/components/reveal.global.css";
import "leaflet/dist/leaflet.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
