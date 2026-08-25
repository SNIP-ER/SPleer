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
    { key: 'language', labelKey: 'settings.language', type: 'select', options: [
        { value: 'English', labelKey: 'settings.language.en' },
        { value: 'Russian', labelKey: 'settings.language.ru' }
    ], default: 'English' },

    { key: 'theme', labelKey: 'settings.theme', type: 'select', options: [
        { value: 'Dark', labelKey: 'settings.theme.dark' },
        { value: 'Light', labelKey: 'settings.theme.light' }
    ], default: 'Dark' },

    { key: 'close_btn', labelKey: 'settings.closeButton', type: 'select', options: [
        { value: 'Close', labelKey: 'settings.closeButton.close' }
    ], default: 'Close' },

    { key: 'musicFolder', labelKey: 'settings.folderMusics', type: 'folder', buttonLabelKey: 'settings.folderMusics.text', default: null },

    { key: 'normalization', labelKey: 'settings.volumeNormalization', type: 'toggle', default: true },

    //{ key: 'notifications', label: 'Track change notifications', type: 'toggle', default: false },

    { key: 'cache', labelKey: 'settings.clearCover', type: 'action', action: 'clearCoverCache', buttonLabelKey: 'settings.clearCover.text' },
];

const languageCodes = { 'English': 'en', 'Russian': 'ru' };

const marqueeResizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
        checkMarqueeOverflow(entry.target);
    }
});

const marqueeObserved = new WeakSet();


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
 * Устанавливает текст элемента. Если элемент помечен классом 'marquee',
 * автоматически включает бегущую строку при переполнении и следит за изменением размера.
 * Используйте вместо el.textContent = text везде, где текст может не поместиться.
 * @param {HTMLElement} el - Целевой элемент.
 * @param {string} text - Текст для отображения.
 */
function setText(el, text) {
    if (!el) return;

    if (!el.classList.contains('marquee')) {
        el.textContent = text;
        return;
    }

    let inner = el.querySelector('.marquee__inner');
    if (!inner) {
        inner = document.createElement('span');
        inner.className = 'marquee__inner';
        el.appendChild(inner);
    }
    inner.textContent = text;

    if (!marqueeObserved.has(el)) {
        marqueeObserved.add(el);
        marqueeResizeObserver.observe(el);
    }

    checkMarqueeOverflow(el);
}

function checkMarqueeOverflow(el) {
    const inner = el.querySelector('.marquee__inner');
    if (!inner) return;

    el.classList.remove('marquee--active');
    el.style.removeProperty('--marquee-shift');
    el.style.removeProperty('--marquee-duration');

    requestAnimationFrame(() => {
        const overflow = inner.scrollWidth - el.clientWidth;
        if (overflow > 2) {
            el.style.setProperty('--marquee-shift', `-${overflow}px`);
            
            const pixelsPerSecond = 15;
            const duration = Math.max(4, (overflow / pixelsPerSecond) * 2 + 2);
            el.style.setProperty('--marquee-duration', `${duration}s`);
            
            el.classList.add('marquee--active');
        }
    });
}

/**
 * Активирует бегущую строку для всех элементов с классом 'marquee' внутри контейнера,
 * ещё не обёрнутых в .marquee__inner. Вызывайте после вставки HTML через innerHTML.
 * @param {HTMLElement} [root=document] - Контейнер для поиска.
 */
function activateMarquees(root = document) {
    root.querySelectorAll('.marquee').forEach(el => {
        if (el.querySelector('.marquee__inner')) return;

        const inner = document.createElement('span');
        inner.className = 'marquee__inner';
        inner.append(...el.childNodes);
        el.appendChild(inner);

        if (!marqueeObserved.has(el)) {
            marqueeObserved.add(el);
            marqueeResizeObserver.observe(el);
        }

        checkMarqueeOverflow(el);
    });
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
                <span class='marquee'>${escapeHtml(track.Title)}</span>
            </div>
            <div class='marquee library__text library__text--cell library__col--artist'>${escapeHtml(track.Artist)}</div>
            <div class='marquee library__text library__text--cell library__col--album'>${escapeHtml(track.Album) || '—'}</div>
            <div class='library__text library__text--time'>${track.DurationFormatted}</div>
        `;
        row.addEventListener('click', () => playByPath(track.FilePath));
        container.appendChild(row);
    });

    if (tracks.length === 0) {
        document.getElementById('player__cover-img').classList.add('u-hidden');
        document.getElementById('player__cover').classList.add('u-hidden');
    }

    activateMarquees(document.getElementById('library__body'));
}

// Обработчик перемотки трека
document.getElementById('time-progress').addEventListener('input', async (e) => {
    const seconds = parseFloat(e.target.value);
    const slider = document.getElementById('time-progress');
    const percent = (seconds / slider.max) * 100;

    await window.chrome.webview.hostObjects.musicLibrary.SeekTo(seconds);
    slider.style.setProperty('--volume', `${percent}%`);
});