window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('save_status');
    const saveAsBtn = document.getElementById('save-as');

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
