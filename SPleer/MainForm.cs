using Microsoft.Web.WebView2.Core;

namespace SPleer
{
    public partial class MainForm : Form
    {
        public static Microsoft.Web.WebView2.WinForms.WebView2? WebView;

        public MainForm()
        {
            InitializeComponent();
            this.Load += FormMain_Load;
        }

        private async void FormMain_Load(object sender, EventArgs e)
        {
            // Ожидание инициализации ядра WebView2
            await webView21.EnsureCoreWebView2Async();
            WebView = webView21;

            // Настройка виртуального хоста для безопасной загрузки локальных файлов
            string wwwRootFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "www");
            string appRootFolder = AppDomain.CurrentDomain.BaseDirectory;

            webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "splayer.web",      // Виртуальное доменное имя
                wwwRootFolder,            // Путь к папке "www"
                CoreWebView2HostResourceAccessKind.Allow    // Открывает доступ ко всем ресурсам
            );
            webView21.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "appfiles.local",
                appRootFolder,
                CoreWebView2HostResourceAccessKind.Allow
            );

            // Создание библиотеки
            var musicLibrary = new MusicLibrary();
            // Ее регистрация для доступа из JavaScript
            webView21.CoreWebView2.AddHostObjectToScript("musicLibrary", new MusicLibraryBridge(musicLibrary));

            // Загрузка HTML, используя виртуальный хост
            webView21.CoreWebView2.Navigate("https://splayer.web/index.html");
        }
    }
}
