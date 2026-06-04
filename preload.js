const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveNote: (text, filePath) => ipcRenderer.invoke('save-note', text, filePath),
    loadNote: () => ipcRenderer.invoke('load-note'),
    saveAs: (text) => ipcRenderer.invoke('save-as', text),
    openNewNote: () => ipcRenderer.invoke('open-new-note'), 
    
    openFile: () => ipcRenderer.invoke('open-file'),
    onMenuAction: (channel, callback) => ipcRenderer.on(channel, (_event, ...args) => callback(...args)),

    // Codes for note list and json | sidebar
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveJSONNote: (note) => ipcRenderer.invoke('save-json-note', note),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id)
});