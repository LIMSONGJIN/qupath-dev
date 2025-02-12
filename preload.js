const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // JSON 파일을 저장
  saveAnnotations: (fileName, data) => ipcRenderer.invoke('save-annotations', { fileName, data }),

  // JSON 파일을 읽음
  getAnnotations: (fileName) => ipcRenderer.invoke('get-annotations', fileName),

  // 어노테이션 변경 감지 이벤트 (React에서 호출)
  onAnnotationsUpdated: (callback) =>
    ipcRenderer.on('annotations-updated', (event, data) => callback(data)),
  updateAnnotationsClassname: (oldName, newName) =>
    ipcRenderer.invoke('update-annotations-classname', { oldName, newName }), // 추가됨
  getClasses: () => ipcRenderer.invoke('get-classes'),
  updateClasses: (newClasses) => ipcRenderer.invoke('update-classes', newClasses),
  getClassCounts: () => ipcRenderer.invoke('get-class-counts'),
  onClassesUpdated: (callback) =>
    ipcRenderer.on('classes-updated', (event, data) => callback(data)),
  getAnnotationsCounts: (fileName) => ipcRenderer.invoke('get-annotations-counts', fileName),
});
