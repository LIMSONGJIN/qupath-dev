const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveAnnotations: (fileName, data) => ipcRenderer.invoke('save-annotations', { fileName, data }),

  getAnnotations: (fileName) => ipcRenderer.invoke('get-annotations', fileName),

  loadAnnotations: (fileName) => ipcRenderer.invoke('load-annotations', fileName),

  onAnnotationsUpdated: (callback) =>
    ipcRenderer.on('annotations-updated', (event, data) => callback(data)),

  // 어노테이션 클래스 이름 변경
  updateAnnotationsClassname: (oldName, newName) =>
    ipcRenderer.invoke('update-annotations-classname', { oldName, newName }),

  // 클래스 관련 API
  getClasses: () => ipcRenderer.invoke('get-classes'),
  updateClasses: (newClasses) => ipcRenderer.invoke('update-classes', newClasses),

  // 클래스 개수 가져오기
  getClassCounts: () => ipcRenderer.invoke('get-class-counts'),

  // 클래스 변경 감지 이벤트
  onClassesUpdated: (callback) =>
    ipcRenderer.on('classes-updated', (event, data) => callback(data)),

  // 어노테이션 개수 가져오기
  getAnnotationsCounts: (fileName) => ipcRenderer.invoke('get-annotations-counts', fileName),

  // 어노테이션 bbox 업데이트
  updateAnnotationBbox: (fileName, annotation) =>
    ipcRenderer.invoke('update-annotation-bbox', { fileName, annotation }),

  moveAnnotation: (fileName, annotation) =>
    ipcRenderer.invoke('move-annotation', { fileName, annotation }),
});
