import { Link } from "react-router-dom";

// items: [{ label, to }] — the last item has no "to" (current page)
export default function Breadcrumb({ items }) {
  return (
    <div className="breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            {isLast || !item.to ? (
              <span className="current">{item.label}</span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
