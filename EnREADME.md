
<h1 align="center">
  <br>
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/logo.png" alt="SPleer" width="200">
  <br>
  SPleer
  <br>
</h1>

<h4 align="center">Offline music player built with WPF + Chromium</h4>

<p align="center">
  <img src="https://img.shields.io/badge/.NET-8.0%2C%2010.0-512BD4" alt=".NET">
  <img src="https://img.shields.io/badge/language-C%23%2C%20JS%2C%20HTML%2C%20CSS-239120" alt="language">
  <img src="https://img.shields.io/badge/OS-windows%2010/11-0078D4" alt="OS">
  <img src="https://img.shields.io/github/v/release/SNIP-ER/SPleer" alt="GitHub release">
</p>

<div align="center">
  
**[🇷🇺 Русский](README.md) • 🇬🇧 English**

</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/library.png" alt="Library" width="390">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/playlist.png" alt="Playlist" width="390">
  <img src="https://raw.githubusercontent.com/SNIP-ER/SPleer/master/Images/track.png" alt="Track" width="390">
</div>

## Navigation

- [What Is](#what-is)
- [Features](#features)
- [Adding Languages](#adding-languages)
- [Requirements](#requirements)
- [Installation](#installation)
- [Third-Party Libraries](#third-party-libraries)

<br>

## What Is

**SPleer** is an offline music player for PC with a design inspired by Spotify. It plays audio files in various formats and displays metadata from their tags. It works entirely without an internet connection, so proxies, VPNs, and similar services do not affect its functionality.

<br>

## Features

- Supports the following file formats: `.mp3` `.wav` `.m4a` `.wma` `.ogg` `.flac` `.aiff` `.aif` `.opus`
- Track sorting and search
- Playlist creation
- Support for multiple languages and themes
- Ability to specify a custom music folder

<br>

## Adding Languages

You can translate the interface into any language you need. To do this:
1) Create a new file with the `.json` extension in the ```www/lang``` folder
2) Copy all tags from an existing language file into the new file and replace their values with the appropriate translations
3) In the ```www/state.js file```, add the new language to the ```languageCodes``` constant
4) In the ```www/state.js file```, add an entry for the new language under ```key: 'language'``` in the ```settingsSchema``` constant *(so it can be selected in the settings)*

<br>

## Requirements

- **Windows 10** *(version 1709+)* or **Windows 11**
- No additional software is required — WebView2 Runtime is already included with current versions of Windows.

<br>

## Installation

1) Go to the [releases](https://github.com/SNIP-ER/SPleer/releases) and download the `.rar` archive of the latest version *(or any other version)*
2) Extract all files into any folder

- `.exe` — the executable file used to launch the application
- ```Music``` — the default folder where you can place your music files
- ```Covers``` — the folder containing cover images extracted from audio files in the music folder
- ```www``` — the folder containing the web files
- ```www/Fonts``` — the folder containing all fonts
- ```www/Image``` — the folder containing all system images
- ```www/lang``` — the folder containing language dictionaries

<br>

## Third-Party Libraries

| Library | Purpose | License |
|---|---|---|
| [NAudio](https://github.com/naudio/NAudio) | Audio playback | MIT |
| [libsndfile](https://github.com/libsndfile/libsndfile) | Decoding FLAC / OGG / Opus / AIFF files | LGPL v2.1 или v3 (see [THIRD-PARTY-LICENSES/](./THIRD-PARTY-LICENSES/)) |
| [TagLib#](https://github.com/mono/taglib-sharp) | Reading metadata and cover artwork | LGPL-2.1 |
| [Microsoft.Web.WebView2](https://www.nuget.org/packages/Microsoft.Web.WebView2/) | Rendering the user interface | Microsoft |

SPleer uses **libsndfile**, which is distributed under the GNU Lesser General Public License *(version 2.1 or, at your option, version 3)*. The full license texts are available in the [`THIRD-PARTY-LICENSES/`](./THIRD-PARTY-LICENSES/) folder.
