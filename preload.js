const { contextBridge, ipcRenderer } = require("electron");

// Renderer와 Main 프로세스 간 통신을 위한 안전한 API 제공
contextBridge.exposeInMainWorld("api", {
  // Main 프로세스에 데이터 전송
  send: (channel, data) => {
    const validChannels = ["toMain"]; // 허용된 채널
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // Main 프로세스에서 데이터 수신
  receive: (channel, callback) => {
    const validChannels = ["fromMain"]; // 허용된 채널
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
});
