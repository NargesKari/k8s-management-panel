import { Routes, Route, Link } from "react-router-dom";
import ClustersPage from "./pages/ClustersPage.jsx";
import NamespacesPage from "./pages/NamespacesPage.jsx";
import AppsPage from "./pages/AppsPage.jsx";
import AppDetailPage from "./pages/AppDetailPage.jsx";
import Creature from "./chaos/Creature.jsx";
import ChaosButton from "./chaos/ChaosButton.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <Creature />
      <ChaosButton />

      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">K</span>
          <span>Kari Panel</span>
        </Link>
        <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          Kubernetes management console
        </span>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<ClustersPage />} />
          <Route path="/clusters/:clusterId" element={<NamespacesPage />} />
          <Route
            path="/clusters/:clusterId/namespaces/:namespaceId"
            element={<AppsPage />}
          />
          <Route path="/apps/:appId" element={<AppDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
