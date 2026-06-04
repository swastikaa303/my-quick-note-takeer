window.addEventListener('DOMContentLoaded', async () => {
    // =================================================================
    // 1. DOM ELEMENTS
    // =================================================================
    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const toggleBtn = document.getElementById('toggle-mode');
    const statusEl = document.getElementById('save-status');
    const openNewWindowBtn = document.getElementById('new-note');
    const openFile = document.getElementById('open-file');
    const saveAsBtn = document.getElementById('save-as');
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    const noteList = document.getElementById('note-list');

    const fontIncBtn = document.getElementById('font-inc');
    const fontDecBtn = document.getElementById('font-dec');
   
    // =================================================================
    // 2. STATE VARIABLES
    // =================================================================
    let undoStack = [];
    let redoStack = [];
    let currentState = textarea.value;
    let currentFilePath = '';       // Moved up: must be declared before renderNotes uses it
    let lastSavedText = '';         // Moved up: must be declared before renderNotes uses it
    let debounceTimer;
    let countdownInterval;

    // =================================================================
    // 3. UI RENDERING & STATE FUNCTIONS
    // =================================================================

    async function renderNotes() {
        const notesArray = await window.electronAPI.getNotes();
        noteList.innerHTML = '';

        if (!notesArray || notesArray.length === 0) {
            noteList.innerHTML = `<p style="font-size:12px;color:gray;padding:10px;">No saved notes.</p>`;
            return;
        }

        notesArray.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';

            // Highlight active note using our system variable (currentFilePath)
            if (note.id === currentFilePath) {
                div.className += ' active'; // You might want to add a .active class in your CSS!
            }

            div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${note.title || 'Untitled'}</strong>
                <button class="delete-btn" data-id="${note.id}" style="background: #e74c3c; padding: 2px 6px; font-size: 10px; border-radius: 4px;">X</button>
            </div>
            <small>${new Date(note.updatedAt).toLocaleString()}</small>
        `;

            // CLICK TO OPEN NOTE
            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) return;

                // Map to our system's state variables
                currentFilePath = note.id;
                textarea.value = note.content;
                lastSavedText = note.content;

                // Fix undo/redo states so it doesn't spill over from the previous note
                currentState = note.content;
                undoStack = [];
                redoStack = [];

                renderNotes(); // Re-render to update the 'active' styling
            });

            // CLICK TO DELETE NOTE
            const delBtn = div.querySelector('.delete-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Using our existing confirmation dialog (which asks "Are you sure?")
                const result = await window.electronAPI.openNewNote();

                if (result.confirmed) {
                    await window.electronAPI.deleteNote(note.id);

                    // If we deleted the note we are currently looking at, clear the editor
                    if (currentFilePath === note.id) {
                        currentFilePath = '';
                        textarea.value = '';
                        lastSavedText = '';
                        currentState = '';
                        undoStack = [];
                        redoStack = [];
                    }
                    renderNotes(); // Refresh the sidebar
                }
            });

            noteList.appendChild(div);
        });
    }
    const saveState = (newStack) => {
        undoStack.push(currentState);
        currentState = newStack;
        redoStack = []; // clear redo stack on new input
    };

    const applyState = () => {
        textarea.value = currentState;
    };

    //TEXT AND WORD COUNT
    function updateWordCount() {
        const text = textarea.value;
        const characters = text.length;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        document.getElementById('word-count').textContent = `Words: ${words} | Characters: ${characters}`;
    }
    async function autoSave() {
        if (!currentFilePath) return; // Only autosave if the file has been saved at least once
        await window.electronAPI.saveNote(textarea.value, currentFilePath);
        statusEl.textContent = 'Auto-saved successfully';
        lastSavedText = textarea.value;
    }
    // TOGGLE DARK MODE
    // 1. On startup, check if the user previously chose dark mode
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        console.log(localStorage.getItem('theme'), " is the theme mode (saved)")
    }

    // 2. Listen for clicks to toggle and save the new choice
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Save the current mode so the app remembers it next time
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    try {
        // 1. Load saved font size (default to 16 if none exists)
        let currentFontSize = parseInt(localStorage.getItem('fontSize')) || 16;
        textarea.style.fontSize = `${currentFontSize}px`;

        // 2. Increase Font Size
        fontIncBtn.addEventListener('click', () => {
            if (currentFontSize < 48) { // Maximum size limit
                currentFontSize += 2;
                textarea.style.fontSize = `${currentFontSize}px`;
                localStorage.setItem('fontSize', currentFontSize); // Save to storage
            }
        });
        // 3. Decrease Font Size
        fontDecBtn.addEventListener('click', () => {
            if (currentFontSize > 10) { // Minimum size limit
                currentFontSize -= 2;
                textarea.style.fontSize = `${currentFontSize}px`;
                localStorage.setItem('fontSize', currentFontSize); // Save to storage
            }
        });
    } catch (error) {
        console.log(error)
    }
    // =================================================================
    // 4. INITIALIZATION
    // =================================================================
    try {
        const notes = await window.electronAPI.getNotes();
        renderNotes(notes);

        if (notes && notes.length > 0) {
            textarea.value = notes[notes.length - 1].content;
            currentFilePath = notes[notes.length - 1].id;
        } else {
            const savedNote = await window.electronAPI.loadNote();
            textarea.value = savedNote || '';
        }

        lastSavedText = textarea.value;
        currentState = textarea.value;
    } catch (err) {
        console.error("Initialization error:", err);
    }

    // =================================================================
    // 5. EVENT LISTENERS: BUTTONS
    // =================================================================

    // UNDO
    undoBtn.addEventListener('click', () => {
        if (undoStack.length === 0) return;
        statusEl.textContent = `Undo text, stack: ${undoStack.length}`;
        redoStack.push(currentState);
        currentState = undoStack.pop();
        applyState();
    });

    // REDO
    redoBtn.addEventListener('click', () => {
        if (redoStack.length === 0) return;
        statusEl.textContent = `Redo text, stack: ${redoStack.length}`;
        undoStack.push(currentState);
        currentState = redoStack.pop();
        applyState();
    });

    // SAVE AS
    saveAsBtn.addEventListener('click', async () => {
        // Standardized to use 'saveAs' consistently
        const result = await window.electronAPI.saveAs(textarea.value);

        if (result.success) {
            currentFilePath = result.filePath;
            const fileName = result.filePath.split('\\').pop().split('/').pop();

            const noteObject = {
                id: result.filePath,
                title: fileName,
                content: textarea.value,
                updatedAt: new Date().toISOString()
            };

            await window.electronAPI.saveJSONNote(noteObject);
            renderNotes(await window.electronAPI.getNotes());

            lastSavedText = textarea.value;
            statusEl.textContent = `Saved as: ${fileName}`;
        }
    });

    // SAVE
    saveBtn.addEventListener('click', async () => {
        const text = textarea.value;

        // If it's a new file with no path, trigger Save As instead
        if (!currentFilePath) {
            saveAsBtn.click();
            return;
        }

        await window.electronAPI.saveNote(text, currentFilePath);

        const noteObject = {
            id: currentFilePath,
            title: text.substring(0, 20) || 'Untitled Note',
            content: text,
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveJSONNote(noteObject);
        renderNotes(await window.electronAPI.getNotes());

        lastSavedText = text;
        statusEl.textContent = 'Note saved successfully';
    });

    // OPEN FILE
    openFile.addEventListener('click', async () => {
        const result = await window.electronAPI.openFile();
        if (result.success) {
            textarea.value = result.content;
            lastSavedText = result.content;
            currentFilePath = result.filePath;
            currentState = result.content;
            statusEl.textContent = `Opened ${result.filePath}`;
        }
    });

    //DELETE NOTE FROM SIDEBAR
    const delBtn = div.querySelector('.delete-btn');
    delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await window.electronAPI.newNote();
        if (result.confirmed) {
            await window.electronAPI.deleteNote(note.id);
            if (currentNoteId === note.id) {
                currentNoteId = null;
                textarea.value = '';
                lastSavedText = '';
                updateWordCount();
            }
            renderNotes();
        }
    });
    noteList.appendChild(div);


    // NEW NOTE WINDOW / RESET
    openNewWindowBtn.addEventListener('click', async () => {
        // Standardized API call name to match main.js handle 'open-new-note'
        const result = await window.electronAPI.openNewNote();
        if (result.confirmed) {
            lastSavedText = '';
            textarea.value = '';
            currentState = '';
            currentFilePath = '';
            undoStack = [];
            redoStack = [];
            statusEl.textContent = 'New note initialized';
        }
    });


    // =================================================================
    // 6. EVENT LISTENERS: TYPING / TEXTAREA
    // =================================================================
    textarea.addEventListener('input', () => {
        let newText = textarea.value;
        saveState(newText);

        clearTimeout(debounceTimer);
        clearInterval(countdownInterval);

        let timeLeft = 5;
        statusEl.textContent = `Changes detected - auto saving in ${timeLeft}s...`;

        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                statusEl.textContent = `Changes detected - auto saving in ${timeLeft}s...`;
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);

        debounceTimer = setTimeout(() => {
            autoSave();
        }, 5000);

        // Removed the broken undoHistory setInterval block that caused errors
    });

    // =================================================================
    // 7. EXTERNAL TRIGGERS (Menus & Shortcuts)
    // =================================================================

    // Optional chaining added in case onMenuAction isn't defined in preload yet
    if (window.electronAPI.onMenuAction) {
        window.electronAPI.onMenuAction('menu-new-note', () => openNewWindowBtn.click());
        window.electronAPI.onMenuAction('menu-open-file', () => openFile.click());
        window.electronAPI.onMenuAction('menu-save-note', () => saveBtn.click());
        window.electronAPI.onMenuAction('menu-save-as', () => saveAsBtn.click());
    }

    // KEYBOARD SHORTCUTS
    window.addEventListener('keydown', async (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            // Trigger the normal save button logic
            saveBtn.click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redoBtn.click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoBtn.click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            openNewWindowBtn.click();
        }
    });
});