window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');

    const savedNote = await window.electronAPI.loadNote();
    textarea.value = savedNote;

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