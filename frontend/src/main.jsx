import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ChaosProvider } from "./chaos/ChaosContext.jsx";
import "./styles/index.css";

// The exact same build is served both at "/" and at "/frontend" (see
// backend/k8s/33-ingress-frontend-alias.yaml). React Router needs to know
// which one it's mounted under so links and route matching work in both
// places without a separate build.
const basename = window.location.pathname.startsWith("/frontend") ? "/frontend" : "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ChaosProvider>
        <App />
      </ChaosProvider>
    </BrowserRouter>
  </React.StrictMode>
);
