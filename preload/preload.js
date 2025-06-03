// preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication methods
    loginUser: (loginData) => ipcRenderer.invoke('login-user', loginData),
    registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
    
    // Navigation methods
    navigateToHome: (userData) => ipcRenderer.send('navigate-to-home', userData),
    
    // Utility methods
    getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
    logout: () => ipcRenderer.send('logout')
});

// Optional: Log when preload script is loaded
console.log('Login preload script loaded successfully');