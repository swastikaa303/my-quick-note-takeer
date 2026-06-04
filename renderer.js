window.addEventListener('DOMContentLoaded', async () => {
    const textarea    = document.getElementById('note');
    const titleInput  = document.getElementById('note-title');
    const saveBtn     = document.getElementById('save');
    const saveAsBtn   = document.getElementById('save-as');
    const openFileBtn = document.getElementById('open-file');
    const newNoteBtn  = document.getElementById('new-note');
    const noteList    = document.getElementById('note-list');
    const statusEl    = document.getElementById('save_status');
    const searchInput = document.getElementById('search');

    // ── Dark mode (declared early so applyDarkMode can reference it) ───────────
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    let isDarkMode = false;

    function applyDarkMode(enable) {
        isDarkMode = enable;
        document.body.classList.toggle('dark-mode', enable);
        darkModeBtn.textContent = enable ? 'Light Mode' : 'Dark Mode';
    }

    // ── Font size ──────────────────────────────────────────────────────────────
    let currentFontSize = 16;

    function applyFontSize(size) {
        currentFontSize = Math.min(42, Math.max(10, size));
        textarea.style.fontSize = `${currentFontSize}px`;
    }

    // ── Load settings and apply on startup ────────────────────────────────────
    const settings = await window.electronAPI.getSettings();
    applyFontSize(settings.fontSize || 16);
    applyDarkMode(settings.darkMode || false);

    // ── Word / character count ─────────────────────────────────────────────────
    function updateWordCount() {
        const text = textarea.value;
        const characters = text.length;
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const wordCountEl = document.getElementById('word-count');
        wordCountEl.textContent = `Words: ${words} | Characters: ${characters}`;
    }

    // ── State ──────────────────────────────────────────────────────────────────
    let notes            = [];
    let currentNoteId    = null;
    let lastSavedContent = '';
    let debounceTimer    = null;

    // ── Helpers ────────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Sidebar ────────────────────────────────────────────────────────────────
    // FIX 1: accept `filter` param with default ''
    // FIX 2: iterate over `filtered`, not `notes`
    function renderNotesList(filter = '') {
        noteList.innerHTML = '';

        const filtered = filter.trim() === ''
            ? notes
            : notes.filter(note =>
                (note.title || '').toLowerCase().includes(filter.toLowerCase()) ||
                (note.content || '').toLowerCase().includes(filter.toLowerCase())
            );

        filtered.forEach(note => {
            const item = document.createElement('div');
            item.className = 'note-item' + (note.id === currentNoteId ? ' active' : '');

            item.innerHTML = `
                <button class="note-item-delete" data-id="${note.id}">\u00d7</button>
                <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
            `;

            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('note-item-delete')) return;
                await switchNote(note.id);
            });

            item.querySelector('.note-item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteNote(note.id);
            });

            noteList.appendChild(item);
        });
    }

    // ── Switch note ────────────────────────────────────────────────────────────
    async function switchNote(id) {
        if (textarea.value !== lastSavedContent) {
            const result = await window.electronAPI.newNote();
            if (!result.confirmed) return;
        }

        const note = notes.find(n => n.id === id);
        if (!note) return;

        currentNoteId        = note.id;
        titleInput.value     = note.title   || '';
        textarea.value       = note.content || '';
        lastSavedContent     = note.content || '';
        statusEl.textContent = '';

        updateWordCount();
        // FIX 3: pass current search value so active filter is preserved
        renderNotesList(searchInput.value);
    }

    // ── Save ───────────────────────────────────────────────────────────────────
    async function saveCurrentNote() {
        if (!currentNoteId) return;

        clearTimeout(debounceTimer);

        const note = {
            id:      currentNoteId,
            title:   titleInput.value.trim() || 'Untitled',
            content: textarea.value
        };

        await window.electronAPI.saveNoteJson(note);
        lastSavedContent = textarea.value;

        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) {
            notes[index] = { ...notes[index], ...note, updatedAt: new Date().toISOString() };
        }

        // FIX 4: pass current search value so active filter is preserved
        renderNotesList(searchInput.value);
        statusEl.style.color = 'gray';
        statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    async function deleteNote(id) {
        const result = await window.electronAPI.newNote();
        if (!result.confirmed) return;

        await window.electronAPI.deleteNote(id);
        notes = notes.filter(n => n.id !== id);

        if (currentNoteId === id) {
            currentNoteId        = null;
            titleInput.value     = '';
            textarea.value       = '';
            lastSavedContent     = '';
            statusEl.textContent = 'Note deleted.';
        }

        // FIX 5: pass current search value so active filter is preserved
        renderNotesList(searchInput.value);
    }

    // ── Export ─────────────────────────────────────────────────────────────────
    async function exportNote() {
        const title   = titleInput.value.trim() || 'Untitled';
        const divider = '\u2500'.repeat(title.length);
        const text    = `${title}\n${divider}\n\n${textarea.value}`;

        const result = await window.electronAPI.saveAs(text);
        if (result.success) statusEl.textContent = 'Exported \u2714';
    }

    // ── Import ─────────────────────────────────────────────────────────────────
    async function importFile() {
        const result = await window.electronAPI.openFile();
        if (!result.success) return;

        const now = new Date().toISOString();
        const imported = {
            id:        Date.now().toString(),
            title:     result.filePath.split(/[\\/]/).pop().replace(/\.txt$/i, ''),
            content:   result.content,
            createdAt: now,
            updatedAt: now
        };

        const saveResult = await window.electronAPI.saveNoteJson(imported);
        if (!saveResult.success) {
            statusEl.textContent = 'Import failed \u2716';
            statusEl.style.color = '#e05252';
            return;
        }

        notes.unshift(imported);
        await switchNote(imported.id);
        statusEl.textContent = 'Imported \u2714';
    }

    // ── Font size buttons ──────────────────────────────────────────────────────
    const fontIncreaseBtn = document.getElementById('font-increase');
    const fontDecreaseBtn = document.getElementById('font-decrease');

    fontIncreaseBtn.addEventListener('click', async () => {
        applyFontSize(currentFontSize + 2);
        await window.electronAPI.saveSettings({ fontSize: currentFontSize });
    });

    fontDecreaseBtn.addEventListener('click', async () => {
        applyFontSize(currentFontSize - 2);
        await window.electronAPI.saveSettings({ fontSize: currentFontSize });
    });

    // ── Dark mode toggle ───────────────────────────────────────────────────────
    darkModeBtn.addEventListener('click', async () => {
        applyDarkMode(!isDarkMode);
        await window.electronAPI.saveSettings({ darkMode: isDarkMode });
    });

    // ── New note ───────────────────────────────────────────────────────────────
    newNoteBtn.addEventListener('click', async () => {
        if (textarea.value !== lastSavedContent) {
            const result = await window.electronAPI.newNote();
            if (!result.confirmed) return;
        }

        const newNote = {
            id:        Date.now().toString(),
            title:     'Untitled',
            content:   '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveNoteJson(newNote);
        notes.unshift(newNote);
        currentNoteId        = newNote.id;
        titleInput.value     = '';
        textarea.value       = '';
        lastSavedContent     = '';
        // FIX 6: pass current search value so active filter is preserved
        renderNotesList(searchInput.value);
        titleInput.focus();
        statusEl.textContent = 'New note created.';
    });

    // ── Save button ────────────────────────────────────────────────────────────
    saveBtn.addEventListener('click', async () => {
        await saveCurrentNote();
        new Notification('Note Saved', {
            body: `"${titleInput.value || 'Untitled'}" has been saved.`
        });
    });

    saveAsBtn.addEventListener('click',   exportNote);
    openFileBtn.addEventListener('click', importFile);

    // ── Auto-save on textarea input ────────────────────────────────────────────
    textarea.addEventListener('input', () => {
        updateWordCount();
        statusEl.textContent = 'Unsaved changes...';
        statusEl.style.color = 'gray';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveCurrentNote, 5000);
    });

    // ── Auto-save on title input ───────────────────────────────────────────────
    titleInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveCurrentNote, 5000);
    });

    // ── Search ─────────────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        renderNotesList(searchInput.value);
    });

    // ── Menu action listeners ──────────────────────────────────────────────────
    window.electronAPI.onMenuAction('menu-new-note',  () => newNoteBtn.click());
    window.electronAPI.onMenuAction('menu-open-file', () => openFileBtn.click());
    window.electronAPI.onMenuAction('menu-save',      () => saveBtn.click());
    window.electronAPI.onMenuAction('menu-save-as',   () => saveAsBtn.click());

    // ── Init: load all notes ───────────────────────────────────────────────────
    notes = await window.electronAPI.getNotes();

    if (notes.length > 0) {
        const mostRecent = notes.reduce((a, b) =>
            new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
        );
        await switchNote(mostRecent.id);
    } else {
        newNoteBtn.click();
    }

    renderNotesList(searchInput.value);
});