"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";

const MODEL_VIEWER_SCRIPT_ID = "judy-model-viewer-script";
const MODEL_VIEWER_SCRIPT_SRC = "/vendor/model-viewer-4.3.1.min.js";

interface MobileARViewerProps {
  modelUrl: string;
  open: boolean;
  onClose: () => void;
}

interface ModelViewerElement extends HTMLElement {
  canActivateAR?: boolean;
}

interface ARStatusEvent extends Event {
  detail?: { status?: string };
}

export default function MobileARViewer({
  modelUrl,
  open,
  onClose,
}: MobileARViewerProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [arError, setArError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    let cancelled = false;
    const markReady = () => {
      void window.customElements.whenDefined("model-viewer").then(() => {
        if (!cancelled) setViewerReady(true);
      });
    };

    if (window.customElements.get("model-viewer")) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.getElementById(MODEL_VIEWER_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    const markError = () => {
      if (!cancelled) setArError("The AR viewer could not load. Please try again.");
    };
    script.addEventListener("load", markReady);
    script.addEventListener("error", markError);
    script.id = MODEL_VIEWER_SCRIPT_ID;
    script.type = "module";
    script.src = MODEL_VIEWER_SCRIPT_SRC;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", markError);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!open || !viewer) return;
    const handleStatus = (event: Event) => {
      if ((event as ARStatusEvent).detail?.status === "failed") {
        setArError("Live AR is not available on this phone. You can still rotate Judy in 3D.");
      }
    };
    viewer.addEventListener("ar-status", handleStatus);
    return () => viewer.removeEventListener("ar-status", handleStatus);
  }, [open, viewerReady]);

  if (!open) return null;

  return (
    <div className="judy-ar-overlay" role="dialog" aria-modal="true" aria-labelledby="judy-ar-title">
      <div className="judy-ar-header">
        <div>
          <strong id="judy-ar-title">Judy in your space</strong>
          <span>Move your phone to find the floor, then place Judy beside you.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AR viewer">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <model-viewer
        ref={viewerRef}
        className="judy-ar-model"
        src={modelUrl}
        alt="Judy Pierre, a purple rhino travel guide"
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-placement="floor"
        ar-scale="auto"
        camera-controls
        touch-action="pan-y"
        auto-rotate
        autoplay
        shadow-intensity="1.2"
        shadow-softness="0.8"
        exposure="1"
      >
        <button slot="ar-button" type="button" className="judy-ar-place-button">
          <ScanLine size={20} aria-hidden="true" />
          Place Judy in my space
        </button>
      </model-viewer>

      {!viewerReady && !arError && <p className="judy-ar-status">Preparing the live AR viewer…</p>}
      {arError && <p className="judy-ar-status is-error" role="status">{arError}</p>}
      <p className="judy-ar-privacy">Your camera view stays on your phone and is not uploaded.</p>
    </div>
  );
}
