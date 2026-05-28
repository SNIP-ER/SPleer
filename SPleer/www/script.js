let updateInterval;
let lastTrackIndex = -1;

async function loadTracks() {
    try {
        // Вызов C# метода и получение JSON-строки
        const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
        const tracks = JSON.parse(json);

        // Нахождение блока для песен
        const songsContainer = document.querySelector('.songs');

        // Очищение контейнера
        songsContainer.innerHTML = '';

        // Добавление трека
        tracks.forEach((track, index) => {
            const songElement = document.createElement('div');
            songElement.classList.add('song-item');
            songElement.textContent = track.Title;
			songElement.addEventListener('click', () => playByIndex(index));

            songsContainer.appendChild(songElement);
        });
    }
	catch (error) {
        console.error('Ошибка загрузки треков: ', error);
    }
}

async function refreshTracks() {
    try {
        // Обновления библиотеки
        await window.chrome.webview.hostObjects.musicLibrary.RefreshLibrary();
        // Перезагрузка списка треков
        await loadTracks();
    }
	catch (error) {
        console.error('Ошибка обновления:', error);
    }
}

// Воспроизведение по индексу с обновлением интерфейса
async function playByIndex(index) {
    await window.chrome.webview.hostObjects.musicLibrary.PlayByIndex(index);

    showPauseButton();
    startProgressUpdate();
    updateUIByIndex(index);

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
}

// Обновить интерфейс (название, артист, обложка) по индексу трека
async function updateUIByIndex(index) {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);

    if (index >= 0 && index < tracks.length) {
        const track = tracks[index];
        document.querySelector('.name').textContent = track.Title;
        document.querySelector('.artist').textContent = track.Artist;
        document.querySelector('.time').textContent = track.DurationFormatted;
        const image = document.querySelector('.image img');
        if (track.CoverPath) {
            image.src = 'https://appfiles.local/' + track.CoverPath;
        }
        else {
            image.src = 'https://placehold.co/300x300/3a3f47/E0E0E0?text=Music';
        }
    }
}

// 
async function updateUIForCurrentTrack() {
    console.log('updateUIForCurrentTrack вызвана');
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetTracksJson();
    const tracks = JSON.parse(json);
    
    // Получаем индекс текущего трека из C# (нужно добавить метод)
    const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    
    if (currentIndex >= 0 && currentIndex < tracks.length) {
        const track = tracks[currentIndex];
        document.querySelector('.name').textContent = track.Title;
        document.querySelector('.artist').textContent = track.Artist;
        document.querySelector('.time').textContent = track.DurationFormatted;
        const image = document.querySelector('.image img');
        if (track.CoverPath) {
            image.src = 'https://appfiles.local/' + track.CoverPath;
        } else {
            image.src = 'https://placehold.co/300x300/3a3f47/E0E0E0?text=Music';
        }
    }
}

// Кнопка "Следующий трек"
async function nextTrack() {
    await window.chrome.webview.hostObjects.musicLibrary.PlayNext();

    showPauseButton();
    startProgressUpdate();
    await updateUIForCurrentTrack();

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
}

// Кнопка "Предыдущий трек"
async function previousTrack() {
    await window.chrome.webview.hostObjects.musicLibrary.PlayPrevious();

    showPauseButton();
    startProgressUpdate();
    await updateUIForCurrentTrack();

    lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
}

// 
async function onTrackChanged() {
    const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
    
    await updateUIByIndex(currentIndex);
    showPauseButton();
    startProgressUpdate();
}

// Запуск первого трека, если другой не выбран
async function playOrResume() {
    try {
        // Сначала пробуем продолжить, если на паузе
        await window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();
        
        // Получаем индекс текущего трека
        const currentIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
        
        // Если трека нет — запускаем первый
        if (currentIndex < 0) {
            await window.chrome.webview.hostObjects.musicLibrary.PlayFirstIfNotPlaying();
        }
        
        // Обновляем интерфейс
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


// Продолжить воспроизведение трека
function resume() {
    window.chrome.webview.hostObjects.musicLibrary.ResumeTrack();

    showPauseButton();
    startProgressUpdate();
}

// Остановить воспроизведение
function pause() {
    window.chrome.webview.hostObjects.musicLibrary.PauseTrack();

    showPlayButton();
    stopProgressUpdate();
}


// Регулировка громкости
function changeVolume(value) {
    // value приходит от 0 до 100, преобразуем в 0.0–1.0
    const volume = value / 100;
    window.chrome.webview.hostObjects.musicLibrary.SetVolume(volume);
}


// Показать кнопку Play
function showPlayButton() {
    document.querySelector('.play').classList.remove('hidden');
    document.querySelector('.pause').classList.add('hidden');
}

// Показать кнопку Pause
function showPauseButton() {
    document.querySelector('.play').classList.add('hidden');
    document.querySelector('.pause').classList.remove('hidden');
}


// Начать обновлять положение ползунка
function startProgressUpdate() {
    stopProgressUpdate(); // Остановить предыдущий

    updateInterval = setInterval(async () => {
        const current = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentPosition();
        const total = await window.chrome.webview.hostObjects.musicLibrary.GetTotalDuration();
        const slider = document.getElementById('timeSlider');

        slider.max = total;
        slider.value = current;
        
        // Обновить текст времени
        document.querySelector('.timeElapsed').textContent = formatTime(current);

        // Автопереход при завершении
        if (total > 0 && current >= total - 0.5) {
            stopProgressUpdate();
            await window.chrome.webview.hostObjects.musicLibrary.PlayNext();
            lastTrackIndex = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackIndex();
            await updateUIByIndex(lastTrackIndex);
            showPauseButton();
            startProgressUpdate();
        }
    }, 500); // Обновление каждые 500 мс
}

// Перестать обновлять положение ползунка
function stopProgressUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Преобразование времени в нужный формат
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    return m + ':' + s.toString().padStart(2, '0');
}

// Обработчик перемотки
document.getElementById('timeSlider').addEventListener('input', async (e) => {
    const seconds = parseFloat(e.target.value);
    await window.chrome.webview.hostObjects.musicLibrary.SeekTo(seconds);
});


// Переключатель режима воспроизведения (sequential / shuffle)
function toggleMode() {
    const modeBtn = document.getElementById('modeToggle');

    if (modeBtn.textContent === '🔀') {
        modeBtn.textContent = '🔁';
        window.chrome.webview.hostObjects.musicLibrary.SetMode('sequential');
    } else {
        modeBtn.textContent = '🔀';
        window.chrome.webview.hostObjects.musicLibrary.SetMode('shuffle');
    }
}


// После загрузки страницы
window.addEventListener('DOMContentLoaded', () => {
    // Установить громкость по умолчанию
    window.chrome.webview.hostObjects.musicLibrary.SetVolume(0.4);

    // Загрузка треков при старте страницы
    loadTracks();

    showPlayButton();
});