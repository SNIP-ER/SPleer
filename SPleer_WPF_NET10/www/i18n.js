let translations = {};

/**
 * Загружает файл перевода для указанного языка.
 * @param {string} lang - Код языка ('en', 'ru').
 * @async
 */
async function loadLanguage(lang) {
    const response = await fetch(`https://splayer.web/lang/${lang}.json`);
    translations = await response.json();
    applyTranslations();
}

/**
 * Возвращает переведённую строку по ключу.
 * @param {string} key - Ключ перевода.
 * @returns {string} Переведённая строка, либо сам ключ, если перевод не найден.
 */
function t(key, params = {}) {
    let str = translations[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}

/**
 * Применяет переводы ко всем элементам с атрибутом data-i18n.
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}