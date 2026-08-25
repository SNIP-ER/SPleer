/**
 * Показ содержимого плейлиста.
 * @async
 */
async function openPlaylist(id, name, count, coverPath, duration) {
    currentPlaylistId = id;
    currentPlaylistData = { id, name, count, coverPath, duration };
    
    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(id);
    const tracks = JSON.parse(tracksJson);

    const totalDuration = formatTotalDuration(tracks);
    const coverSrc = coverPath && count > 0
    ? `https://appfiles.local/${coverPath}`
    : (tracks.length > 0
        ? getTrackCoverSrc(tracks[0])
        : 'https://splayer.web/Image/no-cover.svg');

    const container = document.getElementById('open-playlist-content');
    container.innerHTML = ''

    const title = document.createElement('div');
    title.className = 'container';
    title.innerHTML = `
        <div class='playlist__header'>
            <div class='playlist__header--cover cursor-pointer'><img src='${coverSrc}'></div>

            <div class='playlist__header--title'>
                <div class='marquee cursor-pointer playlist__header--text' contenteditable='true' onblur='renamePlaylist(${id}, this.textContent)'>${escapeHtml(name)}</div>

                <div class='playlist__header--info'>
                    <div class='playlist__info--text'>${t('playlist.tracks', { count })}</div>
                    <div class='separator'></div>
                    <div class='playlist__info--text'>${totalDuration}</div>
                </div>

                <div class='playlist__buttons'>
                    <div class='cursor-pointer playlist-play playlist__buttons--play' role="button" tabindex="0" onclick="playPlaylist()"><div class='playlist__icon playlist__play'></div>${t('playlist.play')}</div>
                    <div class='cursor-pointer playlist-pause playlist__buttons--play' role="button" tabindex="0" onclick="pause()"><div class='playlist__icon playlist__pause'></div>${t('playlist.stop')}</div>
                    <div class='cursor-pointer playlist__buttons--toggle' role="button" tabindex="0" onclick="toggleMode()"><img src='Image/toggle.svg'></div>
                    <div class='cursor-pointer playlist__buttons--toggle special' role="button" tabindex="0" onclick="deletePlaylist(${id})"><img src='Image/recycleBin.svg'></div>
                </div>
            </div>
        </div>

        <div class='playlist--library__row--header'>
            <div class='playlist__col'>#</div>
            <div class='playlist__col sortable' data-sort='title' onclick="sortByColumn('playlist', 'title')">${t('title')}<span class='sort-arrow'></span></div>
            <div class='playlist__col sortable' data-sort='artist' onclick="sortByColumn('playlist', 'artist')">${t('artist')}<span class='sort-arrow'></span></div>
            <div class='playlist__col sortable' data-sort='album' onclick="sortByColumn('playlist', 'album')">${t('album')}<span class='sort-arrow'></span></div>
            <div></div>
            <div class='playlist__col sortable' data-sort='duration' onclick="sortByColumn('playlist', 'duration')"><img src="Image/time.svg"><span class='sort-arrow'></span></div>
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

    activateMarquees(document.getElementById('open-playlist-content'));

    const body = document.createElement('div');
    body.className = 'scrollbar-thin'
    body.id = 'playlist__tracks-body';
    container.appendChild(body);

    await refreshView('playlist');
    await updatePlaylistPlayButton();
}

/**
 * Обновляет кнопку Play/Pause в открытом плейлисте независимо от основного плеера.
 * @async
 */
async function updatePlaylistPlayButton() {
    if (currentPlaylistId === null) return;

    const playBtn = document.querySelector('.playlist-play');
    const pauseBtn = document.querySelector('.playlist-pause');
    if (!playBtn || !pauseBtn) return;

    const state = await window.chrome.webview.hostObjects.musicLibrary.GetPlayerState();
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();

    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(currentPlaylistId);
    const tracks = JSON.parse(tracksJson);
    const isCurrentTrackInPlaylist = tracks.some(t => t.FilePath === currentTrackPath);

    const isPlayingThisPlaylist = state === 1 && isCurrentTrackInPlaylist;

    playBtn.classList.toggle('u-hidden', isPlayingThisPlaylist);
    pauseBtn.classList.toggle('u-hidden', !isPlayingThisPlaylist);
}

/**
 * Отрисовывает список треков в открытом плейлисте.
 * @param {Array<Object>} tracks - Массив треков плейлиста.
 * @param {number} playlistId - ID плейлиста (нужен для кнопки удаления трека).
 */
function renderPlaylistRows(tracks, playlistId) {
    const body = document.getElementById('playlist__tracks-body');
    if (!body) return;

    body.innerHTML = '';

    tracks.forEach((track, index) => {
        const coverSrc = getTrackCoverSrc(track);

        const row = document.createElement('div');
        row.className = 'cursor-pointer playlist--library__row';
        row.innerHTML = `
            <div class='playlist--library__text playlist--library__col--number' id='playlist-track-number-${index}'>
                <span class='library__number'>${index + 1}</span>
                <img class='library__play-icon' src='Image/play.svg'>
            </div>
            <div class='playlist--library__text playlist--library__col--title'>
                    <img class='library__cover' src='${coverSrc}'>
                    <span class='marquee'>${escapeHtml(track.Title)}</span>
            </div>
            <div class='playlist--library__text playlist--library__col--artist marquee'>${escapeHtml(track.Artist)}</div>
            <div class='playlist--library__text playlist--library__col--album marquee'>${escapeHtml(track.Album) || '—'}</div>
            <div class='cursor-pointer popup-item__check' onclick='event.stopPropagation(); removeFromPlaylist(${playlistId})'><img src='Image/check.svg'></div>
            <div class='playlist--library__text playlist--library__text--time'>${track.DurationFormatted}</div>
        `;
        row.addEventListener('click', () => playByPath(track.FilePath));
        body.appendChild(row);

        activateMarquees(document.getElementById('playlist__tracks-body'));
    });

    activateMarquees(document.getElementById('playlist__tracks-body'));
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
        return `${hours}${t('playlist.h')} ${minutes}${t('playlist.m')}`;
    }
    return `${minutes}${t('playlist.m')}`;
}

/**
 * Снимает подсветку со всех треков в открытом плейлисте.
 */
function clearPlaylistTrackHighlight() {
    document.querySelectorAll('#playlist__tracks-body .library__number--active')
        .forEach(el => el.classList.remove('library__number--active'));
}

/**
 * Подсвечивает трек в открытом плейлисте, если он сейчас играет.
 * @async
 */
async function updatePlaylistTrackHighlight() {
    if (currentPlaylistId === null) return;

    clearPlaylistTrackHighlight();

    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    if (!currentTrackPath) return;

    const tracksJson = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistTracksJson(currentPlaylistId);
    const tracks = JSON.parse(tracksJson);
    const index = tracks.findIndex(t => t.FilePath === currentTrackPath);

    if (index >= 0) {
        const el = document.getElementById(`playlist-track-number-${index}`);
        if (el) el.classList.add('library__number--active');
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

    return 'https://splayer.web/Image/no-cover.svg';
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
 * Создание плейлиста.
 * @async
 */
async function createPlaylist() {
    await window.chrome.webview.hostObjects.musicLibrary.CreatePlaylist(t('playlist.newName'));
    await loadPlaylists(); // Обновить список
    
    const popup = document.getElementById('player__add-popup');
    if (!popup.classList.contains('u-hidden')) {
        openPlaylistsList();
    }
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
 * Удаление плейлиста.
 * @param {number} playlistId - Номер плейлиста.
 * @async
 */
async function deletePlaylist(playlistId) {
    await window.chrome.webview.hostObjects.musicLibrary.DeletePlaylist(playlistId);
    toggleTab(1); 
}

/**
 * Добавляет текущий трек в выбранный плейлист.
 * @param {number} playlistId - ID плейлиста.
 * @async
 */
async function addToPlaylist(playlistId) {
    const currentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    if (!currentTrackPath) {
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
 * Удаляет трек из выбранного плейлиста.
 * @param {number} playlistId - ID плейлиста.
 * @param {string} [trackPath] - Не используется, оставлен для обратной совместимости вызова.
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
            <div class='marquee playlist-card__title'>${escapeHtml(playlist.Name)}</div>
            <div class='playlist-card__count'>${t('playlist.tracks', { count: playlist.ActiveTrackCount })}</div>
        `;
        container.appendChild(card);

        card.addEventListener('click', () => {
            openPlaylist(playlist.Id, playlist.Name, playlist.ActiveTrackCount, playlist.CoverPath, '')
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
        <div id='playlist-card__title--create'>${t('playlist.newName')}</div>
    `;
    createCard.addEventListener('click', () => createPlaylist());
    container.appendChild(createCard);

    activateMarquees(document.getElementById('playlists-grid'));
}

/**
 * Список доступных плейлистов.
 * @async
 */
async function openPlaylistsList() {
    const popup = document.getElementById('player__add-popup');

    cachedPopupCurrentTrackPath = await window.chrome.webview.hostObjects.musicLibrary.GetCurrentTrackPath();
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetPlaylistsJson();
    cachedPopupPlaylists = JSON.parse(json);

    await renderPlaylistPopupItems(cachedPopupPlaylists);
    popup.classList.remove('u-hidden');
}

/**
 * Отрисовывает список плейлистов в попапе добавления трека.
 * @param {Array<PlaylistData>} playlists - Массив плейлистов для отображения.
 * @async
 */
async function renderPlaylistPopupItems(playlists) {
    const listContainer = document.getElementById('player__add-popup-list');
    listContainer.innerHTML = '';

    for (const playlist of playlists) {
        const coverSrc = await getPlaylistCoverSrc(playlist);

        const item = document.createElement('div');
        item.className = 'popup-item scrollbar-thin';

        let isAdded = false;
        if (cachedPopupCurrentTrackPath) {
            isAdded = await window.chrome.webview.hostObjects.musicLibrary.IsTrackInPlaylist(playlist.Id, cachedPopupCurrentTrackPath);
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
}

/**
 * Фильтрует список плейлистов в попапе по названию.
 * @param {string} query - Текст поиска.
 */
function searchPlaylistPopup(query) {
    clearTimeout(playlistSearchDebounceTimer);
    playlistSearchDebounceTimer = setTimeout(async () => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? cachedPopupPlaylists.filter(p => p.Name.toLowerCase().includes(q))
            : cachedPopupPlaylists;

        await renderPlaylistPopupItems(filtered);
    }, 150);
}

/**
 * Закрытие списка плейлиста.
 */
function closePlaylistsList() {
    const container = document.getElementById('player__add-popup');
    container.classList.add('u-hidden');

    const searchInput = document.getElementById('playlist-popup-search-input');
    if (searchInput) searchInput.value = '';
}