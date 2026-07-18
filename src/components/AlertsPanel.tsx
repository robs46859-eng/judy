"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Bell, AlertTriangle, Info, ShieldAlert } from "lucide-react";

/**
 * Travel alerts panel for the avatar hub. Fetches destination-relevant alerts
 * for gay travelers and lists them with severity styling. Self-contained.
 */

type Severity = "info" | "caution" | "warning";

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  category: string;
}

interface AlertsPanelProps {
  open: boolean;
  onClose: () => void;
  destinationName?: string | null;
}

function severityIcon(severity: Severity) {
  if (severity === "warning") return <ShieldAlert size={14} aria-hidden="true" />;
  if (severity === "caution") return <AlertTriangle size={14} aria-hidden="true" />;
  return <Info size={14} aria-hidden="true" />;
}

export default function AlertsPanel({ open, onClose, destinationName }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (destinationName) params.set("destination", destinationName);
    fetch(`/api/alerts?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load alerts right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, destinationName]);

  if (!open) return null;

  return (
    <div className="td-chat-panel td-alerts-panel">
      <div className="td-chat-header">
        <div className="td-chat-title">
          <Bell size={16} aria-hidden="true" />
          <span>Travel alerts{destinationName ? ` · ${destinationName}` : ""}</span>
        </div>
        <button className="td-chat-close" onClick={onClose} aria-label="Close alerts panel">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="td-alerts-list">
        {loading && (
          <div className="td-alerts-hint">
            <Loader2 size={14} className="spinner" aria-hidden="true" /> Checking alerts…
          </div>
        )}
        {error && !loading && <div className="td-alerts-error">{error}</div>}
        {!loading &&
          !error &&
          alerts.map((a) => (
            <div key={a.id} className={`td-alert td-alert-${a.severity}`}>
              <span className="td-alert-icon">{severityIcon(a.severity)}</span>
              <div className="td-alert-text">
                <strong>{a.title}</strong>
                <p>{a.body}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
