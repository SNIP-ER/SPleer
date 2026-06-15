let updateInterval;
let lastTrackIndex = -1;
let isMaximized = false;

/**
 * Загружает список треков из C# и отрисовывает их в библиотеке.
 * @async
 */
async function loadTracks() {
    try {
        const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
        const tracks = JSON.parse(json);
        const container = document.querySelector('#library__body');

        container.innerHTML = '';

        tracks.forEach((track, index) => {
            const row = document.createElement('div');
            const coverSrc = track.CoverPath
                ? `https://appfiles.local/${track.CoverPath}`
                : 'https://placehold.co/40x40/3a3f47/E0E0E0?text=Music';

            row.className = 'library__row';
            row.id = `track-row-${index}`;
            row.innerHTML = `
                <div class='library__text library__text--cell library__col--number' id='track-number-${index}'>
                    <span class='library__number'>${index + 1}</span>
                    <img class='library__play-icon' src='Image/play.svg'>
                </div>
                <div class='library__text library__text--cell library__col--title'>
                    <img class='library__cover' src='${coverSrc}'>
                    ${track.Title}
                </div>
                <div class='library__text library__text--cell library__col--artist'>${track.Artist}</div>
                <div class='library__text library__text--cell library__col--album'>${track.Album || '—'}</div>
                <div class='library__text library__text--time'>${track.DurationFormatted}</div>
            `;
            row.addEventListener('click', () => playByIndex(index));
            container.appendChild(row);
        });
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
    }
}

/**
 * Обновляет библиотеку треков (повторное сканирование папки).
 * @async
 */
async function refreshTracks() {
    try {
        await window.chrome.webview.hostObjects.musicLibrary.RefreshLibrary();
        await loadTracks();
    } catch (error) {
        console.error('Ошибка обновления:', error);
    }
}

/**
 * Воспроизводит трек по индексу. Если трек уже выбран — переключает Play/Pause.
 * @param {number} index - Индекс трека в списке.
 * @async
 */
async function playByIndex(index) {
    if (lastTrackIndex === index) {
        const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();

        if (state === 1) {
            await window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
            showPlayButton();
            stopProgressUpdate();
        } else {
            await window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();

            const newState = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();

            if (newState === 0) {
                await window.chrome.webview.hostObjects.musicLibrary.PlayByIndex(index);
            }

            showPauseButton();
            startProgressUpdate();
        }
        return;
    }

    removeTrackHighlight(lastTrackIndex);
    await window.chrome.webview.hostObjects.musicLibrary.PlayByIndex(index);
    addTrackHighlight(index);

    lastTrackIndex = index;
    showPauseButton();
    startProgressUpdate();
    updateUIByIndex(index);
}

/**
 * Снимает подсветку с указанного трека в библиотеке.
 * @param {number} index - Индекс трека.
 */
function removeTrackHighlight(index) {
    if (index >= 0) {
        const el = document.getElementById(`track-number-${index}`);
        if (el) el.classList.remove('library__number--active');
    }
}

/**
 * Добавляет подсветку указанному треку в библиотеке.
 * @param {number} index - Индекс трека.
 */
function addTrackHighlight(index) {
    const el = document.getElementById(`track-number-${index}`);
    if (el) el.classList.add('library__number--active');
}

/**
 * Обновляет интерфейс плеера (обложка, название, артист, время) по индексу трека.
 * @param {number} index - Индекс трека.
 * @async
 */
async function updateUIByIndex(index) {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (index < 0 || index >= tracks.length) return;

    const track = tracks[index];
    const coverImg = document.querySelector('#player__cover-img');
    const fullCoverImg = document.querySelector('#now-playing__cover-img');
    const src = track.CoverPath
        ? `https://appfiles.local/${track.CoverPath}`
        : 'https://placehold.co/300x300/3a3f47/E0E0E0?text=Music';

    document.querySelector('#player__title').textContent = track.Title;
    document.querySelector('#player__artist').textContent = track.Artist;
    document.querySelector('#player__time--total').textContent = track.DurationFormatted;
    document.querySelector('#now-playing__title').textContent = track.Title;
    document.querySelector('#now-playing__artist').textContent = track.Artist;
    coverImg.src = src;
    fullCoverImg.src = src;
}

/**
 * Обновляет интерфейс плеера данными текущего трека из C#.
 * @async
 */
async function updateUIForCurrentTrack() {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);
    const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();

    if (currentIndex < 0 || currentIndex >= tracks.length) return;

    const track = tracks[currentIndex];
    const coverImg = document.querySelector('#player__cover-img');
    const fullCoverImg = document.querySelector('#now-playing__cover-img');
    const src = track.CoverPath
        ? `https://appfiles.local/${track.CoverPath}`
        : 'https://placehold.co/300x300/3a3f47/E0E0E0?text=Music';

    document.querySelector('#player__title').textContent = track.Title;
    document.querySelector('#player__artist').textContent = track.Artist;
    document.querySelector('#player__time--total').textContent = track.DurationFormatted;
    document.querySelector('#now-playing__title').textContent = track.Title;
    document.querySelector('#now-playing__artist').textContent = track.Artist;
    coverImg.src = src;
    fullCoverImg.src = src;

    lastTrackIndex = currentIndex;
}

/**
 * Переключает на следующий трек.
 * @async
 */
async function nextTrack() {
    removeTrackHighlight(lastTrackIndex);
    await window.chrome.webview.hostObjects.musicLibrary.PlayNext();

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    addTrackHighlight(lastTrackIndex);
    showPauseButton();
    startProgressUpdate();
    await updateUIForCurrentTrack();
}

/**
 * Переключает на предыдущий трек.
 * @async
 */
async function previousTrack() {
    removeTrackHighlight(lastTrackIndex);
    await window.chrome.webview.hostObjects.musicLibrary.PlayPrevious();

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    addTrackHighlight(lastTrackIndex);
    showPauseButton();
    startProgressUpdate();
    await updateUIForCurrentTrack();
}

/**
 * Воспроизводит первый трек, если ничего не выбрано, или переключает Play/Pause.
 * @async
 */
async function playOrResume() {
    try {
        await window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();

        const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();

        if (currentIndex < 0) {
            await window.chrome.webview.hostObjects.musicLibrary.PlayFirstIfNotPlaying();
        }

        const newIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();

        if (newIndex >= 0) {
            await updateUIByIndex(newIndex);
            showPauseButton();
            startProgressUpdate();
        }
    } catch (e) {
        console.error('Ошибка playOrResume:', e);
    }
}

/**
 * Ставит трек на паузу.
 */
function pause() {
    window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
    showPlayButton();
    stopProgressUpdate();
}

/**
 * Изменяет громкость.
 * @param {number} value - Значение громкости (0–100).
 */
function changeVolume(value) {
    const volume = value / 100;
    const slider = document.getElementById('player__volume-slider');

    window.chrome.webview.hostObjects.musicLibrary.SetVolume(volume);
    slider.style.setProperty('--volume', `${value}%`);
}

/**
 * Показывает кнопку Play, скрывает Pause.
 */
function showPlayButton() {
    document.querySelector('.play').classList.remove('u-hidden');
    document.querySelector('.pause').classList.add('u-hidden');
}

/**
 * Показывает кнопку Pause, скрывает Play.
 */
function showPauseButton() {
    document.querySelector('.play').classList.add('u-hidden');
    document.querySelector('.pause').classList.remove('u-hidden');
}

/**
 * Запускает периодическое обновление ползунка прогресса и времени трека.
 */
function startProgressUpdate() {
    stopProgressUpdate();

    updateInterval = setInterval(async () => {
        const current = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentPosition();
        const total = await window.chrome.webview.hostObjects.musicLibrary.GetTotalDuration();
        const slider = document.getElementById('time-progress');
        const percent = total > 0 ? (current / total) * 100 : 0;

        slider.max = total;
        slider.value = current;
        slider.style.setProperty('--volume', `${percent}%`);
        document.querySelector('#player__time--elapsed').textContent = formatTime(current);

        if (total > 0 && current >= total - 0.5) {
            stopProgressUpdate();
            removeTrackHighlight(lastTrackIndex);
            await window.chrome.webview.hostObjects.musicLibrary.PlayNext();

            lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
            addTrackHighlight(lastTrackIndex);
            await updateUIByIndex(lastTrackIndex);
            showPauseButton();
            startProgressUpdate();
        }
    }, 500);
}

/**
 * Останавливает обновление ползунка прогресса.
 */
function stopProgressUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
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
 * Переключает режим воспроизведения: последовательный / случайный.
 */
function toggleMode() {
    const btn = document.getElementById('btn-shuffle');
    const isActive = btn.classList.contains('active');

    if (isActive) {
        btn.classList.remove('active');
        window.chrome.webview.hostObjects.musicLibrary.SetMode('sequential');
    } else {
        btn.classList.add('active');
        window.chrome.webview.hostObjects.musicLibrary.SetMode('shuffle');
    }
}

/**
 * Обрабатывает нажатие на пункты бокового меню (Library / Playlists / Now Playing).
 * @param {number} value - 0 = Library, 1 = Playlists, 2 = Now Playing.
 */
function toggleControl(value) {
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

    if (value === 0) {
        library.classList.remove('u-hidden');
        playlists.classList.add('u-hidden');
        nowPlaying.classList.remove('visible');
        cover.classList.remove('open');
    } else if (value === 1) {
        playlists.classList.remove('u-hidden');
        library.classList.add('u-hidden');
        nowPlaying.classList.remove('visible');
        cover.classList.remove('open');
    } else if (value === 2) {
        nowPlaying.classList.toggle('visible');
        cover.classList.toggle('open');
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

// Инициализация после загрузки DOM
window.addEventListener('DOMContentLoaded', async () => {
    await window.chrome.webview.hostObjects.musicLibrary.SetVolume(0.4);
    await loadTracks();
    showPlayButton();
    toggleControl(0);

    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (tracks.length > 0) {
        await updateUIByIndex(0);
        lastTrackIndex = 0;
        addTrackHighlight(0);
        showPlayButton();
    }

    let isDragging = false;
    document.getElementById('top-bar').addEventListener('mousedown', (e) => {
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

    const volumeSlider = document.getElementById('player__volume-slider');
    volumeSlider.style.setProperty('--volume', '40%');
});