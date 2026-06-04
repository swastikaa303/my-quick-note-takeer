
const { BrowserWindow, app } = require('electron');

const menuTemplate = [
    {
        label: "File",
        submenu: [
            {
                label: "New Note",
                accelerator: "CmdOrCtrl+N",
                click: () => {
                    BrowserWindow.getFocusedWindow().webContents.send('menu-open-new-note');
                }
            },
            {
                label: "Open File",
                accelerator: "CmdOrCtrl+O",
                click: () => {
                    BrowserWindow.getFocusedWindow().webContents.send('menu-open-file');
                }
            },
            {
                label: "Save",
                accelerator: "CmdOrCtrl+S",
                click: () => {
                    BrowserWindow.getFocusedWindow().webContents.send('menu-save-note');
                }
            },
            {
                label: "Save As",
                accelerator: "CmdOrCtrl+Shift+S",
                click: () => {
                    BrowserWindow.getFocusedWindow().webContents.send('menu-save-as');
                }
            },
            { type: "separator" }, // 3. Fixed 'eperator' typo
            {
                label: "Exit",
                accelerator: "CmdOrCtrl+Q",
                click: () => {
                    app.quit();
                }
            }
        ],

    },
    {
        label: "View",
        submenu: [
            {
                label: "Dark Mode", type: "checkbox"
            },
        ]
    }
];

module.exports = { menuTemplate };