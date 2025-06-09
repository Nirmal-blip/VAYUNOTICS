import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let backendProcess;

function startBackend() {
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend','dist','final.exe')
    : path.join(__dirname,'backend', 'dist','final.exe');

  if (!fs.existsSync(backendPath)) {
    console.error(`Backend executable not found at: ${backendPath}`);
    return;
  }
  console.log(`Starting backend at: ${backendPath}`);

  backendProcess = spawn(backendPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    cwd: path.dirname(backendPath),
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('error', (err) => {
    console.error(`Failed to start backend: ${err.message}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    // fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Adjust path for index.html in packaged vs development environments
  const indexPath = app.isPackaged
    ? path.join(__dirname, 'dist', 'index.html')
    : path.join(__dirname, 'dist/index.html');

  if (!fs.existsSync(indexPath)) {
    console.error(`Index.html not found at: ${indexPath}`);
    return;
  }

  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});