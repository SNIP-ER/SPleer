/**
 * @typedef {Object} PlaylistData
 * @property {number} Id - Уникальный идентификатор плейлиста.
 * @property {string} Name - Название плейлиста.
 * @property {string|null} CoverPath - Относительный путь к файлу обложки или null, если не задан.
 * @property {string[]} TrackPaths - Список путей к файлам треков в плейлисте.
 */

let updateInterval;
let lastTrackIndex = -1;
let currentPlayingPath = -1;
let currentPlaylistId = -1;
let currentPlaylistData = null;
let isMaximized = false;
let savedVolume = 40;
let lastClickTime = 0;

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
 * Задаёт активный порядок/подмножество треков для кнопок "следующий"/"предыдущий".
 * @param {string[]|null} orderedPaths - Пути треков в нужном порядке, или null для сброса к порядку всей библиотеки.
 * @async
 */
async function applyActiveOrder(orderedPaths) {
    const json = orderedPaths ? JSON.stringify(orderedPaths) : null;
    await window.chrome.webview.hostObjects.musicLibrary.SetActiveOrderJson(json);
}

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
            const coverSrc = `https://appfiles.local/${track.CoverPath}`;

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
    const src = `https://appfiles.local/${track.CoverPath}`;

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
    const src = `https://appfiles.local/${track.CoverPath}`;

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
 * Обновляет изображение обложки и видимость кнопки удаления по актуальным данным плейлиста.
 * @param {HTMLElement} coverElement - Контейнер обложки плейлиста.
 * @param {PlaylistData} playlist - Актуальный объект плейлиста.
 * @async
 */
async function refreshPlaylistCoverUI(coverElement, playlist) {
    const src = await getPlaylistCoverSrc(playlist);
    coverElement.querySelector('img').src = src;

    let removeBtn = coverElement.querySelector('.playlist__header--cover-remove');
    if (playlist.CoverPath) {
        if (!removeBtn) {
            removeBtn = document.createElement('div');
            removeBtn.className = 'playlist__header--cover-remove';
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.chrome.webview.hostObjects.musicLibrary.RemovePlaylistCover(playlist.Id);

                currentPlaylistData.coverPath = null;
                playlist.CoverPath = null;
                await refreshPlaylistCoverUI(coverElement, playlist);
            });

            coverElement.appendChild(removeBtn);
        }
    } else {
        removeBtn?.remove();
    }
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
 * Воспроизводит первый трек в плейлисте, если ничего не выбрано, или переключает Play/Pause.
 * @async
 */
async function playPlaylist() {
    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(currentPlaylistId);
    const tracks = JSON.parse(tracksJson);

    if (tracks.length === 0) return;

    const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();
    if (state === 1) {
        await window.chrome.webview.hostObjects.musicLibrary.PauseTrack();
        showPlayButton();
        stopProgressUpdate();
        return;
    }

    await playByPath(tracks[0].FilePath);

    showPauseButton();
    startProgressUpdate();
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
 * Обрабатывает нажатие на пункты бокового меню (Library / Playlists / Now Playing).
 * @param {number} value - 0 = Library, 1 = Playlists, 2 = Now Playing.
 * @async
 */
async function toggleControl(value) {
    const lib = document.getElementById('nav_library');
    const pl = document.getElementById('nav_playlists');
    const cover = document.getElementById('player__cover');

    if (value === 0) {
        await applyActiveOrder(null);
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
 * Создание карточек с плейлистами.
 * @async
 */
async function loadPlaylists() {
    const container = document.getElementById('playlists-grid');
    container.innerHTML = '';

    // Получение плейлистов
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistsJson();
    const playlists = JSON.parse(json);

    // Обычные плейлисты
    for (const playlist of playlists) {
        const coverSrc = await getPlaylistCoverSrc(playlist);
        
        const card = document.createElement('div');
        card.className = 'playlist-card playlist-card--common cursor-pointer';
        card.innerHTML = `
            <img class='playlist-card__cover' src='${coverSrc}'>
            <div class='playlist-card__title'>${escapeHtml(playlist.Name)}</div>
            <div class='playlist-card__count'>${playlist.TrackPaths ? playlist.TrackPaths.length : 0} Tracks</div>
        `;
        container.appendChild(card);

        card.addEventListener('click', () => {
            openPlaylist(playlist.Id, playlist.Name, playlist.TrackPaths ? playlist.TrackPaths.length : 0, playlist.CoverPath, '')
            toggleTab(3);
        });
    }

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
 * @async
 */
async function createPlaylist() {
    await window.chrome.webview.hostObjects.musicLibrary.CreatePlaylist("");
    await loadPlaylists(); // Обновить список
    
    const popup = document.getElementById('player__add-popup');
    if (!popup.classList.contains('u-hidden')) {
        openPlaylistsList();
    }
}

/**
 * Удаление плейлиста.
 * @param {number} playlistId - Номер плейлиста.
 * @async
 */
async function deletePlaylist(playlistId) {
    await window.chrome.webview.hostObjects.musicLibrary.DeletePlaylist(playlistId);
    toggleTab(1); 
}

/**
 * Список доступных плейлистов.
 * @async
 */
async function openPlaylistsList() {
    const popup = document.getElementById('player__add-popup');
    const listContainer = document.getElementById('player__add-popup-list');
    listContainer.innerHTML = '';
    
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistsJson();
    const playlists = JSON.parse(json);

    for (const playlist of playlists) {
        const coverSrc = await getPlaylistCoverSrc(playlist);

        const item = document.createElement('div');
        item.className = 'popup-item scrollbar-thin';

        let isAdded = false;
        if (currentTrackPath) {
            isAdded = await window.chrome.webview.hostObjects.musicLibrary.IsTrackInPlaylist(playlist.Id, currentTrackPath);
        }

        const actionDiv = isAdded
            ? `<div class='cursor-pointer popup-item__check' onclick='removeFromPlaylist(${playlist.Id})'><img src='Image/check.svg'></div>`
            : `<div class='cursor-pointer popup-item__add' onclick='addToPlaylist(${playlist.Id})'></div>`;

        item.innerHTML = `
            <div class='popup-item__container'>
                <div class='popup-item__cover'><img src='${coverSrc}'></div>
                <div class='popup-item__name'>${escapeHtml(playlist.Name)}</div>
            </div>
            ${actionDiv}
        `;
        listContainer.appendChild(item);
    }

    popup.classList.remove('u-hidden');
}

/**
 * Добавляет текущий трек в выбранный плейлист.
 * @param {number} playlistId - ID плейлиста.
 * @async
 */
async function addToPlaylist(playlistId) {
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    if (!currentTrackPath) {
        console.log('Нет текущего трека');
        return;
    }

    await window.chrome.webview.hostObjects.musicLibrary.AddTrackToPlaylist(playlistId, currentTrackPath);
    openPlaylistsList();
    loadPlaylists();

    if (currentPlaylistId === playlistId && currentPlaylistData) {
        const d = currentPlaylistData;
        await openPlaylist(d.id, d.name, d.count, d.coverPath, d.duration);
    }
}

/**
 * Удаляет текущий трек из выбранного плейлиста.
 * @param {number} playlistId - ID плейлиста.
 * @async
 */
async function removeFromPlaylist(playlistId, trackPath) {
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    if (!currentTrackPath) return;

    await window.chrome.webview.hostObjects.musicLibrary.RemoveTrackFromPlaylist(playlistId, currentTrackPath);
    if (currentPlaylistId === playlistId && currentPlaylistData) {
        openPlaylist(currentPlaylistData.id, currentPlaylistData.name, currentPlaylistData.count, currentPlaylistData.coverPath, currentPlaylistData.duration);
    }

    const popup = document.getElementById('player__add-popup');
    if (!popup.classList.contains('u-hidden')) {
        openPlaylistsList();
    }
}

/**
 * Показ содержимого плейлиста.
 * @async
 */
async function openPlaylist(id, name, count, coverPath, duration) {
    currentPlaylistId = id;
    currentPlaylistData = { id, name, count, coverPath, duration };
    
    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(id);
    const tracks = JSON.parse(tracksJson);

    await applyActiveOrder(tracks.map(t => t.FilePath));

    const totalDuration = formatTotalDuration(tracks);
    const coverSrc = coverPath && count > 0 
    ? `https://appfiles.local/${coverPath}`
    : (tracks.length > 0 && `https://appfiles.local/${tracks[0].CoverPath}`);

    const container = document.getElementById('open-playlist-content');
    container.innerHTML = ''

    const title = document.createElement('div');
    title.className = 'container';
    title.innerHTML = `
        <div class='playlist__header'>
            <div class='playlist__header--cover cursor-pointer'><img src='${coverSrc}'></div>

            <div class='playlist__header--title'>
                <div class='cursor-pointer playlist__header--text' contenteditable='true' onblur='renamePlaylist(${id}, this.textContent)'>${escapeHtml(name)}</div>

                <div class='playlist__header--info'>
                    <div class='playlist__info--text'>${count} Tracks</div>
                    <div class='separator'></div>
                    <div class='playlist__info--text'>${totalDuration }</div>
                </div>

                <div class='playlist__buttons'>
                    <div class='cursor-pointer play playlist__buttons--play' role="button" tabindex="0" onclick="playPlaylist()"><div class='playlist__icon playlist__play'></div>Play</div>
                    <div class='cursor-pointer pause playlist__buttons--play' role="button" tabindex="0" onclick="pause()"><div class='playlist__icon playlist__pause'></div>Stop</div>
                    <div class='cursor-pointer playlist__buttons--toggle' role="button" tabindex="0" onclick="toggleMode()"><img src='Image/toggle.svg'></div>
                    <div class='cursor-pointer playlist__buttons--toggle special' role="button" tabindex="0" onclick="deletePlaylist(${id})"><img src='Image/recycleBin.svg'></div>
                </div>
            </div>
        </div>

        <div class='playlist--library__row--header'>
            <div class='playlist__col'>#</div>
            <div class='playlist__col'>TITLE</div>
            <div class='playlist__col'>ARTIST</div>
            <div class='playlist__col'>ALBUM</div>
            <div></div>
            <div class='playlist__col'><img src="Image/time.svg"></div>
        </div>
    `;
    container.appendChild(title);

    const coverElement = document.querySelector('.playlist__header--cover');
    if (coverElement) {
        coverElement.addEventListener('click', async (e) => {
            if (e.target.closest('.playlist__header--cover-remove')) return;

            const filePath = await window.chrome.webview.hostObjects.musicLibrary.PickCoverImage();
            if (filePath) {
                await window.chrome.webview.hostObjects.musicLibrary.SetPlaylistCover(id, filePath);
                const newCoverPath = `Covers/playlist_${id}.${filePath.split('.').pop()}`;

                currentPlaylistData.coverPath = newCoverPath; // обновляем общее состояние
                await refreshPlaylistCoverUI(coverElement, { Id: id, CoverPath: newCoverPath });
            }
        });

        await refreshPlaylistCoverUI(coverElement, { Id: id, CoverPath: coverPath });
    }

    const titleElement = document.querySelector('.playlist__header--text');
    if (titleElement) {
        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleElement.blur();
            }
        });
    }

    const body = document.createElement('div');
    body.className = 'scrollbar-thin'
    body.id = 'playlist__tracks-body';

    tracks.forEach((track, index) => {
        const coverSrc = `https://appfiles.local/${track.CoverPath}`;

        const row = document.createElement('div');
        row.className = 'cursor-pointer playlist--library__row';
        row.innerHTML = `
            <div class='playlist--library__text playlist--library__col--number'>${index + 1}</div>
            <div class='playlist--library__text playlist--library__col--title'>
                    <img class='library__cover' src='${coverSrc}'>
                    ${escapeHtml(track.Title)}
            </div>
            <div class='playlist--library__text playlist--library__col--artist'>${escapeHtml(track.Artist)}</div>
            <div class='playlist--library__text playlist--library__col--album'>${escapeHtml(track.Album) || '—'}</div>
            <div class='cursor-pointer popup-item__check' onclick='event.stopPropagation(); removeFromPlaylist(${id})'><img src='Image/check.svg'></div>
            <div class='playlist--library__text playlist--library__text--time'>${track.DurationFormatted}</div>
        `;
        row.addEventListener('click', () => playByPath(track.FilePath));
        body.appendChild(row);
    });

    container.appendChild(body);
    
    const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();
    if (state === 1) {
        showPauseButton();
    } else {
        showPlayButton();
    }

    const trackPaths = tracks.map(t => t.FilePath);
    await window.chrome.webview.hostObjects.musicLibrary.SetActiveOrderJson(JSON.stringify(trackPaths));
}

/**
 * Сохраняет новое название плейлиста.
 * @param {number} playlistId - ID плейлиста.
 * @param {string} newName - Новое название плейлиста.
 * @async
 */
async function renamePlaylist(playlistId, newName) {
    if (!newName.trim()) return;

    await window.chrome.webview.hostObjects.musicLibrary.RenamePlaylist(playlistId, newName.trim());
    
    const titleElement = document.querySelector('#playlist__header--text');
    if (titleElement) {
        titleElement.textContent = newName.trim();
    }
}

/**
 * Определяет URL обложки плейлиста: собственная обложка, обложка первого трека или заглушка.
 * @param {PlaylistData} playlist - Объект плейлиста. 
 * @returns {Promise<string>} URL изображения для отображения.
 * @async
 */
async function getPlaylistCoverSrc(playlist) {
    if (playlist.CoverPath) {
        const exists = await window.chrome.webview.hostObjects.musicLibrary.FileExists(playlist.CoverPath);
        if (exists) {
            const lastModified = await window.chrome.webview.hostObjects.musicLibrary.GetFileLastModified(playlist.CoverPath);
            return `https://appfiles.local/${playlist.CoverPath}?v=${lastModified}`;
        }
    }

    const firstTrackCover = await window.chrome.webview.hostObjects.musicLibrary.GetFirstTrackCoverPath(playlist.Id);
    if (firstTrackCover) return `https://appfiles.local/${firstTrackCover}`;

    return '';
}

/**
 * Закрытие списка плейлиста.
 */
function closePlaylistsList() {
    const container = document.getElementById('player__add-popup');
    container.classList.add('u-hidden');
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
    document.querySelectorAll('.play').forEach(el => el.classList.remove('u-hidden'));
    document.querySelectorAll('.pause').forEach(el => el.classList.add('u-hidden'));
}

/**
 * Показывает кнопку Pause, скрывает Play.
 */
function showPauseButton() {
    document.querySelectorAll('.play').forEach(el => el.classList.add('u-hidden'));
    document.querySelectorAll('.pause').forEach(el => el.classList.remove('u-hidden'));
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
    const btn2 = document.querySelector('.playlist__buttons--toggle')
    const isActive = btn.classList.contains('active');

    if (isActive) {
        btn.classList.remove('active');
        btn2.classList.remove('active');
        window.chrome.webview.hostObjects.musicLibrary.SetMode('sequential');
    } else {
        btn.classList.add('active');
        btn2.classList.add('active');
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
        library.classList.remove('u-hidden');
        playlists.classList.add('u-hidden');
        nowPlaying.classList.remove('visible');
        cover.classList.remove('open');
        playlist.classList.remove('visible');
    } else if (value === 1) {
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
 * Вычисляет общую длительность треков и возвращает строку в формате "Xh Ym" или "Ym".
 * @param {Array} tracks - Массив треков с полем Duration.
 * @returns {string} Отформатированная длительность.
 */
function formatTotalDuration(tracks) {
    let totalSeconds = 0;

    tracks.forEach(track => {
        const parts = track.Duration.split(':');
        if (parts.length === 3) {
            totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        } else if (parts.length === 2) {
            totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
        await window.chrome.webview.hostObjects.musicLibrary.SetCurrentTrackIndex(0);
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

    document.addEventListener('click', (e) => {
        const popup = document.getElementById('player__add-popup');
        const playlistBtn = document.getElementById('player__playlist');

        if (!popup.classList.contains('u-hidden') &&
            !popup.contains(e.target) &&
            e.target !== playlistBtn &&
            !playlistBtn.contains(e.target)) {
            popup.classList.add('u-hidden');
        }
    });

    const volumeSlider = document.getElementById('player__volume-slider');
    savedVolume = parseFloat(volumeSlider.value);
    window.chrome.webview.hostObjects.musicLibrary.SetVolume(savedVolume / 100);
});