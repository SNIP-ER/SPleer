using System.Runtime.InteropServices;

namespace SPleer
{
    [ClassInterface(ClassInterfaceType.AutoDual)]
    [ComVisible(true)]
    public class MusicLibraryBridge
    {
        private readonly MusicLibrary _library;
        private readonly AudioPlayer _audioPlayer = new AudioPlayer();

        /// <summary>
        /// Создаёт экземпляр класса <see cref="MusicLibraryBridge"/>.
        /// </summary>
        /// <param name="library"></param>
        public MusicLibraryBridge(MusicLibrary library)
        {
            _library = library;
            _audioPlayer.SetMusicLibrary(_library); // Ссылка на библиотеку треков в аудиоплеер
        }


        // --- УПРАВЛЕНИЕ ОКНОМ ---

        [DllImport("user32.dll")]
        private static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();


        /// <summary>
        /// Перетаскивание окна.
        /// </summary>
        public void StartDrag()
        {
            var form = Application.OpenForms[0];

            ReleaseCapture();
            SendMessage(form.Handle, 0xA1, 0x2, 0);
        }

        /// <summary>
        /// Свернуть окно.
        /// </summary>
        public void MinimizeWindow()
        {
            if (Application.OpenForms.Count > 0)
            {
                Application.OpenForms[0].WindowState = FormWindowState.Minimized;
            }
        }

        /// <summary>
        /// Развернуть окно.
        /// </summary>
        public void MaximizeRestoreWindow()
        {
            if (Application.OpenForms.Count > 0)
            {
                var form = Application.OpenForms[0];
                form.WindowState = form.WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
            }
        }

        /// <summary>
        /// Закрыть окно.
        /// </summary>
        public void CloseWindow()
        {
            if (Application.OpenForms.Count > 0)
            {
                Application.OpenForms[0].Close();
            }
        }


        // --- БИБЛИОТЕКА ---

        /// <summary>
        /// Составление списка треков.
        /// </summary>
        /// <returns>Возвращает список треков в виде JSON-строки.</returns>
        public string GetTracksJson()
        {
            var tracks = _library.GetAllTracks();
            return System.Text.Json.JsonSerializer.Serialize(tracks);
        }

        /// <summary>
        /// Обновляет библиотеку
        /// </summary>
        public void RefreshLibrary()
        {
            _library.Refresh();
        }


        // --- ВОСПРОИЗВЕДЕНИЕ ---

        /// <summary>
        /// Начать воспроизвдение трека.
        /// </summary>
        /// <param name="filePath">Путь к файлу.</param>
        public void PlayTrack(string filePath)
        {
            _audioPlayer.PlayWithNormalization(filePath);
        }

        /// <summary>
        /// Останавить воспроизведение без сброса позиции.
        /// </summary>
        public void PauseTrack()
        {
            _audioPlayer.Pause();
        }

        /// <summary>
        /// Продолжить воспроизведение с текущей позиции.
        /// </summary>
        public void ResumeTrack()
        {
            _audioPlayer.Resume();
        }

        /// <summary>
        /// Определение текущего состояния плеера.
        /// </summary>
        /// <returns>Состояние плеера (1 - играет, 0 - пауза/остановлен).</returns>
        public int GetPlayerState()
        {
            return _audioPlayer.IsPlaying ? 1 : 0;
        }

        /// <summary>
        /// Воспроизвести трек по индексу.
        /// </summary>
        /// <param name="index">Индекс трека, целое число.</param>
        public void PlayByIndex(int index)
        {
            _audioPlayer.PlayByIndex(index);
        }

        /// <summary>
        /// Следующий трек.
        /// </summary>
        public void PlayNext()
        {
            _audioPlayer.PlayNext();
        }

        /// <summary>
        /// Предыдущий трек.
        /// </summary>
        public void PlayPrevious()
        {
            _audioPlayer.PlayPrevious();
        }

        /// <summary>
        /// Запуск первого, если ничего не выбрано.
        /// </summary>
        public void PlayFirstIfNotPlaying()
        {
            _audioPlayer.PlayFirstIfNotPlaying();
        }


        // --- ГРОМКОСТЬ ---

        /// <summary>
        /// Устанавить громкость.
        /// </summary>
        /// <param name="volume">Число от 0.0 до 1.0 .</param>
        public void SetVolume(float volume)
        {
            _audioPlayer.SetVolume(volume);
        }

        /// <summary>
        /// Узнать уровень громкости.
        /// </summary>
        /// <returns>Число от 0.0 до 1.0 .</returns>
        public float GetVolume()
        {
            return _audioPlayer.Volume;
        }


        // --- ПРОГРЕСС И ПЕРЕМОТКА ---

        /// <summary>
        /// Определить текущую позицию воспроизведения.
        /// </summary>
        /// <returns>Текущая позиция воспроизведения в секундах.</returns>
        public double GetCurrentPosition()
        {
            return _audioPlayer.CurrentPosition;
        }

        /// <summary>
        /// Узнать продолжительность трека для ползунка.
        /// </summary>
        /// <returns>Полная длительность трека в секундах.</returns>
        public double GetTotalDuration()
        {
            return _audioPlayer.TotalDuration;
        }

        /// <summary>
        /// Перемотка трека на указанную позицию.
        /// </summary>
        /// <param name="seconds">Секунда на которую нужно перемотать.</param>
        public void SeekTo(double seconds)
        {
            if (_audioPlayer.AudioFile != null)
            {
                _audioPlayer.AudioFile.CurrentTime = TimeSpan.FromSeconds(seconds);
            }
        }


        // --- РЕЖИМЫ --- 

        /// <summary>
        /// Установить режимю.
        /// </summary>
        /// <param name="mode">"sequential" или "shuffle".</param>
        public void SetMode(string mode)
        {
            _audioPlayer.SetMode(mode == "shuffle" ? PlaybackMode.Shuffle : PlaybackMode.Sequential);
        }

        /// <summary>
        /// Получить текущий режим.
        /// </summary>
        /// <returns>Текущий режим, строка.</returns>
        public string GetMode()
        {
            return _audioPlayer.GetMode().ToString().ToLower();
        }

        /// <summary>
        /// Получение индекса текущего трека.
        /// </summary>
        /// <returns>Индекс - целое число.</returns>
        public int GetCurrentTrackIndex()
        {
            return _audioPlayer.GetCurrentTrackIndex();
        }

        /// <summary>
        /// Переключает режим повтора одного трека через аудиоплеер.
        /// </summary>
        public void ToggleRepeatOne()
        {
            _audioPlayer.ToggleRepeatOne();
        }
    }
}