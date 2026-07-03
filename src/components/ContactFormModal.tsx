import React, { useState } from "react";
import { X, Send, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { motion } from "motion/react";

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactFormModal({ isOpen, onClose }: ContactFormModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("General");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSending(true);
    try {
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${resp.status})`);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName("");
        setEmail("");
        setMessage("");
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">Contact Judy</div>
            <div className="modal-subtitle">
              Questions, feedback, or partnership ideas — we read everything.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-row">
            <div className="modal-field">
              <label htmlFor="contact-name">Your Name</label>
              <input
                id="contact-name"
                type="text"
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label htmlFor="contact-email">Your Email</label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-field">
            <label htmlFor="contact-topic">Topic</label>
            <select
              id="contact-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="General">General question</option>
              <option value="Feedback">App feedback</option>
              <option value="Partnership">Partnership &amp; sponsorship</option>
              <option value="Support">Account support</option>
            </select>
          </div>

          <div className="modal-field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              required
              rows={4}
              maxLength={5000}
              placeholder="Tell us what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {errorMsg && (
            <div className="modal-error">
              <AlertCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {errorMsg}
            </div>
          )}

          {success ? (
            <div className="modal-success">
              <CheckCircle size={15} />
              Message sent. Thank you!
            </div>
          ) : (
            <button type="submit" className="modal-submit" disabled={isSending}>
              {isSending ? <Mail size={15} /> : <Send size={15} />}
              {isSending ? "Sending…" : "Send Message"}
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
