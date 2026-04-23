window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('save_status');
    const saveAsBtn = document.getElementById('save-as');
    const openFileBtn=document.getElementById('open-file');
    const newNoteBtn=document.getElementById('new-note');
    
    const savedNote = await window.electronAPI.loadNote();
    textarea.value = savedNote;
    

    saveAsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.saveAs(textarea.value);
        if (result.success) {
            lastsavedtext = textarea.value;
            currentFilePath = result.filepath;
            statusEl.textContent = `Saved to ${result.filepath}`;
        } else {
            statusEl.textContent = 'Save cancelled.';
        }
        });
    saveAsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.saveAs(textarea.value);
        if (result.success) {
            lastsavedtext = textarea.value;
            statusEl.textContent = `Saved to ${result.filepath}`;
        } else {
            statusEl.textContent = 'Save As cancelled.';
        }
    });
    newNoteBtn.addEventListener('click', async()=>{
        if(textarea.value===lastSavedText){
            textarea.value='';
            lastSavedText='';
             statusEl.textContent='New note started.';
            return;
        }
        const result=await window.electronAPI.newNote();
        if(result.confirmed){
            textarea.value-'';
            lastSavedText='';
            statusEl.textContent='New note started.';
        }else{
            statusEl.textContent='New note cancelled.';
        }
         
    });
    openFileBtn.addEventListener('click',async()=>{
        const result=await window.electronAPI.openFile();
        if(result.success){
            textarea.value=result.content;
            lastSavedText=result.content;
            currentFilePath=result.filePath;
            statusEl.textContent='Opened:${result.filePath}';
        }else{
            statusEl.textContent='Open cancelled.';
        }
    });
    


    async function autoSave() {
        const currentText = textarea.value;
        if (currentText === lastsavedtext) {
            statusEl.textContent = 'No changes to save.';
            return;
        }
        try {
            await window.electronAPI.saveNote(currentText);
            lastsavedtext = currentText;
            const now = new Date().toLocalTimeString();
            statusEl.textContent = 'Auto-saved at ${now}';
        } catch (err) {
            console.error('Auto-save failed:', err);
            statusEl.textContent = 'Auto-save failed. Please try saving manually.';
        }
    }
    let debounceTimer;
    textarea.addEventListener('input', () => {
        statusEl.textContent = 'changing detected auto-saving in 5 s...';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(autoSave, 2000);
    });

    // Manual save
    saveBtn.addEventListener('click', async () => {
        try {
            await window.electronAPI.saveNote(textarea.value);
            alert('Note saved successfully!');
        } catch (err) {
            console.error('Manual save failed:', err);
        }
    });

});
