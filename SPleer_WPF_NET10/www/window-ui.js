/**
 * Обрабатывает нажатие на пункты бокового меню (Library / Playlists / Now Playing).
 * @param {number} value - 0 = Library, 1 = Playlists, 2 = Now Playing.
 * @async
 */
async function toggleControl(value) {
    const lib = document.getElementById('nav_library');
    const pl = document.getElementById('nav_playlists');
    const cover = document.getElementById('player__cover');

    if (value === 0) {
        lib.classList.add('control_blue');
        pl.classList.remove('control_blue');
        cover.classList.remove('open');
        toggleTab(0);
    } else if (value === 1) {
        lib.classList.remove('control_blue');
        pl.classList.add('control_blue');
        cover.classList.remove('open');
        toggleTab(1);
    } else if (value === 2) {
        toggleTab(2);
    }
}

/**
 * Переключает видимость вкладок контента.
 * @param {number} value - 0 = Library, 1 = Playlists, 2 = Now Playing.
 */
function toggleTab(value) {
    const library = document.getElementById('library');
    const playlists = document.getElementById('playlists');
    const nowPlaying = document.getElementById('now-playing');
    const cover = document.getElementById('player__cover');
    const playlist = document.getElementById('open-playlist');

    if (value === 0) {
        currentPlaylistId = null;
        library.classList.remove('u-hidden');
        playlists.classList.add('u-hidden');
        nowPlaying.classList.remove('visible');
        cover.classList.remove('open');
        playlist.classList.remove('visible');
    } else if (value === 1) {
        currentPlaylistId = null;
        playlists.classList.remove('u-hidden');
        library.classList.add('u-hidden');
        nowPlaying.classList.remove('visible');
        playlist.classList.remove('visible');
        loadPlaylists();
    } else if (value === 2) {
        nowPlaying.classList.toggle('visible');
        cover.classList.toggle('open');
        playlist.classList.remove('visible');
    } else if (value === 3) {
        playlist.classList.add('visible');
    }
}

// Инициализация после загрузки DOM
window.addEventListener('DOMContentLoaded', async () => {
    const savedSettings = await getSavedSettings();

    await applySettingsOnStartup(savedSettings);
    await initLibrary();
    initWindowControls();
    initOutsideClickHandlers();
    await initVolume(savedSettings);
});

/**
 * Настраивает перетаскивание окна и кнопки управления окном (свернуть/развернуть/закрыть).
 */
function initWindowControls() {
    const topBar = document.getElementById('top-bar');
    let isDragging = false;

    topBar.addEventListener('mousedown', (e) => {
        if (e.target.closest('#search-input') || e.target.closest('#top-bar__settings')) return;

        const now = Date.now();
        if (now - lastClickTime < 400) {
            window.chrome.webview.hostObjects.musicLibrary.MaximizeRestoreWindow();
            lastClickTime = 0;
            isDragging = false;
            return;
        }

        lastClickTime = now;
        if (e.target.tagName !== 'BUTTON') {
            isDragging = true;
            window.chrome.webview.hostObjects.musicLibrary.StartDrag();
        }
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('minimize-btn').addEventListener('click', () => {
        window.chrome.webview.hostObjects.musicLibrary.MinimizeWindow();
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
        isMaximized = !isMaximized;
        const btn = document.getElementById('maximize-btn');
        btn.classList.toggle('window-btn--maximize', !isMaximized);
        btn.classList.toggle('window-btn--restore', isMaximized);
        window.chrome.webview.hostObjects.musicLibrary.MaximizeRestoreWindow();
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        window.chrome.webview.hostObjects.musicLibrary.CloseWindow();
    });
}

/**
 * Растягивание окна.
 */
function startResize(direction) {
    window.chrome.webview.hostObjects.musicLibrary.StartResize(direction);
}

/**
 * Закрывает всплывающие панели (попап плейлистов, панель настроек) при клике вне их области.
 */
function initOutsideClickHandlers() {
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('player__add-popup');
        const playlistBtn = document.getElementById('player__playlist');
        const settingsPanel = document.getElementById('player__settings');
        const settingsBtn = document.getElementById('top-bar__settings');

        if (!popup.classList.contains('u-hidden') &&
            !popup.contains(e.target) &&
            e.target !== playlistBtn &&
            !playlistBtn.contains(e.target)) {
            popup.classList.add('u-hidden');
        }

        if (!settingsPanel.classList.contains('u-hidden') &&
            !settingsPanel.contains(e.target) &&
            e.target !== settingsBtn &&
            !settingsBtn.contains(e.target)) {
            settings(1);
        }
    });
}