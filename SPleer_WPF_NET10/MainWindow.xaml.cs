using Microsoft.Web.WebView2.Core;
using System.Globalization;
using System.Windows;

namespace SPleer
{
    public partial class MainWindow : Window
    {
        // Масштаб (%) -> минимальный размер окна (ширина, высота) в единицах WPF.
        // Значения подобраны вручную.
        private static readonly Dictionary<int, (double W, double H)> MinSizes = new()
        {
            [70] = (415, 326),
            [80] = (475, 372),
            [90] = (535, 418),
            [100] = (595, 482),
            [110] = (655, 506),
            [120] = (715, 552),
            [130] = (775, 596),
        };

        private System.Windows.Forms.NotifyIcon? _trayIcon;
        private System.Windows.Forms.ToolStripMenuItem? _trayOpenItem;
        private System.Windows.Forms.ToolStripMenuItem? _trayExitItem;
        private string _trayOpenText = "Open";
        private string _trayExitText = "Exit";
        private bool _closeToTray;
        private bool _reallyExit;
        public static Microsoft.Web.WebView2.Wpf.WebView2? WebView;
        private MusicLibraryBridge? _bridge;


        public MainWindow()
        {
            InitializeComponent();
            this.StateChanged += MainWindow_StateChanged;
            this.Loaded += MainWindow_Loaded;

            Application.Current.SessionEnding += (_, _) => _reallyExit = true;
        }

        private void MainWindow_StateChanged(object? sender, EventArgs e)
        {
            bool isMax = this.WindowState == WindowState.Maximized;
            WebView?.CoreWebView2?.ExecuteScriptAsync($"updateMaximizeIcon({isMax.ToString().ToLower()})");
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                var options = new CoreWebView2EnvironmentOptions
                {
                    AdditionalBrowserArguments = "--no-proxy-server " +
                        "--disable-background-networking --disable-component-update --disable-domain-reliability " +
                        "--disable-sync --disable-client-side-phishing-detection " +
                        "--renderer-process-limit=1"
                };

                var environment = await CoreWebView2Environment.CreateAsync(
                    browserExecutableFolder: null,
                    userDataFolder: null,
                    options: options);

                await webView21.EnsureCoreWebView2Async(environment);
                WebView = webView21;

                // Отключение встроенного зума
                webView21.CoreWebView2.Settings.IsZoomControlEnabled = false;
                webView21.CoreWebView2.Settings.IsPinchZoomEnabled = false;

#if !DEBUG
                webView21.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif

                string wwwRootFolder = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "www");
                string appRootFolder = AppDomain.CurrentDomain.BaseDirectory;

                webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "splayer.web", wwwRootFolder, CoreWebView2HostResourceAccessKind.Allow);
                webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "appfiles.local", appRootFolder, CoreWebView2HostResourceAccessKind.Allow);

                var startupSettings = new SettingsManager();

                SetCloseAction(startupSettings.Get("close_btn"));

                if (double.TryParse(startupSettings.Get("scale"), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out var scalePercent))
                {
                    ApplyZoom(Math.Clamp(scalePercent, 70, 130) / 100);
                }
                string? savedMusicFolder = startupSettings.Get("musicFolder");

                var musicLibrary = new MusicLibrary(savedMusicFolder);
                _bridge = new MusicLibraryBridge(musicLibrary, this);
                webView21.CoreWebView2.AddHostObjectToScript("musicLibrary", _bridge);

                webView21.CoreWebView2.Navigate("https://splayer.web/index.html");
                _ = musicLibrary.StartScanAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка запуска: {ex.Message}", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// Задаёт поведение кнопки закрытия окна.
        /// </summary>
        /// <param name="action">
        /// "Tray" — сворачивать в трей, любое другое значение (включая null) — завершать работу.
        /// Регистр не учитывается.
        /// </param>
        public void SetCloseAction(string? action)
        {
            _closeToTray = string.Equals(action, "Tray", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Задаёт подписи меню трея. Пустая строка оставляет текущее значение.
        /// </summary>
        /// <param name="open">Подпись пункта «Открыть».</param>
        /// <param name="exit">Подпись пункта «Выход».</param>
        public void SetTrayStrings(string? open, string? exit)
        {
            if (!string.IsNullOrWhiteSpace(open)) _trayOpenText = open;
            if (!string.IsNullOrWhiteSpace(exit)) _trayExitText = exit;

            if (_trayOpenItem != null) _trayOpenItem.Text = _trayOpenText;
            if (_trayExitItem != null) _trayExitItem.Text = _trayExitText;
        }

        /// <summary>
        /// Перехватывает закрытие окна: в режиме трея отменяет его и скрывает окно,
        /// иначе освобождает ресурсы и завершает работу.
        /// </summary>
        /// <param name="e">
        /// Данные события закрытия, через них закрытие можно отменить.
        /// </param>
        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (_closeToTray && !_reallyExit)
            {
                e.Cancel = true;
                HideToTray();
                return;
            }

            _bridge?.CleanupOrphanedCovers();
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
                _trayIcon = null;
            }

            base.OnClosing(e);
        }

        /// <summary>
        /// Загружает иконку для трея: сначала из файла www/Image/logo.ico,
        /// при его отсутствии — из exe-файла приложения.
        /// </summary>
        /// <returns>Иконка или null, если загрузить её не удалось.</returns>
        private System.Drawing.Icon? LoadTrayIcon()
        {
            try
            {
                string path = System.IO.Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory, "www", "Image", "logo.ico");

                if (System.IO.File.Exists(path)) return new System.Drawing.Icon(path);

                return System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath!);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Скрывает окно и показывает иконку в трее.
        /// Иконка и меню создаются при первом вызове:
        /// пункты «Открыть» и «Выход», двойной клик левой кнопкой возвращает окно.
        /// </summary>
        private void HideToTray()
        {
            if (_trayIcon == null)
            {
                _trayOpenItem = new System.Windows.Forms.ToolStripMenuItem(_trayOpenText);
                _trayOpenItem.Click += (_, _) => RestoreFromTray();

                _trayExitItem = new System.Windows.Forms.ToolStripMenuItem(_trayExitText);
                _trayExitItem.Click += (_, _) =>
                {
                    _reallyExit = true;
                    Close();
                };

                var menu = new System.Windows.Forms.ContextMenuStrip();
                menu.Items.Add(_trayOpenItem);
                menu.Items.Add(_trayExitItem);

                _trayIcon = new System.Windows.Forms.NotifyIcon
                {
                    Text = "SPleer",
                    Icon = LoadTrayIcon(),
                    ContextMenuStrip = menu
                };

                _trayIcon.MouseDoubleClick += (_, args) =>
                {
                    if (args.Button == System.Windows.Forms.MouseButtons.Left) RestoreFromTray();
                };
            }

            _trayIcon.Visible = true;
            Hide();
        }

        /// <summary>
        /// Возвращает окно из трея: показывает, восстанавливает из свёрнутого состояния,
        /// выводит на передний план и прячет иконку трея.
        /// </summary>
        private void RestoreFromTray()
        {
            Show();
            if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;

            Activate();
            if (_trayIcon != null) _trayIcon.Visible = false;
        }

        /// <summary>
        /// Применяет масштаб интерфейса и пропорционально меняет минимальный размер окна.
        /// </summary>
        /// <param name="factor">Коэффициент масштаба (1.0 = 100%).</param>
        public void ApplyZoom(double factor)
        {
            webView21.ZoomFactor = factor;

            if (WindowState == WindowState.Maximized) return;

            int percent = (int)Math.Round(factor * 100);
            if (MinSizes.TryGetValue(percent, out var size))
            {
                MinWidth = size.W;
                MinHeight = size.H;
            }
        }
    }
}