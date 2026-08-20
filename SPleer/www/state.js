/**
 * @typedef {Object} PlaylistData
 * @property {number} Id - Уникальный идентификатор плейлиста.
 * @property {string} Name - Название плейлиста.
 * @property {string|null} CoverPath - Относительный путь к файлу обложки или null, если не задан.
 * @property {string[]} TrackPaths - Список путей к файлам треков в плейлисте.
 */


const sortConfigs = {
    library: {
        headerContainer: '#library__header-row',
        column: null,
        ascending: true,
        fetch: async () => JSON.parse(await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson()),
        render: renderLibraryRows,
    },
    playlist: {
        headerContainer: '.playlist--library__row--header',
        column: null,
        ascending: true,
        fetch: async () => JSON.parse(await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(currentPlaylistId)),
        render: (tracks) => renderPlaylistRows(tracks, currentPlaylistId),
    },
}

const settingsSchema = [
    { key: 'language', label: 'Language', type: 'select', options: ['English'], default: 'English' },
    { key: 'theme', label: 'Theme', type: 'select', options: ['Dark'], default: 'Dark' },
    { key: 'close_btn', label: 'Close button', type: 'select', options: ['Close'], default: 'Close' },
    { key: 'musicFolder', label: 'Folder musics', type: 'folder', default: null },
    { key: 'normalization', label: 'Volume normalization', type: 'toggle', default: true },
    //{ key: 'notifications', label: 'Track change notifications', type: 'toggle', default: false },
    { key: 'cache', label: 'Clear cover cache', type: 'action', action: 'clearCoverCache', buttonLabel: 'Clear' }
];


let updateInterval;
let lastClickTime = 0;
let playlistSearchDebounceTimer = null;
let lastTrackIndex = -1;
let currentPlayingPath = -1;
let currentPlaylistId = null;
let currentPlaylistData = null;
let isMaximized = false;
let savedVolume = 40;
let cachedPopupPlaylists = [];
let cachedPopupCurrentTrackPath = null;


/**
 * Экранирует HTML-спецсимволы, чтобы текст нельзя было интерпретировать как разметку.
 * @param {string} str - Исходная строка.
 * @returns {string} Безопасная для вставки в innerHTML строка.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

/**
 * Возвращает URL обложки трека, или локальную заглушку, если обложки нет.
 * @param {Object} track - Объект трека.
 * @returns {string} URL изображения.
 */
function getTrackCoverSrc(track) {
    return track.CoverPath ? `https://appfiles.local/${track.CoverPath}` : 'https://splayer.web/Image/no-cover.svg';
}

/**
 * Форматирует секунды в строку MM:SS.
 * @param {number} seconds - Время в секундах.
 * @returns {string} Отформатированное время.
 */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Задаёт активный порядок/подмножество треков для кнопок "следующий"/"предыдущий".
 * @param {string[]|null} orderedPaths - Пути треков в нужном порядке, или null для сброса к порядку всей библиотеки.
 * @async
 */
async function applyActiveOrder(orderedPaths) {
    const json = orderedPaths ? JSON.stringify(orderedPaths) : null;
    await window.chrome.webview.hostObjects.musicLibrary.SetActiveOrderJson(json);
}

/**
 * Отрисовывает список треков библиотеки.
 * @param {Array<Object>} tracks - Массив треков для отображения.
 */
function renderLibraryRows(tracks) {
    const container = document.querySelector('#library__body');
    container.innerHTML = '';

    tracks.forEach((track, index) => {
        const row = document.createElement('div');
        const coverSrc = getTrackCoverSrc(track);

        row.className = 'library__row';
        row.id = `track-row-${index}`;
        row.innerHTML = `
            <div class='library__text library__text--cell library__col--number' id='track-number-${index}'>
                <span class='library__number'>${index + 1}</span>
                <img class='library__play-icon' src='Image/play.svg'>
            </div>
            <div class='library__text library__text--cell library__col--title'>
                <img class='library__cover' src='${coverSrc}'>
                ${escapeHtml(track.Title)}
            </div>
            <div class='library__text library__text--cell library__col--artist'>${escapeHtml(track.Artist)}</div>
            <div class='library__text library__text--cell library__col--album'>${escapeHtml(track.Album) || '—'}</div>
            <div class='library__text library__text--time'>${track.DurationFormatted}</div>
        `;
        row.addEventListener('click', () => playByPath(track.FilePath));
        container.appendChild(row);
    });

    if (tracks.length === 0) {
        document.getElementById('player__cover-img').classList.add('u-hidden');
        document.getElementById('player__cover').classList.add('u-hidden');
    }
}

// Обработчик перемотки трека
document.getElementById('time-progress').addEventListener('input', async (e) => {
    const seconds = parseFloat(e.target.value);
    const slider = document.getElementById('time-progress');
    const percent = (seconds / slider.max) * 100;

    await window.chrome.webview.hostObjects.musicLibrary.SeekTo(seconds);
    slider.style.setProperty('--volume', `${percent}%`);
});