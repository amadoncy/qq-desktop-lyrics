import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/**
 * electron-builder 会把 .exe 解包到 app.asar.unpacked，但 JS 仍可能从 asar 加载，
 * 导致 windows-media-sessions 按相对路径找不到 backend。打包前显式指定环境变量。
 */
function resolveBackendPath(): string | null {
  const backendName = 'windows-media-sessions-backend.exe';
  const candidates = [
    path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'windows-media-sessions',
      'bin',
      'win-x64',
      backendName,
    ),
    path.join(app.getAppPath(), 'node_modules', 'windows-media-sessions', 'bin', 'win-x64', backendName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

if (!process.env.WINDOWS_MEDIA_SESSIONS_BACKEND) {
  const backendPath = app.isPackaged ? resolveBackendPath() : null;
  if (backendPath) {
    process.env.WINDOWS_MEDIA_SESSIONS_BACKEND = backendPath;
    console.info('[smtcEnv] backend:', backendPath);
  } else if (app.isPackaged) {
    console.error('[smtcEnv] 未找到 SMTC backend，歌词同步将不可用');
  }
}
