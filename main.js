const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
const sizeOf = require('image-size').default || require('image-size');

const classesFilePath = path.join(__dirname, 'public', 'config', 'classes.json');
const annotationsDir = path.join(__dirname, 'public', 'annotations');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// (A) 실제로 "Open" 클릭 시 실행되는 함수
async function openImageFile() {
  // 1) 파일 대화상자 열기 (PNG만)
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'PNG Images', extensions: ['png'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) {
    return; // 사용자가 취소
  }

  const sourceFile = filePaths[0]; // 사용자가 고른 파일 경로
  const fileName = path.basename(sourceFile); // 예: "sample.png"

  // 2) public/images 디렉토리에 복사할 경로
  const imagesDir = path.join(__dirname, 'public', 'images');
  const targetFile = path.join(imagesDir, fileName);

  // 3) 만약 이미 해당 파일이 있다면 "이미 존재" 처리
  if (fs.existsSync(targetFile)) {
    // 이미 있으므로, 건너뛰거나 사용자에게 알림
    console.log('이미 존재하는 파일입니다:', fileName);
    return;
  }

  // 4) 파일 복사
  fs.copyFileSync(sourceFile, targetFile);
  console.log('복사 완료:', sourceFile, '->', targetFile);

  // 5) annotation JSON 파일 만들기
  const baseName = fileName.replace('.png', ''); // 예: "sample"
  const annotationFileName = `${baseName}_annotation.json`;
  const annotationDir = path.join(__dirname, 'public', 'annotations');
  const annotationPath = path.join(annotationDir, annotationFileName);

  if (!fs.existsSync(annotationPath)) {
    // 없는 경우만 생성
    const defaultData = {
      annotations: [], // 빈 배열
    };
    fs.writeFileSync(annotationPath, JSON.stringify(defaultData, null, 2));
    console.log('새 어노테이션 파일 생성:', annotationPath);
  } else {
    console.log('이미 어노테이션 파일이 존재:', annotationPath);
  }

  // 6) 렌더러에 "새 파일이 추가되었으니, 이미지 리스트 갱신" 같은 신호를 보낼 수도 있음
  if (mainWindow) {
    mainWindow.webContents.send('image-added', { fileName });
  }
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // (A) File 메뉴 예시
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openImageFile(); // 위에서 만든 함수 호출
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-save');
            }
          },
        },
        { type: 'separator' },
        {
          label: isMac ? 'Quit' : 'Exit',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    // (B) Edit 메뉴 예시
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-undo');
            }
          },
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-redo');
            }
          },
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    // (C) View 메뉴: 기본 Reload, DevTools, Zoom, Full Screen 등
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, // Ctrl+R
        { role: 'forceReload' }, // Ctrl+Shift+R
        { role: 'toggleDevTools' }, // Ctrl+Shift+I
        { type: 'separator' },
        { role: 'resetZoom' }, // Ctrl+0
        { role: 'zoomIn' }, // Ctrl+Plus
        { role: 'zoomOut' }, // Ctrl+Minus
        { type: 'separator' },
        { role: 'togglefullscreen' }, // F11
      ],
    },
    // (D) Window 메뉴: Minimize, Zoom, Close 등
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, // Ctrl+M
        { role: 'zoom' }, // macOS에서 윈도우 최대화/리사이즈
        { role: 'close' }, // Ctrl+W
      ],
    },
    // (E) macOS 전용 Help, 혹은 다른 메뉴
    // {
    //   label: 'Help',
    //   submenu: [
    //     // ...
    //   ],
    // },
  ];

  // (F) Mac 환경에서 첫 번째 메뉴가 앱 이름이 되도록 처리
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// main.js
ipcMain.handle('reload-images', async () => {
  try {
    const imagesDir = path.join(__dirname, 'public', 'images');
    let files = fs.readdirSync(imagesDir);

    // .png만 필터링
    files = files.filter((f) => f.toLowerCase().endsWith('.png'));

    // 숫자 기반 정렬
    files.sort((a, b) => {
      const aNum = parseInt(a, 10);
      const bNum = parseInt(b, 10);
      return aNum - bNum;
    });

    // url, name, width, height 등
    const imageInfos = [];
    for (const file of files) {
      const filePath = path.join(imagesDir, file);
      const name = file;
      // 브라우저에서 접근할 땐 /images/파일명 으로 가능
      const url = `/images/${file}`;

      // 너비/높이 계산
      const fileBuffer = fs.readFileSync(filePath);
      const { width, height } = sizeOf(fileBuffer);

      imageInfos.push({
        url,
        name,
        width,
        height,
      });
    }

    return imageInfos;
  } catch (error) {
    console.error('Error reloading images:', error);
    return [];
  }
});

// JSON 파일 읽기 (React에서 호출)
ipcMain.handle('get-annotations', async (event, fileName) => {
  const filePath = path.join(__dirname, 'public', 'annotations', `${fileName}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found', annotations: [] };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { success: true, annotations: data.annotations || [] };
  } catch (error) {
    console.error('Error loading annotations:', error);
    return { success: false, error: error.message, annotations: [] };
  }
});

ipcMain.handle('load-annotations', async (event, fileName) => {
  // fileName은 "2_annotation" 등, 확장자를 뺀 상태로 넘어올 것으로 가정
  const filePath = path.join(__dirname, 'public', 'annotations', `${fileName}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found', annotations: [] };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { success: true, annotations: data.annotations || [] };
  } catch (error) {
    console.error('Error loading annotations:', error);
    return { success: false, error: error.message, annotations: [] };
  }
});
// JSON 저장 + React에 변경 알림 (`annotations-updated` 이벤트 발생)
ipcMain.handle('save-annotations', async (event, { fileName, data }) => {
  const filePath = path.join(__dirname, 'public', 'annotations', `${fileName}.json`);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // 변경 사항이 발생했음을 React에 알림
    event.sender.send('annotations-updated', { fileName, annotations: data.annotations });

    return { success: true };
  } catch (error) {
    console.error('Error saving annotations:', error);
    return { success: false, error: error.message };
  }
});

// JSON 파일에서 클래스 목록 불러오기
ipcMain.handle('get-classes', async () => {
  try {
    if (!fs.existsSync(classesFilePath)) {
      return { success: false, error: 'Classes file not found', classes: [] };
    }

    const data = JSON.parse(fs.readFileSync(classesFilePath, 'utf-8'));
    return { success: true, classes: data };
  } catch (error) {
    console.error('Error loading classes:', error);
    return { success: false, error: error.message, classes: [] };
  }
});

// JSON 파일을 수정하여 클래스 이름 및 색상 업데이트
ipcMain.handle('update-classes', async (event, newClasses) => {
  try {
    fs.writeFileSync(classesFilePath, JSON.stringify(newClasses, null, 2));

    // 변경 사항 React에 알림
    event.sender.send('classes-updated', newClasses);
    return { success: true };
  } catch (error) {
    console.error('Error updating classes:', error);
    return { success: false, error: error.message };
  }
});

// 클래스 이름이 변경되면 annotation JSON 파일 내에서 해당 이름을 모두 변경
ipcMain.handle('update-annotations-classname', async (event, { oldName, newName }) => {
  try {
    const annotationFiles = fs.readdirSync(annotationsDir).filter((file) => file.endsWith('.json'));

    annotationFiles.forEach((file) => {
      const filePath = path.join(annotationsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      let updated = false;
      data.annotations.forEach((annotation) => {
        if (annotation.class === oldName) {
          annotation.class = newName;
          updated = true;
        }
      });

      if (updated) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating annotation class names:', error);
    return { success: false, error: error.message };
  }
});

// 모든 annotation 파일을 스캔하여 클래스 개수 계산
ipcMain.handle('get-class-counts', async () => {
  try {
    const classCounts = {};

    const annotationFiles = fs.readdirSync(annotationsDir).filter((file) => file.endsWith('.json'));

    annotationFiles.forEach((file) => {
      const filePath = path.join(annotationsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      data.annotations.forEach((annotation) => {
        const className = annotation.class || 'Unclassified';
        classCounts[className] = (classCounts[className] || 0) + 1;
      });
    });

    return { success: true, classCounts };
  } catch (error) {
    console.error('Error counting class annotations:', error);
    return { success: false, error: error.message, classCounts: {} };
  }
});

// 특정 이미지에 대한 어노테이션 개수 계산
ipcMain.handle('get-annotations-counts', async (event, fileName) => {
  try {
    const annotationFilePath = path.join(annotationsDir, `${fileName}_annotation.json`);

    if (!fs.existsSync(annotationFilePath)) {
      return { success: false, error: 'File not found', classCounts: {} };
    }

    const data = JSON.parse(fs.readFileSync(annotationFilePath, 'utf-8'));
    const classCounts = {};

    data.annotations.forEach((annotation) => {
      const className = annotation.class || 'Unclassified';
      classCounts[className] = (classCounts[className] || 0) + 1;
    });

    return { success: true, classCounts };
  } catch (error) {
    console.error('Error counting class annotations:', error);
    return { success: false, error: error.message, classCounts: {} };
  }
});

// ✅ 어노테이션 bbox 업데이트 기능 추가
ipcMain.handle('update-annotation-bbox', async (event, { fileName, annotation }) => {
  const filePath = path.join(__dirname, 'public', 'annotations', `${fileName}.json`);

  try {
    let data = {};

    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {};
    }

    // ✅ 기본값 설정
    if (!data.annotations) {
      data.annotations = [];
    }

    // 기존 어노테이션 목록에서 ID가 일치하는 어노테이션의 bbox 업데이트
    data.annotations = data.annotations.map((item) =>
      item.id === annotation.id ? { ...item, bbox: annotation.bbox } : item
    );

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // ✅ 변경 사항이 발생했음을 React에 알림
    event.sender.send('annotations-updated', { fileName, annotations: data.annotations });

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating annotation bbox:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('move-annotation', async (event, { fileName, annotation }) => {
  const actualFileName = `${fileName}_annotation.json`; // ✅ 파일명 형식 맞춤
  const filePath = path.join(__dirname, 'public', 'annotations', actualFileName);

  try {
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return { success: false, error: 'File not found' };
    }

    let data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {};

    // ✅ 기본값 설정
    if (!data.annotations || !Array.isArray(data.annotations)) {
      console.warn('⚠ No annotations array found in file:', filePath);
      return { success: false, error: 'Annotations array missing' };
    }

    let found = false;

    data.annotations = data.annotations.map((item) => {
      if (item.id === annotation.id) {
        found = true;
        return { ...item, bbox: annotation.bbox };
      }
      return item;
    });

    if (!found) {
      console.error('❗ Annotation ID not found in JSON:', annotation.id);
      return { success: false, error: 'Annotation not found' };
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // ✅ React에 변경 사항 전달
    event.sender.send('annotations-updated', {
      fileName: actualFileName,
      annotations: data.annotations,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error moving annotation:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
