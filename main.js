const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');
const { menuTemplate } = require('./menuTemp');
const path = require('node:path');
const fs = require('node:fs');

// =================================================================
// 1. GLOBAL VARIABLES & APP CONFIG
// =================================================================
app.disableHardwareAcceleration();

// The path where the sidebar JSON data will be stored securely
const notesPath = path.join(app.getPath('userData'), 'notes.json');
let tray = null;

// =================================================================
// 2. HELPER FUNCTIONS
// =================================================================
function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    win.loadFile('index.html');
    win.webContents.openDevTools();
}

// Reads the JSON file for the sidebar
function readNotes() {
    if (!fs.existsSync(notesPath)) return [];

    const data = fs.readFileSync(notesPath, 'utf8');
    return JSON.parse(data);
}

// Writes to the JSON file for the sidebar
function writeNotes(notes) {
    fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2), 'utf-8');
}

// =================================================================
// 3. MAIN APP INITIALIZATION & IPC HANDLERS
// =================================================================
app.whenReady().then(() => {

    // --- MENU SETUP ---
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // --- SYSTEM TRAY SETUP ---
    tray = new Tray(path.join(__dirname, 'tray-icon.png')); // Ensure you have this image
    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                const windows = BrowserWindow.getAllWindows();
                if (windows.length > 0) windows[0].show();
            }
        },
        {
            label: 'Quit',
            click: () => app.quit()
        }
    ]);
    tray.setToolTip('Quick Note Taker');
    tray.setContextMenu(trayMenu);
    tray.on('double-click', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const win = windows[0];
            win.isVisible() ? win.hide() : win.show();
        }
    });

    // --- IPC HANDLERS: SIDEBAR / JSON (🔥 This fixes your error) ---

    ipcMain.handle('get-notes', async () => {
        return readNotes();
    });

    ipcMain.handle('save-json-note', async (event, noteObject) => {
        let notes = readNotes();
        // Check if note already exists
        const existingIndex = notes.findIndex(n => n.id === noteObject.id);

        if (existingIndex !== -1) {
            notes[existingIndex] = noteObject; // Update existing
        } else {
            notes.push(noteObject); // Add new
        }

        writeNotes(notes);
        return { success: true };
    });

    // --- IPC HANDLERS: FILE SYSTEM / TEXT FILES ---

    ipcMain.handle('save-note', async (event, text, customFilePath) => {
        // Use the passed file path, or default to the documents folder if undefined
        const filePath = customFilePath || path.join(app.getPath('documents'), 'quicknote.txt');
        fs.writeFileSync(filePath, text, 'utf-8');
        return { success: true, message: "Note saved successfully." };
    });

    ipcMain.handle('load-note', async () => {
        const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, "utf-8");
        }
        return '';
    });

    ipcMain.handle('delete-note', async (event, id) => {
        let notes = readNotes();
        notes = notes.filter(n => n.id !== id);
        writeNotes(notes);
        return { success: true };
    });
    ipcMain.handle('save-as', async (event, text) => {
        const result = await dialog.showSaveDialog({
            defaultPath: 'quicknote.txt',
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (result.canceled) return { success: false };

        fs.writeFileSync(result.filePath, text, 'utf-8');
        return { success: true, filePath: result.filePath };
    });

    ipcMain.handle('open-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (result.canceled) return { success: false };

        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, filePath: filePath, content: content };
    });

    ipcMain.handle('open-new-note', async (event) => {
        const result = await dialog.showMessageBox({
            type: "warning",
            buttons: ['Discard Changes', 'Cancel'],
            defaultId: 1,
            title: 'Unsaved Changes',
            message: "You have unsaved changes. Are you sure you want to discard them?"
        });
        return { confirmed: result.response === 0 };
    });

    // --- LAUNCH WINDOW ---
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// =================================================================
// 4. APP LIFECYCLE
// =================================================================
app.on('window-all-closed', () => {
    // Keep app running on macOS even if window is closed
    if (process.platform !== 'darwin') app.quit();
});