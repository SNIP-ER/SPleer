let updateInterval;
let lastTrackIndex = -1;
let isMaximized = false;
let savedVolume = 40;
let lastClickTime = 0;

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

            if (tracks.length == 0) {
                document.getElementById('player__cover-img').classList.add('u-hidden');
                document.getElementById('player__cover').classList.add('u-hidden');
            }
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
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (tracks.length === 0) return;
    
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

    if (index > 0) {
        document.getElementById('player__cover-img').classList.remove('u-hidden');
        document.getElementById('player__cover').classList.remove('u-hidden');
    }

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
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (tracks.length === 0) return;

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
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (tracks.length === 0) return;

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
        const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
        const tracks = JSON.parse(json);

        if (tracks.length === 0) return;

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
 * Создание карточек с плейлистами.
 */
async function loadPlaylists() {
    const container = document.getElementById('playlists-grid');
    container.innerHTML = '';

    // Получение плейлистов
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistsJson();
    const playlists = JSON.parse(json);

    // Обычные плейлисты
    playlists.forEach(playlist => {
        const card = document.createElement('div');

        card.className = 'playlist-card playlist-card--common cursor-pointer';
        card.innerHTML = `
            <img class='playlist-card__cover' src='${playlist.CoverPath || 'https://placehold.co/172x172/3a3f47/E0E0E0?text=Playlist'}'>
            <div class='playlist-card__title'>${playlist.Name}</div>
            <div class='playlist-card__count'>${playlist.TrackPaths ? playlist.TrackPaths.length : 0} Tracks</div>
        `;
        container.appendChild(card);
    });

    // "Создать" плейлисты
    const createCard = document.createElement('div');

    createCard.className = 'playlist-card playlist-card--create cursor-pointer';
    createCard.innerHTML = `
        <div id='playlist-card__cover--create'>
            <div id='playlist-card__plus'><img src="Image/plus.svg"></div>
        </div>
        <div id='playlist-card__title--create'>New Playlist</div>
    `;
    createCard.addEventListener('click', () => createPlaylist());
    container.appendChild(createCard);
}

/**
 * Создание плейлиста.
 */
async function createPlaylist() {
    await window.chrome.webview.hostObjects.musicLibrary.CreatePlaylist(name);
    await loadPlaylists(); // Обновить список
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
 * Включает и выключает зацикливание трека.
 */
function toggleRepeat() {
    const btn = document.getElementById('btn-repeat');
    const isActive = btn.classList.contains('active');

    if (isActive) {
        btn.classList.remove('active');
    } else {
        btn.classList.add('active');
    }

    window.chrome.webview.hostObjects.musicLibrary.ToggleRepeatOne();
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
        loadPlaylists();
    } else if (value === 2) {
        nowPlaying.classList.toggle('visible');
        cover.classList.toggle('open');
    }
}

/**
 * Кнопка выключить и включить звук.
 */
function toggleVolume() {
    const volume = document.getElementById('player__volume-icon');
    const volumeNot = document.getElementById('player__volumeNot-icon');
    const slider = document.getElementById('player__volume-slider');
    const currentVolume = parseFloat(slider.value);

    if (currentVolume > 0) {
        volume.classList.add('u-hidden');
        volumeNot.classList.remove('u-hidden');
        savedVolume = currentVolume;
        slider.value = 0;
    }
    else {
        volume.classList.remove('u-hidden');
        volumeNot.classList.add('u-hidden');
        slider.value = savedVolume;;
    }

    changeVolume(slider.value);
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
    const topBar = document.getElementById('top-bar');

    if (tracks.length > 0) {
        await updateUIByIndex(0);
        lastTrackIndex = 0;
        addTrackHighlight(0);
        showPlayButton();
    } else {
        document.getElementById('player__cover-img').classList.add('u-hidden');
        document.getElementById('player__cover').classList.add('u-hidden');
    }

    let isDragging = false;
    topBar.addEventListener('mousedown', (e) => {
        const now = Date.now();

        // Проверка на двойной клик
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
    /*topBar.addEventListener('dblclick', () => {
        window.chrome.webview.hostObjects.musicLibrary.MaximizeRestoreWindow();
    });*/
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
    savedVolume = parseFloat(volumeSlider.value);
    window.chrome.webview.hostObjects.musicLibrary.SetVolume(savedVolume / 100);
});