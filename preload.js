const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Main 프로세스에 데이터 전송 (JSON 저장)
  saveAnnotations: (fileName, data) => {
    return ipcRenderer.invoke("save-annotations", { fileName, data });
  },
});
