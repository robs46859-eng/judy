"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

import AvatarStage from "@/components/avatar/AvatarStage";
import styles from "./AvatarManager.module.css";

export interface AvatarRigReport {
  compatible?: boolean;
  lipSyncMode?: string | null;
  mode?: string | null;
  jawInfluencedVertices?: number | null;
  morphTargetNames?: string[];
  morphNames?: string[];
  visemeTargets?: string[];
  arkitMouthTargets?: string[];
  morphTargets?: Array<{ name?: string | null }>;
  issues?: Array<string | { code?: string; message?: string }>;
  warnings?: Array<string | { code?: string; message?: string }>;
}

interface CurrentAvatarAsset {
  filename: string;
  size: number;
  uploadedAt: string;
  modelUrl: string;
  report: AvatarRigReport;
}

interface BundledAvatarAsset {
  modelUrl: string;
  report?: AvatarRigReport;
}

interface AvatarManagerResponse {
  current: CurrentAvatarAsset | null;
  bundled: BundledAvatarAsset;
}

interface AvatarUploadResponse {
  current?: CurrentAvatarAsset;
  filename?: string;
  size?: number;
  uploadedAt?: string;
  modelUrl?: string;
  report?: AvatarRigReport;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function uploadedAssetFromResponse(payload: AvatarUploadResponse): CurrentAvatarAsset | null {
  if (payload.current) {
    return payload.report && !payload.current.report
      ? { ...payload.current, report: payload.report }
      : payload.current;
  }

  if (
    typeof payload.filename === "string" &&
    typeof payload.size === "number" &&
    typeof payload.uploadedAt === "string" &&
    typeof payload.modelUrl === "string" &&
    payload.report
  ) {
    return {
      filename: payload.filename,
      size: payload.size,
      uploadedAt: payload.uploadedAt,
      modelUrl: payload.modelUrl,
      report: payload.report,
    };
  }

  return null;
}

function reportMessageText(message: string | { code?: string; message?: string }): string {
  if (typeof message === "string") return message;
  if (message.message) return message.message;
  if (message.code) return message.code;
  return "Unspecified validation message.";
}

function RigReportView({ report, title }: { report: AvatarRigReport; title: string }) {
  const titleId = useId();
  const morphNames = Array.from(
    new Set(
      report.morphTargetNames ??
        report.morphNames ??
        [
          ...(report.visemeTargets ?? []),
          ...(report.arkitMouthTargets ?? []),
          ...(report.morphTargets ?? []).flatMap((target) =>
            typeof target.name === "string" && target.name ? [target.name] : []
          ),
        ]
    )
  );
  const issues = report.issues ?? [];
  const warnings = report.warnings ?? [];
  const mode = report.lipSyncMode ?? report.mode ?? "Not reported";
  const compatibility =
    report.compatible === true
      ? "Compatible rig"
      : report.compatible === false
        ? "Incompatible rig"
        : "Compatibility not reported";

  return (
    <section className={styles.report} aria-labelledby={titleId}>
      <div className={styles.reportHeading}>
        <h4 id={titleId}>{title}</h4>
        <span
          className={
            report.compatible === true
              ? styles.compatible
              : report.compatible === false
                ? styles.incompatible
                : styles.unknown
          }
        >
          {compatibility}
        </span>
      </div>

      <dl className={styles.reportFacts}>
        <div>
          <dt>Lip-sync mode</dt>
          <dd>{mode}</dd>
        </div>
        <div>
          <dt>Jaw-influenced vertices</dt>
          <dd>
            {typeof report.jawInfluencedVertices === "number"
              ? report.jawInfluencedVertices.toLocaleString()
              : "Not reported"}
          </dd>
        </div>
      </dl>

      <div className={styles.reportDetails}>
        <h5>Morph targets</h5>
        {morphNames.length > 0 ? (
          <ul className={styles.tagList} aria-label="Detected morph targets">
            {morphNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p>None detected.</p>
        )}
      </div>

      <div className={styles.reportDetails}>
        <h5>Issues</h5>
        {issues.length > 0 ? (
          <ul>
            {issues.map((issue, index) => (
              <li key={`${reportMessageText(issue)}-${index}`}>{reportMessageText(issue)}</li>
            ))}
          </ul>
        ) : (
          <p>No blocking issues reported.</p>
        )}
      </div>

      {warnings.length > 0 && (
        <div className={styles.reportDetails}>
          <h5>Warnings</h5>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${reportMessageText(warning)}-${index}`}>
                {reportMessageText(warning)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function AvatarManager() {
  const [avatarData, setAvatarData] = useState<AvatarManagerResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadReport, setUploadReport] = useState<AvatarRigReport | null>(null);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const fileHelpId = useId();

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/admin/avatar", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await readJson<AvatarManagerResponse & { error?: string }>(response);
        if (!response.ok || !payload) {
          throw new Error(payload?.error || "Could not load avatar status.");
        }
        setAvatarData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load avatar status.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setSuccess(null);
    setUploadReport(null);

    if (file && !file.name.toLowerCase().endsWith(".glb")) {
      setError("Choose a .glb avatar model.");
      return;
    }
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || uploading || !selectedFile.name.toLowerCase().endsWith(".glb")) return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadReport(null);

    const formData = new FormData();
    formData.append("avatar", selectedFile);

    try {
      const response = await fetch("/api/admin/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await readJson<AvatarUploadResponse>(response);

      if (!response.ok) {
        setUploadReport(payload?.report ?? null);
        throw new Error(payload?.error || "The avatar could not be validated or activated.");
      }
      if (!payload) throw new Error("The avatar service returned an empty response.");

      const current = uploadedAssetFromResponse(payload);
      if (!current) throw new Error("The avatar service returned an incomplete asset record.");

      setAvatarData((previous) => ({
        current,
        bundled: previous?.bundled ?? { modelUrl: current.modelUrl },
      }));
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(`${current.filename} is validated and active.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The avatar could not be validated or activated."
      );
    } finally {
      setUploading(false);
    }
  };

  const activeModelUrl = avatarData?.current?.modelUrl ?? avatarData?.bundled.modelUrl ?? null;
  const activeReport = avatarData?.current?.report ?? avatarData?.bundled.report;
  const previewUnavailable = activeModelUrl !== null && failedPreviewUrl === activeModelUrl;
  const selectedFileIsValid = selectedFile?.name.toLowerCase().endsWith(".glb") === true;

  return (
    <section className={styles.manager} aria-labelledby="avatar-manager-title" aria-busy={loading || uploading}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Avatar administration</p>
          <h2 id="avatar-manager-title">Avatar Manager</h2>
        </div>
        <p>
          Upload a GLB, validate its lip-sync rig, and activate it only when validation succeeds.
        </p>
      </header>

      <form className={styles.uploadPanel} onSubmit={handleSubmit} aria-busy={uploading}>
        <div className={styles.fileField}>
          <label htmlFor={fileInputId}>GLB avatar file</label>
          <input
            ref={inputRef}
            id={fileInputId}
            type="file"
            accept=".glb,model/gltf-binary"
            aria-describedby={fileHelpId}
            disabled={uploading}
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
          <p id={fileHelpId}>Only a self-contained .glb file can be uploaded.</p>
        </div>

        <button
          className={styles.uploadButton}
          type="submit"
          disabled={!selectedFileIsValid || uploading}
        >
          {uploading ? "Uploading and validating…" : "Upload, validate & activate"}
        </button>

        {uploading && (
          <div className={styles.progress} role="status" aria-live="polite">
            <progress aria-label="Avatar upload and validation in progress" />
            <span>Uploading and validating the avatar rig.</span>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className={styles.success} role="status" aria-live="polite">
            {success}
          </p>
        )}
        {uploadReport && <RigReportView report={uploadReport} title="Uploaded file validation" />}
      </form>

      {loading ? (
        <p className={styles.loading} role="status">
          Loading avatar status…
        </p>
      ) : avatarData ? (
        <div className={styles.contentGrid}>
          <section className={styles.assetPanel} aria-labelledby="current-avatar-title">
            <h3 id="current-avatar-title">Current avatar</h3>
            {avatarData.current ? (
              <dl className={styles.assetFacts}>
                <div>
                  <dt>Filename</dt>
                  <dd>{avatarData.current.filename}</dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{formatBytes(avatarData.current.size)}</dd>
                </div>
                <div>
                  <dt>Uploaded</dt>
                  <dd>{formatUploadedAt(avatarData.current.uploadedAt)}</dd>
                </div>
                <div>
                  <dt>Model URL</dt>
                  <dd>
                    <code>{avatarData.current.modelUrl}</code>
                  </dd>
                </div>
              </dl>
            ) : (
              <p>No uploaded avatar is active. Judy is using the bundled avatar.</p>
            )}

            {activeReport ? (
              <RigReportView
                report={activeReport}
                title={avatarData.current ? "Current rig validation" : "Bundled rig validation"}
              />
            ) : (
              <p className={styles.muted}>No rig report is available for the bundled avatar.</p>
            )}
          </section>

          <section className={styles.previewPanel} aria-labelledby="avatar-preview-title">
            <div className={styles.previewHeading}>
              <h3 id="avatar-preview-title">Active avatar preview</h3>
              <span>{avatarData.current?.filename ?? "Bundled avatar"}</span>
            </div>
            {activeModelUrl && !previewUnavailable ? (
              <div className={styles.preview} aria-label="Active 3D avatar preview">
                <AvatarStage
                  key={activeModelUrl}
                  modelUrl={activeModelUrl}
                  talking={false}
                  phase="idle"
                  onUnavailable={() => setFailedPreviewUrl(activeModelUrl)}
                />
              </div>
            ) : (
              <p className={styles.error} role="alert">
                The active avatar preview is unavailable.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
