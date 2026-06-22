using Microsoft.Web.WebView2.Core;
using System.Runtime.InteropServices;

namespace SPleer
{
    public partial class MainForm : Form
    {
        [DllImport("user32.dll")]
        private static extern bool SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        private const int GWL_STYLE = -16;
        private const int WS_OVERLAPPEDWINDOW = 0x00CF0000;

        public static Microsoft.Web.WebView2.WinForms.WebView2? WebView;

        /// <summary>
        /// Добавление возможности сворачивать и разворачивать приложение при нажатии по нему на панеле задач.
        /// </summary>
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;

                cp.Style |= 0x00020000; // WS_MINIMIZEBOX — разрешить сворачивание
                cp.Style |= 0x00010000; // WS_MAXIMIZEBOX — разрешить разворачивание

                return cp;
            }
        }

        public MainForm()
        {
            InitializeComponent();

            this.Icon = new Icon("www/Image/logo.ico");
            this.Load += FormMain_Load;
        }

        /// <summary>
        /// Плавное сворачивание окна.
        /// </summary>
        public void AnimateMinimize()
        {
            var style = GetWindowLong(this.Handle, GWL_STYLE);
            SetWindowLong(this.Handle, GWL_STYLE, style | WS_OVERLAPPEDWINDOW);
            SendMessage(this.Handle, 0x0112, 0xF020, 0);
            SetWindowLong(this.Handle, GWL_STYLE, style);
        }

        /// <summary>
        /// Плавное разворачивание окна.
        /// </summary>
        public void AnimateRestore()
        {
            var style = GetWindowLong(this.Handle, GWL_STYLE);
            SetWindowLong(this.Handle, GWL_STYLE, style | WS_OVERLAPPEDWINDOW);
            this.WindowState = FormWindowState.Normal;
            var timer = new System.Threading.Timer(_ =>
            {
                this.Invoke(new Action(() =>
                {
                    var s2 = GetWindowLong(this.Handle, GWL_STYLE);
                    SetWindowLong(this.Handle, GWL_STYLE, s2 & ~WS_OVERLAPPEDWINDOW);
                }));
            }, null, 1, Timeout.Infinite);
        }

        /// <summary>
        /// Перехватывает сообщения Windows для добавления анимации при разворачивании окна из панели задач.
        /// </summary>
        /// <param name="m">Сообщение Windows.</param>
        protected override void WndProc(ref Message m)
        {
            const int WM_SYSCOMMAND = 0x0112;
            const int SC_RESTORE = 0xF120;

            if (m.Msg == WM_SYSCOMMAND && m.WParam.ToInt64() == SC_RESTORE)
            {
                AnimateRestore();
                return;
            }

            base.WndProc(ref m);
        }


        /// <summary>
        /// Инициализация WebView2 и загрузка интерфейса приложения.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private async void FormMain_Load(object sender, EventArgs e)
        {
            try
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
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка запуска: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
