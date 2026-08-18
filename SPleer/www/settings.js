let settingsOpen = false;

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
        const currentValue = saved[setting.key] ?? setting.default;

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
 * Сохраняет значение настройки.
 */
async function updateSetting(key, value) {
    await window.chrome.webview.hostObjects.musicLibrary.SetSetting(key, String(value));
}

/**
 * Выбор папки с музыкой.
 * @param {*} key 
 */
async function pickSettingFolder(key) {
    const path = await window.chrome.webview.hostObjects.musicLibrary.PickFolder();
    if (path) {
        await updateSetting(key, path);
        document.getElementById(`${key}-path`).textContent = path;
    }
}

/**
 * Возвращает HTML для конкретного типа контрола настройки.
 * @param {*} setting 
 * @param {*} currentValue 
 * @returns 
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
            return `<button onclick="pickSettingFolder('${setting.key}')">Выбрать</button><span id='${setting.key}-path'>${escapeHtml(currentValue || '')}</span>`;
        default:
            return `<input type='text' value='${escapeHtml(currentValue || '')}' onchange="updateSetting('${setting.key}', this.value)">`;
    }
}