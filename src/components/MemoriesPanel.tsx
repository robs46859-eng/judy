"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  Upload,
  Sparkles,
  Plus,
  MapPin,
  Trash2,
  Wand2,
  Undo2,
  Image as ImageIcon,
} from "lucide-react";
import { EDIT_PRESETS } from "@/lib/memories/edit-presets";

/**
 * Memories panel for the avatar hub.
 *
 * Upload a photo → Judy Pierre generates a warm album caption + alt text + tags
 * (Gemini vision) → save it. Saving persists the image + record to the server,
 * and the caption is auto-translated into your preferred language, so every
 * memory is bilingual. Video editing needs a separate media service and is out
 * of scope here — Judy handles the text.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

interface Caption {
  caption: string;
  altText: string;
  tags: string[];
}

interface ServerMemory {
  id: string;
  imageUrl: string;
  caption: string;
  altText: string | null;
  tags: string[];
  location: string | null;
  translatedCaption: string | null;
  translationLanguage: string | null;
}

interface MemoriesPanelProps {
  open: boolean;
  onClose: () => void;
  destinationName?: string | null;
}

function readAsBase64(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve({ base64: dataUrl.split(",")[1] ?? "", dataUrl });
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function MemoriesPanel({
  open,
  onClose,
  destinationName,
}: MemoriesPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ base64: string; dataUrl: string; mimeType: string } | null>(null);
  const [location, setLocation] = useState(destinationName ?? "");
  const [draft, setDraft] = useState<Caption | null>(null);
  const [captioning, setCaptioning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [album, setAlbum] = useState<ServerMemory[]>([]);
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [originalPreview, setOriginalPreview] = useState<
    { base64: string; dataUrl: string; mimeType: string } | null
  >(null);

  // Load saved memories when the panel opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingAlbum(true);
    fetch("/api/memories")
      .then((r) => (r.ok ? r.json() : { memories: [] }))
      .then((data) => {
        if (!cancelled) setAlbum(Array.isArray(data.memories) ? data.memories : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAlbum(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pickFile = useCallback(async (file: File | undefined) => {
    setError(null);
    setDraft(null);
    setOriginalPreview(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Please choose a JPEG, PNG, WebP, or HEIC image.");
      return;
    }
    try {
      const { base64, dataUrl } = await readAsBase64(file);
      setPreview({ base64, dataUrl, mimeType: file.type });
    } catch {
      setError("Couldn't read that image.");
    }
  }, []);

  const applyEdit = useCallback(
    async (preset?: string) => {
      if (!preview || editing) return;
      setEditing(true);
      setError(null);
      try {
        const res = await fetch("/api/memories/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: preview.base64,
            mimeType: preview.mimeType,
            preset,
            prompt: preset ? undefined : editPrompt || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Edit failed (${res.status}).`);
        }
        const data = await res.json();
        const newMime: string = data.mimeType || "image/png";
        const dataUrl = `data:${newMime};base64,${data.imageBase64}`;
        setOriginalPreview((orig) => orig ?? preview);
        setPreview({ base64: data.imageBase64, dataUrl, mimeType: newMime });
        setDraft(null); // caption should reflect the edited image
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't edit the photo.");
      } finally {
        setEditing(false);
      }
    },
    [preview, editing, editPrompt]
  );

  const revertEdit = useCallback(() => {
    if (originalPreview) {
      setPreview(originalPreview);
      setOriginalPreview(null);
      setDraft(null);
    }
  }, [originalPreview]);

  const generate = useCallback(async () => {
    if (!preview) return;
    setCaptioning(true);
    setError(null);
    try {
      const res = await fetch("/api/memories/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: preview.base64,
          mimeType: preview.mimeType,
          location: location || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: Caption = await res.json();
      setDraft({
        caption: data.caption ?? "",
        altText: data.altText ?? "",
        tags: Array.isArray(data.tags) ? data.tags : [],
      });
    } catch {
      setError("Couldn't generate a caption right now.");
    } finally {
      setCaptioning(false);
    }
  }, [preview, location]);

  const save = useCallback(async () => {
    if (!preview || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: preview.base64,
          mimeType: preview.mimeType,
          caption: draft.caption,
          altText: draft.altText || undefined,
          tags: draft.tags,
          location: location || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const saved: ServerMemory = await res.json();
      setAlbum((prev) => [saved, ...prev]);
      setPreview(null);
      setDraft(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Couldn't save that memory. Try again.");
    } finally {
      setSaving(false);
    }
  }, [preview, draft, location]);

  const remove = useCallback(async (id: string) => {
    setAlbum((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* optimistic — leave removed */
    }
  }, []);

  if (!open) return null;

  return (
    <div className="judy-chat-panel judy-memories-panel">
      <div className="judy-chat-header">
        <div className="judy-chat-title">
          <ImageIcon size={16} aria-hidden="true" />
          <span>Memories</span>
        </div>
        <button className="judy-chat-close" onClick={onClose} aria-label="Close memories panel">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="judy-mem-body">
        {!preview ? (
          <button className="judy-mem-drop" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden="true" />
            <span>Add a travel photo</span>
          </button>
        ) : (
          <div className="judy-mem-compose">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="judy-mem-preview" src={preview.dataUrl} alt="Selected travel photo preview" />

            {/* AI photo edit (Gemini image model) */}
            {preview.mimeType !== "image/heic" && (
              <div className="judy-mem-edit">
                <div className="judy-mem-edit-head">
                  <Wand2 size={13} aria-hidden="true" /> AI edit
                  {originalPreview && (
                    <button className="judy-mem-revert" onClick={revertEdit} disabled={editing}>
                      <Undo2 size={12} aria-hidden="true" /> revert
                    </button>
                  )}
                </div>
                <div className="judy-mem-edit-chips">
                  {EDIT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      className="judy-mem-editchip"
                      onClick={() => applyEdit(p.id)}
                      disabled={editing}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="judy-mem-edit-custom">
                  <input
                    type="text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describe an edit…"
                    disabled={editing}
                  />
                  <button
                    className="judy-mem-editgo"
                    onClick={() => applyEdit()}
                    disabled={editing || !editPrompt.trim()}
                  >
                    {editing ? <Loader2 size={14} className="spinner" aria-hidden="true" /> : "Edit"}
                  </button>
                </div>
                {editing && (
                  <div className="judy-mem-hint">
                    <Loader2 size={13} className="spinner" aria-hidden="true" /> Judy's editing the photo…
                  </div>
                )}
              </div>
            )}

            <label className="judy-mem-loc">
              <MapPin size={13} aria-hidden="true" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where was this?"
              />
            </label>

            {!draft ? (
              <button className="judy-mem-generate" onClick={generate} disabled={captioning}>
                {captioning ? <Loader2 size={15} className="spinner" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
                {captioning ? "Judy's writing…" : "Generate caption"}
              </button>
            ) : (
              <div className="judy-mem-draft">
                <textarea
                  className="judy-mem-caption"
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                  rows={2}
                />
                {draft.tags.length > 0 && (
                  <div className="judy-mem-tags">
                    {draft.tags.map((t) => (
                      <span key={t} className="judy-mem-tag">#{t}</span>
                    ))}
                  </div>
                )}
                <button className="judy-mem-add" onClick={save} disabled={saving}>
                  {saving ? <Loader2 size={15} className="spinner" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                  {saving ? "Saving…" : "Add to album"}
                </button>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="judy-mem-file"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {error && <div className="judy-mem-error">{error}</div>}
        {loadingAlbum && (
          <div className="judy-mem-hint">
            <Loader2 size={14} className="spinner" aria-hidden="true" /> Loading your album…
          </div>
        )}

        {album.length > 0 && (
          <div className="judy-mem-album">
            {album.map((m) => (
              <figure key={m.id} className="judy-mem-card">
                <button
                  className="judy-mem-del"
                  onClick={() => remove(m.id)}
                  aria-label="Delete memory"
                  title="Delete"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.imageUrl} alt={m.altText ?? m.caption} className="judy-mem-thumb" />
                <figcaption className="judy-mem-figcap">
                  {m.location && (
                    <span className="judy-mem-figloc">
                      <MapPin size={11} aria-hidden="true" /> {m.location}
                    </span>
                  )}
                  {m.caption}
                  {m.translatedCaption && (
                    <span className="judy-mem-figtrans">{m.translatedCaption}</span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
