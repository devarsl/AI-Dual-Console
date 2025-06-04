// preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loginUser: (loginData) => ipcRenderer.invoke('login-user', loginData),
    
    navigateToHome: (userData) => ipcRenderer.send('navigate-to-home', userData),
    
    getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
    logout: () => ipcRenderer.send('logout')
});

console.log('Login preload script loaded successfully');