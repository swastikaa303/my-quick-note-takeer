const { app, BrowserWindow, ipcMain, dialog } = require('electron');

app.disableHardwareAcceleration();

const path = require('node:path');
const fs = require('node:fs');
const { type } = require('node:os');

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

const menuTemplate =[
    {
        label:'File',
        submenu:[
            {
                label:'New Note',
                accelerator:'CmdOrCtrl+N',
                click:()=>{
                    BrowserWindow.getFocusedWindow().webContents.send('menu-new-note');
                }
            },
            {
                label:'Open File',
                accelerator:'CmdOrCtrl+O',
                click:()=>{
                    BrowserWindow.getFocusedWindow().webContents.send('menu-open-file');
            }
            },
            {
                label:'Save',
                accelerator:'CmdOrCtrl+S',
                click:()=>{
                    BrowserWindow.getFocusedWindow().webContents.send('menu-save');
                }
            },
            {
                label:'Save As',
                accelerator:'CmdOrCtrl+Shift+S',
                click:()=>{
                    BrowserWindow.getFocusedWindow().webContents.send('menu-save-as');
                }
            },
            {type:'separator'},
            {
                label:'Quit',
                accelerator:'CmdOrCtrl+Q',
                click:()=>app.quit()
            }
        ]
    }
];
const menu=Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);



    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}); 

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });


    // IPC Handlers
    ipcMain.handle('save-note', async (event, text) => {
        const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
        fs.writeFileSync(filePath, text, 'utf-8');
        return { success: true };
    });

    ipcMain.handle('load-note', async () => {
        const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return '';
    });

    ipcMain.handle('save-as', async (event, text) => {
        const result = await dialog.showSaveDialog({
            defaultPath: 'mynote.txt',
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });
        if (result.canceled) {
            return { success: false };
        }
        fs.writeFileSync(result.filePath, text, 'utf-8');
        return { success: true, filepath: result.filePath };

    });
    ipcMain.handle('smart-save', async (event, text, filePath) => {
        const targetPath = filePath || path.join(app.getPath('documents'), 'quicknote.txt');
        fs.writeFileSync(targetPath, text, 'utf-8');
        return { success: true, filepath: targetPath };
    });

    ipcMain.handle('new-note', async (event) => {
        const result = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Discard Changes', 'Cancel'],
            defaultId: 1,
            title: 'Unsaved Changes',
            message: 'you have unsaved changes.Start a new note anyway?'
        });
        return { confirmed: result.response === 0 };

    });
    ipcMain.handle('open-file',async(event)=>{
        const result=await dialog.showOpenDialog({
            properties:['openFile'],
            filters:[{name:'Text Files',extensions:['txt']}]


        });
        if (result.cancelled){
            return{success:false};
        }
        const filePath=result.filePaths[0];
        const content=fs.readFileSync(filePath,'utf-8');
        return{success:true,content:true,content,filePath};

    });

