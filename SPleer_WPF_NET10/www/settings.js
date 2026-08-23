let settingsOpen = false;

/**
 * Загружает все сохранённые настройки приложения из C#.
 * @returns {Promise<Object>} Объект настроек вида "ключ": "значение".
 * @async
 */
async function getSavedSettings() {
    const json = await window.chrome.webview.hostObjects.musicLibrary.GetSettingsJson();
    return JSON.parse(json);
}

/**
 * Применяет настройки, которые должны действовать сразу при запуске приложения.
 * @param {Object} savedSettings - Сохранённые настройки, полученные через getSavedSettings.
 * @async
 */
async function applySettingsOnStartup(savedSettings) {
    const normalizationEnabled = savedSettings.normalization !== false && savedSettings.normalization !== 'false';
    await window.chrome.webview.hostObjects.musicLibrary.SetNormalizationEnabled(normalizationEnabled);

    const theme = savedSettings.theme || 'Dark';
    document.documentElement.setAttribute('data-theme', theme.toLowerCase());
}

/**
 * Отображение окна с настройками.
 * @param {number} value - 0: открыть окно, 1: закрыть. 
 */
async function settings(value) {
    const settingsPanel  = document.getElementById('player__settings');

    if (settingsOpen === true && value === 0) {
        settingsPanel .classList.add('u-hidden');
        settingsOpen = false;
    }
    else if (value === 0) {
        await renderSettings();
        settingsPanel .classList.remove('u-hidden');
        settingsOpen = true;
    }
    else if (value === 1) {
        settingsPanel .classList.add('u-hidden');
        settingsOpen = false;
    }
}

/**
 * Отрисовывает все настройки из settingsSchema в контейнер.
 * @async
 */
async function renderSettings() {
    const container = document.getElementById('player__settings--list');
    container.innerHTML = '';

    const savedJson = await window.chrome.webview.hostObjects.musicLibrary.GetSettingsJson();
    const saved = JSON.parse(savedJson);

    settingsSchema.forEach(setting => {
        let currentValue = saved[setting.key] ?? setting.default;

        if (setting.type === 'toggle') {
            currentValue = currentValue === true || currentValue === 'true';
        }

        const row = document.createElement('div');
        row.className = 'settings-row';
        row.innerHTML = `
            <div class='settings-row__label'>${setting.label}</div>
            <div class='settings-row__control'>${renderControl(setting, currentValue)}</div>
        `;
        container.appendChild(row);
    });
}

/**
 * Возвращает HTML для конкретного типа контрола настройки.
 * @param {Object} setting - Описание настройки из settingsSchema.
 * @param {*} currentValue - Текущее значение настройки.
 * @returns {string} HTML-разметка контрола.
 */
function renderControl(setting, currentValue) {
    switch (setting.type) {
        case 'toggle':
            return `<input type='checkbox' ${currentValue ? 'checked' : ''} onchange="updateSetting('${setting.key}', this.checked)">`;
        case 'select':
            return `<select onchange="updateSetting('${setting.key}', this.value)">
                ${setting.options.map(o => `<option ${o === currentValue ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;
        case 'slider':
            return `<input type='range' min='${setting.min}' max='${setting.max}' value='${currentValue}' oninput="updateSetting('${setting.key}', this.value)">`;
        case 'folder':
            return `<button onclick="pickSettingFolder('${setting.key}')">Выбрать</button>`;
        case 'action':
            return `<button onclick="${setting.action}(this)">${setting.buttonLabel}</button>`;
        default:
            return `<input type='text' value='${escapeHtml(currentValue || '')}' onchange="updateSetting('${setting.key}', this.value)">`;
    }
}

/**
 * Сохраняет значение настройки.
 * @param {string} key - Ключ настройки.
 * @param {*} value - Новое значение настройки.
 * @async
 */
async function updateSetting(key, value) {
    await window.chrome.webview.hostObjects.musicLibrary.SetSetting(key, String(value));

    if (key === 'theme') {
        document.documentElement.setAttribute('data-theme', value.toLowerCase());
    }

    if (key === 'normalization') {
        await window.chrome.webview.hostObjects.musicLibrary.SetNormalizationEnabled(value);
    }
}

/**
 * Выбор папки с музыкой.
 * @param {string} key - Ключ настройки.
 * @async
 */
async function pickSettingFolder(key) {
    const path = await window.chrome.webview.hostObjects.musicLibrary.PickFolder();
    if (path) {
        await window.chrome.webview.hostObjects.musicLibrary.SetMusicFolderPath(path);
        document.getElementById(`${key}-path`).textContent = path;
    }
}

/**
 * Очищает неиспользуемые файлы обложек и обновляет кнопку с результатом.
 * @param {HTMLElement} btn - Кнопка, на которую кликнули.
 * @async
 */
async function clearCoverCache(btn) {
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        await window.chrome.webview.hostObjects.musicLibrary.CleanupOrphanedCovers();
        btn.textContent = 'Done';
    } catch (e) {
        btn.textContent = 'Error';
        console.error('Ошибка очистки кэша обложек:', e);
    } finally {
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 1500);
    }
}