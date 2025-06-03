// preload/home-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // User management
    getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
    saveUserPreferences: (preferences) => ipcRenderer.send('save-user-preferences', preferences),
    
    // Authentication methods
    logout: () => ipcRenderer.send('logout'),
    
    // Session management
    validateSession: () => ipcRenderer.invoke('validate-session'),
    sessionActivity: () => ipcRenderer.send('session-activity'),
    
    // AI-specific methods (simplified)
    loadCookies: (aiType) => ipcRenderer.invoke('load-cookies', aiType),
    
    // Navigation methods
    navigateToHome: (userData) => ipcRenderer.send('navigate-to-home', userData)
});

