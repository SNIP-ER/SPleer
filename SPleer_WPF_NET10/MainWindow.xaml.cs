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

        public static Microsoft.Web.WebView2.Wpf.WebView2? WebView;
        private MusicLibraryBridge? _bridge;


        public MainWindow()
        {
            InitializeComponent();
            this.StateChanged += MainWindow_StateChanged;
            this.Loaded += MainWindow_Loaded;
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

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            _bridge?.CleanupOrphanedCovers();
            base.OnClosing(e);
        }

        /// <summary>
        /// Применяет масштаб интерфейса и пропорционально меняет минимальный размер окна.
        /// </summary>
        /// <param name="factor">Коэффициент масштаба (1.0 = 100%).</param>
        public void ApplyZoom(double factor)
        {
            webView21.ZoomFactor = factor;

            int percent = (int)Math.Round(factor * 100);
            if (MinSizes.TryGetValue(percent, out var size))
            {
                MinWidth = size.W;
                MinHeight = size.H;
            }
        }
    }
}