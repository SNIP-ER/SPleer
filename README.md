
<h1 align="center">
  <br>
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/logo.png" alt="SPleer" width="200">
  <br>
  SPleer
  <br>
</h1>

<h4 align="center">Оффлайн плеер на WPF + Chromium</h4>

<p align="center">
  <img src="https://img.shields.io/badge/.NET-8.0%2C%2010.0-512BD4" alt=".NET">
  <img src="https://img.shields.io/badge/language-C%23%2C%20JS%2C%20HTML%2C%20CSS-239120" alt="language">
  <img src="https://img.shields.io/badge/OS-windows%2010/11-0078D4" alt="OS">
  <img src="https://img.shields.io/github/v/release/SNIP-ER/SPleer" alt="GitHub release">
</p>

<div align="center">
  
**🇷🇺 Русский • [🇬🇧 English](EnREADME.md)**

</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/library.png" alt="Library" width="390">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/playlist.png" alt="Playlist" width="390">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/track.png" alt="Track" width="390">
</div>

## Навигация

- [Что такое](#что-такое)
- [Функционал](#функционал)
- [Добавление языков](#добавление-языков)
- [Требования](#требования)
- [Установка](#установка)
- [Сторонние библиотеки](#сторонние-библиотеки)

<br>

## Что такое

**SPleer** - оффлайн плеер для ПК, дизайн вдохновлен Spotify. Воспроизводит аудио файлы различных форматов, отображает данные их тегов. Работает полностью без интернета, на его работу не влияют прокси, VPN и другие подобные вещи.

<br>

## Функционал

- Поддерживает форматы файлов: `.mp3` `.wav` `.m4a` `.wma` `.ogg` `.flac` `.aiff` `.aif` `.opus`
- Сортировка и поиск треков
- Возможность создавать плейлисты
- Поддерживаются различные языки и темы
- Возможность указывать папку с музыкой

<br>

## Добавление языков

Доступна возможность перевести интерфейс на любой нужный язык. Для этого нужно: 
1) В папке ```www/lang``` создать новый файл с расширением `.json`
2) Перенести все теги из имеющихся файлов в новый с заменой значений
3) В файле ```www/state.js``` в константе ```languageCodes``` записать новый язык
4) В файле ```www/state.js``` в константе ```settingsSchema``` дописать пункт в ```key: 'language'``` для нового языка *(для отображения его выбора в настройках)*

<br>

## Требования

- **Windows 10** *(версия 1709+)* или **Windows 11**
- Ничего дополнительно устанавливать не нужно — WebView2 Runtime уже предустановлен в актуальных версиях Windows

<br>

## Установка

1) Перейдите в раздел с [релизами](https://github.com/SNIP-ER/SPleer/releases) и скачайте архив `.rar` последней версии *(или любой другой)*
2) Распакуйте все в одну любую папку

- `.exe` - файл который запускает программу
- ```Music``` - папка *по умолчанию*, в которую нужно перенести треки 
- ```Covers``` - папка с обложками файлов из папки с музыкой
- ```www``` - папка с web-файлами
- ```www/Fonts``` - папка со всеми шрифтами
- ```www/Image``` - папка со всеми системными изображениями
- ```www/lang``` - папка со словарями языков

<br>

## Сторонние библиотеки

| Библиотека | Назначение | Лицензия |
|---|---|---|
| [NAudio](https://github.com/naudio/NAudio) | Воспроизведение аудио | MIT |
| [libsndfile](https://github.com/libsndfile/libsndfile) | Декодирование FLAC / OGG / Opus / AIFF | LGPL v2.1 или v3 (см. [THIRD-PARTY-LICENSES/](./THIRD-PARTY-LICENSES/)) |
| [TagLib#](https://github.com/mono/taglib-sharp) | Чтение метаданных и обложек | LGPL-2.1 |
| [Microsoft.Web.WebView2](https://www.nuget.org/packages/Microsoft.Web.WebView2/) | Отображение интерфейса | Microsoft |

SPleer использует **libsndfile**, распространяемую под GNU Lesser General Public License (версия 2.1 или, по выбору, версия 3). Полные тексты лицензий — в папке [`THIRD-PARTY-LICENSES/`](./THIRD-PARTY-LICENSES/).
