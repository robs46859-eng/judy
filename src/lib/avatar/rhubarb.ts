import 'server-only';

import { spawn } from 'node:child_process';
import { parseRhubarbResult, type RhubarbCue } from './visemeTimeline';

/**
 * Rhubarb Lip Sync invocation (Swarm J7, stage 2 — scaffold).
 *
 * Rhubarb (https://github.com/DanielSWolf/rhubarb-lip-sync) is a native CLI
 * binary — no API key, no network call, no per-request cost. It analyzes a
 * WAV file's own waveform and emits mouth-shape cues, so it works with audio
 * from *any* TTS provider (see tts.ts) as long as that provider returns WAV.
 *
 * Local dev path observed on this machine: /Users/robert/.local/opt/rhubarb-1.14.0/rhubarb
 * Production (VPS/Hostinger) needs the same binary installed there too —
 * set RHUBARB_BIN to wherever it lives on that host. Nothing here assumes a
 * specific install location beyond that env var (with the local dev path as
 * a fallback default so this works out of the box on this machine without
 * extra setup).
 */

const DEFAULT_BIN_PATH = '/Users/robert/.local/opt/rhubarb-1.14.0/rhubarb';
const DEFAULT_TIMEOUT_MS = 20_000;
/** Rhubarb's JSON output is small (a few KB per minute of speech); this is a generous ceiling against a runaway process. */
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export interface RunRhubarbOptions {
  /** Path to a plain-text transcript of the audio — improves recognition accuracy. */
  dialogFilePath?: string;
  timeoutMs?: number;
  /** Overrides RHUBARB_BIN / the local dev default. */
  binPath?: string;
}

export class RhubarbUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'RhubarbUnavailableError';
  }
}

/** Pure — builds the CLI argument list. Exported so tests can assert on it without spawning a process. */
export function buildRhubarbArgs(wavPath: string, options?: RunRhubarbOptions): string[] {
  const args = ['-f', 'json'];
  if (options?.dialogFilePath) {
    args.push('--dialogFile', options.dialogFilePath);
  }
  args.push(wavPath);
  return args;
}

function resolveBinPath(options?: RunRhubarbOptions): string {
  return options?.binPath || process.env.RHUBARB_BIN || DEFAULT_BIN_PATH;
}

/**
 * Runs Rhubarb against a WAV file on disk and returns its parsed mouth-cue
 * timeline. Rejects with `RhubarbUnavailableError` on any failure (binary
 * missing, non-zero exit, timeout, malformed output) — callers should treat
 * that the same way every other optional integration in this app is
 * treated: fall back gracefully (here, to the stage-1 approximate jaw
 * movement) rather than surface an error to the person using Judy.
 */
export async function runRhubarb(
  wavPath: string,
  options?: RunRhubarbOptions
): Promise<RhubarbCue[]> {
  const binPath = resolveBinPath(options);
  const args = buildRhubarbArgs(wavPath, options);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<RhubarbCue[]>((resolve, reject) => {
    let child;
    try {
      child = spawn(binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(new RhubarbUnavailableError(`Could not start Rhubarb at ${binPath}.`, error));
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new RhubarbUnavailableError(`Rhubarb timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(new RhubarbUnavailableError('Rhubarb output exceeded the size limit.'));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new RhubarbUnavailableError(`Could not run Rhubarb at ${binPath}.`, error));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').slice(0, 500);
        reject(new RhubarbUnavailableError(`Rhubarb exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const parsed: unknown = JSON.parse(Buffer.concat(stdoutChunks).toString('utf8'));
        resolve(parseRhubarbResult(parsed));
      } catch (error) {
        reject(new RhubarbUnavailableError('Could not parse Rhubarb output as JSON.', error));
      }
    });
  });
}
