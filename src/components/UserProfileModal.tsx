import React from "react";
import { X, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import { motion } from "motion/react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
}

export default function UserProfileModal({ isOpen, onClose, userName, userEmail }: UserProfileModalProps) {
  if (!isOpen) return null;

  const initial = (userName || userEmail || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="profile-identity">
            <div className="profile-avatar">{initial}</div>
            <div>
              <div className="profile-name">{userName || "Traveler"}</div>
              <div className="profile-email">{userEmail || "—"}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-note">
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Your account is secured with an encrypted session. Trips, itineraries,
              and budgets are private to this account.
            </span>
          </div>

          <button
            className="modal-secondary"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
