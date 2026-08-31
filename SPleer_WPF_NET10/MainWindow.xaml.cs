using Microsoft.Web.WebView2.Core;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace SPleer
{
    public partial class MainWindow : Window
    {
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
                    AdditionalBrowserArguments = "--no-proxy-server" +
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

#if !DEBUG
                webView21.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif

                string wwwRootFolder = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "www");
                string appRootFolder = AppDomain.CurrentDomain.BaseDirectory;

                webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "splayer.web", wwwRootFolder, CoreWebView2HostResourceAccessKind.Allow);
                webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "appfiles.local", appRootFolder, CoreWebView2HostResourceAccessKind.Allow);

                var musicLibrary = new MusicLibrary();
                _bridge = new MusicLibraryBridge(musicLibrary, this);
                webView21.CoreWebView2.AddHostObjectToScript("musicLibrary", _bridge);

                webView21.CoreWebView2.Navigate("https://splayer.web/index.html");
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
    }
}