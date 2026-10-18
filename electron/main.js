const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
// Peak 1.0.3 — Electron main (restored for functional build)
// Content preserved from v1.0.2 — see git history
async function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 800, icon: path.join(__dirname, '../build/icon.ico') });
  win.loadURL('http://127.0.0.1:3784');
}
app.whenReady().then(createWindow);
