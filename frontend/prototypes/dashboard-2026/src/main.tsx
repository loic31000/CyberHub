import React from "react";
import ReactDOM from "react-dom/client";
import App from "./DashboardPrototype";
import "./styles.css";
import "./phase-one.css";
import "./phase-two-c.css";
import "./phase-two-d.css";
import "./phase-two-e.css";
import "./phase-two-f.css";
import "./phase-two-g.css";
import "./phase-two-h.css";
import "./phase-two-i.css";
import "./phase-two-j.css";
import "./phase-two-k.css";
import "./phase-two-l.css";
import "./phase-two-m.css";
import "./phase-two-n.css";
import "./phase-three-a.css";
import "./phase-three-a2.css";
import "./phase-three-s.css";
import "./phase-three-b.css";

const searchParams = new URLSearchParams(window.location.search);
const requestedPalette = searchParams.get("palette");
document.documentElement.dataset.palette =
  requestedPalette === "lagoon" ? "lagoon" : "petrol";
document.documentElement.dataset.panels =
  searchParams.get("panels") === "glass" ? "glass" : "opaque";
// Prototype only: the two hero link connectors under comparison.
document.documentElement.dataset.link = searchParams.get("link") === "b" ? "b" : "a";
// Prototype only: the three studies of the hero's core symbol.
const requestedCore = searchParams.get("core");
document.documentElement.dataset.core = requestedCore === "2" || requestedCore === "3" ? requestedCore : "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
