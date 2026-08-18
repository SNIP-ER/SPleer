let searchDebounceTimer = null;
let globalSearchQuery = '';

/**
 * Загружает список треков из C#.
 * @async
 */
async function loadTracks() {
    await refreshView('library');
}

/**
 * Общий пайплайн: получить треки → отфильтровать по поиску → отсортировать → применить порядок → отрисовать.
 * @param {'library'|'playlist'} context - Какое представление сортируется.
 * @async
 */
async function refreshView(context) {
    const config = sortConfigs[context];
    let tracks = await config.fetch();

    if (globalSearchQuery) {
        const q = globalSearchQuery.toLowerCase();
        tracks = tracks.filter(t =>
            t.Title.toLowerCase().includes(q) ||
            t.Artist.toLowerCase().includes(q) ||
            t.Album.toLowerCase().includes(q)
        );
    }

    if (config.column) {
        tracks = sortTracksArray(tracks, config.column, config.ascending);
    }

    await applyActiveOrder(tracks.map(t => t.FilePath));
    config.render(tracks);
}

/**
 * Сортирует треки в указанном представлении (библиотека или открытый плейлист).
 * @param {'library'|'playlist'} context - Какое представление сортируется.
 * @param {string} column - Поле: title, artist, album, duration.
 * @async
 */
async function sortByColumn(context, column) {
    const config = sortConfigs[context];

    if (config.column === column) {
        config.ascending = !config.ascending;
    } else {
        config.column = column;
        config.ascending = true;
    }

    updateSortIndicators(config);
    await refreshView(context);
}

/**
 * Вызывается из C# при изменении состава файлов в папке с музыкой.
 * @async
 */
async function onLibraryChanged() {
    await refreshView('library');
}

/**
 * Фильтрует отображаемые треки по поисковому запросу (с небольшой задержкой при вводе).
 * @param {string} query - Текст поиска.
 */
function searchTracks(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        globalSearchQuery = query.trim();
        await refreshView('library');

        if (currentPlaylistId !== null) {
            await refreshView('playlist');
        }
    }, 200);
}

/**
 * Сортирует переданный массив треков по указанному полю.
 * @param {Array<Object>} tracksArray - Массив треков для сортировки.
 * @param {string} column - Поле сортировки: title, artist, album или duration.
 * @param {boolean} ascending - true — по возрастанию, false — по убыванию.
 * @returns {Array<Object>} Новый отсортированный массив (исходный не изменяется).
 */
function sortTracksArray(tracksArray, column, ascending) {
    const collator = new Intl.Collator('ru');
    const comparators = {
        artist: (a, b) => collator.compare(a.Artist, b.Artist),
        album: (a, b) => collator.compare(a.Album, b.Album),
        duration: (a, b) => a.DurationSeconds - b.DurationSeconds,
        title: (a, b) => collator.compare(a.Title, b.Title),
    };
    const compare = comparators[column] ?? comparators.title;
    return [...tracksArray].sort((a, b) => ascending ? compare(a, b) : compare(b, a));
}

/**
 * Обновляет визуальные индикаторы (стрелки) сортировки у заголовков колонок текущего контекста.
 * @param {Object} config - Конфиг контекста из sortConfigs (library или playlist).
 */
function updateSortIndicators(config) {
    const container = document.querySelector(config.headerContainer);
    if (!container) return;

    container.querySelectorAll('.sortable').forEach(el => {
        el.classList.remove('sort-active', 'sort-desc');
    });

    const activeHeader = container.querySelector(`[data-sort="${config.column}"]`);
    if (activeHeader) {
        activeHeader.classList.add('sort-active');
        if (!config.ascending) activeHeader.classList.add('sort-desc');
    }
}