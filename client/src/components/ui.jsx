// Small UI pieces used on many pages: status badge, stars, avatar, empty state,
// loading skeletons, tabs and a confirm dialog. Each one is a plain function component.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Lock } from "lucide-react";

// Colour and text for every booking status
const STATUS_STYLES = {
  pending: { color: "badge-yellow", label: "Pending" },
  approved: { color: "badge-blue", label: "Approved" },
  active: { color: "badge-teal", label: "Active" },
  completed: { color: "badge-green", label: "Completed" },
  rejected: { color: "badge-grey", label: "Rejected" },
  cancelled: { color: "badge-grey", label: "Cancelled" },
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return <span className={"badge badge-dot " + style.color}>{style.label}</span>;
}

// Shows 5 stars, with "rating" of them filled in
export function Stars({ rating, size = 15 }) {
  const stars = [];
  for (let number = 1; number <= 5; number++) {
    const isFilled = number <= Math.round(rating);
    stars.push(
      <Star
        key={number}
        size={size}
        className={isFilled ? "" : "star-empty"}
        fill={isFilled ? "currentColor" : "none"}
      />
    );
  }
  return <span className="stars" aria-label={rating + " out of 5"}>{stars}</span>;
}

// A circle with the first letter of the person's name
export function Avatar({ name, large }) {
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  return <span className={large ? "avatar avatar-lg" : "avatar"}>{letter}</span>;
}

export function EmptyState({ icon, title, text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

// Shown on pages that need a login when nobody is logged in
export function LoginNeeded({ text }) {
  return (
    <EmptyState icon={<Lock size={24} />} title="Please log in" text={text}>
      <Link to="/login" className="btn btn-primary">Log in</Link>
    </EmptyState>
  );
}

// Grey placeholder boxes shown while data is loading
export function Skeleton({ count, type }) {
  const boxes = [];
  for (let index = 0; index < count; index++) {
    boxes.push(<div key={index} className={"skeleton skeleton-" + type} />);
  }
  if (type === "card") {
    return <div className="grid">{boxes}</div>;
  }
  return <div>{boxes}</div>;
}

// A row of tabs. "tabs" is a list like [{ value: "all", label: "All", count: 4 }].
// "group" must be different on each page so the sliding underline stays in its own row.
export function Tabs({ tabs, active, onChange, group }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          className={active === tab.value ? "tab active" : "tab"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          <span className="tab-count">{tab.count}</span>
          {active === tab.value && <motion.span layoutId={group} className="tab-underline" />}
        </button>
      ))}
    </div>
  );
}

// A pop-up that asks "are you sure?" before something that cannot be undone.
// Clicking outside it or pressing Escape closes it.
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKey(event) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKey);
    // Remove the listener again when the dialog closes
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{title}</h2>
            <p className="muted">{message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onCancel}>Keep it</button>
              <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
