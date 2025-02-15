const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;

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
    console.log('📂 Trying to load annotation file:', filePath);

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

    console.log('🔍 Searching for annotation ID:', annotation.id);
    let found = false;

    data.annotations = data.annotations.map((item) => {
      if (item.id === annotation.id) {
        found = true;
        console.log('✅ Found annotation! Updating bbox:', annotation.bbox);
        return { ...item, bbox: annotation.bbox };
      }
      return item;
    });

    if (!found) {
      console.error('❗ Annotation ID not found in JSON:', annotation.id);
      console.log('📜 Current annotations:', data.annotations);
      return { success: false, error: 'Annotation not found' };
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('✅ Annotation successfully updated in JSON:', annotation);

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
