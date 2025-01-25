const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = !app.isPackaged; // 개발 모드와 프로덕션 모드 구분

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Preload 스크립트 연결
      contextIsolation: true, // 보안 강화
      enableRemoteModule: false, // Remote 사용 비활성화
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173"); // Vite 개발 서버 URL
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html")); // 빌드된 React 앱 로드
  }

  // 개발자 도구 자동 열기 (개발 환경에서만)
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// 앱이 준비되었을 때 실행
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 창이 닫혔을 때 앱 종료
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
