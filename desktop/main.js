const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

const APP_URL = 'https://app.nexoradsa.org';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'School Management System',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Agar internet na ho ya site load na ho to friendly message dikhao
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -3) return; // aborted (normal during redirects)
    dialog
      .showMessageBox(mainWindow, {
        type: 'error',
        title: 'Connection Error',
        message: 'Internet connection nahi mil raha ya server available nahi hai.',
        detail: `Error: ${desc} (${code})`,
        buttons: ['Retry', 'Close'],
      })
      .then(({ response }) => {
        if (response === 0) mainWindow.loadURL(APP_URL);
        else app.quit();
      });
  });

  // Baahar ke links (PDF reports waghera chhor kar) default browser mein kholo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL) || url.startsWith('blob:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
