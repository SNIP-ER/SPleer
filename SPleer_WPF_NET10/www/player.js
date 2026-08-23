let volumeSaveDebounceTimer = null;

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
 * Ставит трек на паузу.
 * @async
 */
async function pause() {
    await window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
    showPlayButton();
    stopProgressUpdate();
}

/**
 * Воспроизводит трек по пути.
 * @param {string} filePath - Путь файла.
 * @async
 */
async function playByPath(filePath) {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);
    if (tracks.length === 0) return;

    if (currentPlayingPath === filePath) {
        const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();

        if (state === 1) {
            await window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
            showPlayButton();
            stopProgressUpdate();
        } else {
            await window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();
            const newState = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();
            if (newState === 0) {
                await window.chrome.webview.hostObjects.musicLibrary.PlayTrack(filePath);
            }
            showPauseButton();
            startProgressUpdate();
        }
        return;
    }
    currentPlayingPath = filePath;

    const index = tracks.findIndex(t => t.FilePath === filePath);
    if (index === -1) return;

    removeTrackHighlight(lastTrackIndex);
    await window.chrome.webview.hostObjects.musicLibrary.PlayByIndex(index);
    addTrackHighlight(index);

    lastTrackIndex = index;
    showPauseButton();
    startProgressUpdate();
    updateUIByIndex(index);
}

/**
 * Воспроизводит первый трек в плейлисте, если ничего не выбрано, или переключает Play/Pause.
 * @async
 */
async function playPlaylist() {
    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(currentPlaylistId);
    const tracks = JSON.parse(tracksJson);
    if (tracks.length === 0) return;

    const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    const isCurrentTrackInPlaylist = tracks.some(t => t.FilePath === currentTrackPath);

    if (state === 1 && isCurrentTrackInPlaylist) {
        await window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
        showPlayButton();
        stopProgressUpdate();
        return;
    }

    if (isCurrentTrackInPlaylist) {
        await window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();
    } else {
        await playByPath(tracks[0].FilePath);
    }

    showPauseButton();
    startProgressUpdate();
}

/**
 * Переключает трек.
 * @param {number} param - 0 = следующий, 1 = предыдущий.
 * @async
 */
async function flipTrack(param) {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (tracks.length === 0) return;

    removeTrackHighlight(lastTrackIndex);
    if (param === 0) {
        await window.chrome.webview.hostObjects.musicLibrary.PlayNext();
    } else if (param === 1) {
        await window.chrome.webview.hostObjects.musicLibrary.PlayPrevious();
    }

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    addTrackHighlight(lastTrackIndex);
    showPauseButton();
    startProgressUpdate();
    await updateUIForCurrentTrack();
}

/**
 * Обновляет интерфейс плеера данными текущего трека из C#.
 * @async
 */
async function updateUIForCurrentTrack() {
    const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    if (currentIndex < 0) return;

    await updateUIByIndex(currentIndex);
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

    document.getElementById('player__cover-img').classList.remove('u-hidden');
    document.getElementById('player__cover').classList.remove('u-hidden');

    const track = tracks[index];
    const coverImg = document.querySelector('#player__cover-img');
    const fullCoverImg = document.querySelector('#now-playing__cover-img');
    const src = getTrackCoverSrc(track);

    document.querySelector('#player__title').textContent = track.Title;
    document.querySelector('#player__artist').textContent = track.Artist;
    document.querySelector('#player__time--total').textContent = track.DurationFormatted;
    document.querySelector('#now-playing__title').textContent = track.Title;
    document.querySelector('#now-playing__artist').textContent = track.Artist;

    coverImg.src = src;
    fullCoverImg.src = src;

    lastTrackIndex = index;
}

/**
 * Переключает режим воспроизведения: последовательный / случайный.
 */
function toggleMode() {
    const btn = document.getElementById('btn-shuffle');
    const btn2 = document.querySelector('.playlist__buttons--toggle')
    const isActive = btn.classList.contains('active');

    if (isActive) {
        btn.classList.remove('active');
        btn2?.classList.remove('active');
        window.chrome.webview.hostObjects.musicLibrary.SetMode('sequential');
    } else {
        btn.classList.add('active');
        btn2?.classList.add('active');
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

/**
 * Изменяет громкость.
 * @param {number} value - Значение громкости (0–100).
 */
function changeVolume(value) {
    const volume = value / 100;
    const slider = document.getElementById('player__volume-slider');

    window.chrome.webview.hostObjects.musicLibrary.SetVolume(volume);
    slider.style.setProperty('--volume', `${value}%`);

    clearTimeout(volumeSaveDebounceTimer);
    volumeSaveDebounceTimer = setTimeout(async () => {
        await window.chrome.webview.hostObjects.musicLibrary.SetSetting('volume', String(value));
    }, 300);
}

/**
 * Восстанавливает сохранённую громкость плеера и применяет её.
 * @param {Object} savedSettings - Сохранённые настройки, полученные через getSavedSettings.
 * @async
 */
async function initVolume(savedSettings) {
    const volumeSlider = document.getElementById('player__volume-slider');
    const storedVolume = savedSettings.volume ? parseFloat(savedSettings.volume) : 40;

    savedVolume = storedVolume;
    volumeSlider.value = storedVolume;
    volumeSlider.style.setProperty('--volume', `${storedVolume}%`);
    await window.chrome.webview.hostObjects.musicLibrary.SetVolume(storedVolume / 100);
}

/**
 * Показывает кнопку Play, скрывает Pause.
 */
function showPlayButton() {
    document.querySelectorAll('.play').forEach(el => el.classList.remove('u-hidden'));
    document.querySelectorAll('.pause').forEach(el => el.classList.add('u-hidden'));
    updatePlaylistPlayButton();
    updatePlaylistTrackHighlight();
}

/**
 * Показывает кнопку Pause, скрывает Play.
 */
function showPauseButton() {
    document.querySelectorAll('.play').forEach(el => el.classList.add('u-hidden'));
    document.querySelectorAll('.pause').forEach(el => el.classList.remove('u-hidden'));
    updatePlaylistPlayButton();
    updatePlaylistTrackHighlight();
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