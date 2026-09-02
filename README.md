
<h1 align="center">
  <br>
  <img src="https://github.com/SNIP-ER/SPleer/blob/master/Images/logo.png" alt="SPleer" width="200">
  <br>
  SPleer
  <br>
</h1>

<h4 align="center">Оффлайн плеер на WPF + Chromium.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/.NET-8.0%2C%2010.0-512BD4" alt=".NET">
  <img src="https://img.shields.io/badge/language-C%23%2C%20JS%2C%20HTML%2C%20CSS-239120" alt="language">
  <img src="https://img.shields.io/badge/OS-windows-0078D4" alt="OS">
  <img src="https://img.shields.io/github/v/release/SNIP-ER/SPleer" alt="GitHub release">
</p>

<div align="center">
  
**🇷🇺 Русский • [🇬🇧 English](./EN/README.md)**

</div>

<div align="center">
  <img src="https://github.com/SNIP-ER/SPleer/blob/master/Images/library.png" alt="Library" width="500">
  <img src="https://github.com/SNIP-ER/SPleer/blob/master/Images/playlist.png" alt="Playlist" width="500">
  <img src="https://github.com/SNIP-ER/SPleer/blob/master/Images/track.png" alt="Track" width="500">
</div>


## Навигация

- [Что такое](#что-такое)
- [Функционал](#функционал)
- [Добавление языков](#добавление-языков)
- [Установка](#установка)

## Что такое

**SPleer** - оффлайн плеер для ПК, дизайн вдохновлен Spotify. Воспроизводит аудио файлы различных форматов, отображает данные их тегов. Работает полностью без интернета, на его работу не влияют прокси, VPN и другие подобные вещи.

## Функционал

- Поддерживает форматы файлов: `.mp3` `.wav` `.m4a` `.wma` `.ogg` `.flac` `.aiff` `.aif` `.opus`
- Сортировка и поиск треков
- Возможность создавать плейлисты
- Поддерживаются различные языки и темы
- Возможность указывать папку с музыкой

## Добавление языков

Доступна возможность перевести интерфейс на любой нужный язык. Для этого нужно: 
1) В папке ```www/lang``` создать новый файл с расширением `.json`
2) Перенести все теги из имеющихся файлов в новый с заменой значений
3) В файле ```www/state.js``` в константе ```languageCodes``` записать новый язык
4) В файле ```www/state.js``` в константе ```settingsSchema``` дописать пункт в ```key: 'language'``` для нового языка *(для отображения его выбора в настройках)*

## Установка

1) Перейдите в раздел с [релизами](https://github.com/SNIP-ER/SPleer/releases) и скачайте архив `.rar` последней версии *(или любой другой)*
2) Распакуйте все в одну любую папку

- `.exe` - файл который запускает програму
- ```Music``` - папка *по умолчанию*, в которую нужно перенести треки 
- ```Covers``` - папка с обложками файлов из папки с музыкой
- ```www``` - папка с web-файлами
- ```www/Fonts``` - папка со всеми шрифтами
- ```www/Image``` - папка со всеми системными изображениями
- ```www/lang``` - папка со словарями языков
