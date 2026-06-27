import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

export type SmtcControlAction = 'toggle' | 'next' | 'previous' | 'seek';

export interface SmtcSeekOptions {
  positionMs: number;
  durationMs?: number;
}

function resolveScriptPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'scripts/smtc-control.ps1'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/smtc-control.ps1'),
    path.join(app.getAppPath(), 'scripts/smtc-control.ps1'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

export async function runSmtcControl(action: SmtcControlAction, seek?: SmtcSeekOptions): Promise<void> {
  const scriptPath = resolveScriptPath();
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Action', action];

  if (action === 'seek' && seek) {
    args.push('-PositionMs', String(Math.max(0, Math.round(seek.positionMs))));
    if (seek.durationMs !== undefined && seek.durationMs > 0) {
      args.push('-DurationMs', String(Math.round(seek.durationMs)));
    }
  }

  try {
    await execFileAsync('powershell.exe', args, { timeout: 15000, windowsHide: true });
  } catch (error) {
    if (action === 'seek') return;
    const message = error instanceof Error ? error.message : '媒体控制失败';
    throw new Error(message);
  }
}
