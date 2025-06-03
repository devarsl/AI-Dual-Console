// main/main.js
const { app, BrowserWindow, ipcMain, dialog, session, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcrypt');
const fs = require('fs');

let mainWindow;
let currentUser = null;
const userSessionPath = path.join(app.getPath('userData'), 'user-session.json');

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Auto Updater Configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
    Menu.setApplicationMenu(null);// to hide toolbar
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            preload: path.join(__dirname, '../preload/preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        autoHideMenuBar: true,
    });

    mainWindow.maximize();

    // Check for valid session on startup
    const hasValidSession = loadSavedSession();

    if (hasValidSession) {
        // Switch to home preload and load home page
        switchPreloadScript('home-preload.js');
        mainWindow.loadFile(path.join(__dirname, '../renderer/home.html'));
    } else {
        // Load login page
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Prevent dev tools opening
    mainWindow.webContents.on('devtools-opened', () => {
        mainWindow.webContents.closeDevTools();
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (
            (input.key === 'F12') ||
            (input.control && input.shift && input.key.toLowerCase() === 'i') ||
            (input.meta && input.alt && input.key.toLowerCase() === 'i')
        ) {
            event.preventDefault();
        }
    });

    // Check for updates after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
        if (process.env.NODE_ENV !== 'development') {
            checkForUpdates();
        }
    });
}

// Auto Updater Functions
function checkForUpdates() {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
}

// Auto Updater Event Handlers
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    sendUpdateMessage('checking-for-update');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info);
    sendUpdateMessage('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName,
        releaseDate: info.releaseDate
    });
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
    sendUpdateMessage('update-not-available', { version: info.version });
});

autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    sendUpdateMessage('update-error', { message: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
    const message = `Downloaded ${Math.round(progressObj.percent)}% (${Math.round(progressObj.bytesPerSecond / 1024)} KB/s)`;
    console.log('Download progress:', message);
    sendUpdateMessage('download-progress', {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: Math.round(progressObj.bytesPerSecond / 1024),
        total: Math.round(progressObj.total / 1024 / 1024),
        transferred: Math.round(progressObj.transferred / 1024 / 1024)
    });
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info);
    sendUpdateMessage('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes
    });
});

function sendUpdateMessage(event, data = {}) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update-message', { event, data });
    }
}

// IPC Handlers for Auto Updater
ipcMain.handle('check-for-updates', () => {
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify();
        return { success: true, message: 'Checking for updates...' };
    } else {
        return { success: false, message: 'Updates disabled in development mode' };
    }
});

ipcMain.handle('download-update', () => {
    try {
        autoUpdater.downloadUpdate();
        return { success: true, message: 'Download started...' };
    } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('install-update', () => {
    try {
        autoUpdater.quitAndInstall();
        return { success: true, message: 'Installing update...' };
    } catch (error) {
        console.error('Error installing update:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Helper function to switch preload script
function switchPreloadScript(scriptName) {
    const preloadPath = path.join(__dirname, `../preload/${scriptName}`);
    mainWindow.webContents.session.setPreloads([preloadPath]);
}

// Improved session management
function loadSavedSession() {
    try {
        if (fs.existsSync(userSessionPath)) {
            const sessionData = JSON.parse(fs.readFileSync(userSessionPath, 'utf8'));
            
            // Check if session exists and is valid
            if (sessionData && sessionData.user && sessionData.timestamp) {
                const currentTime = Date.now();
                const sessionAge = currentTime - sessionData.timestamp;
                
                // Check if session has expired
                if (sessionAge < SESSION_TIMEOUT) {
                    currentUser = sessionData.user;
                    console.log(`Session restored for user: ${currentUser.email}`);
                    return true;
                } else {
                    console.log('Session expired, clearing...');
                    clearSession();
                }
            }
        }
    } catch (error) {
        console.error('Error loading saved session:', error);
        clearSession(); // Clear corrupted session data
    }
    return false;
}

function saveSession(userData) {
    try {
        const sessionData = {
            user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                preferences: userData.preferences || {}
            },
            timestamp: Date.now(),
            expiresAt: Date.now() + SESSION_TIMEOUT
        };
        fs.writeFileSync(userSessionPath, JSON.stringify(sessionData, null, 2));
        console.log(`Session saved for user: ${userData.email}`);
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

function clearSession() {
    try {
        if (fs.existsSync(userSessionPath)) {
            fs.unlinkSync(userSessionPath);
            console.log('Session cleared');
        }
        currentUser = null;
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

// Refresh session timestamp on activity
function refreshSession() {
    if (currentUser) {
        saveSession(currentUser);
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Hash password
async function hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
}

// Compare password
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Register new user
ipcMain.handle('register-user', async (event, userData) => {
    try {
        // Check if email already exists
        const existingUser = await getUserByEmail(userData.email);
        if (existingUser) {
            return { success: false, message: 'Email already registered' };
        }

        // Hash the password
        const hashedPassword = await hashPassword(userData.password);

        // Save user to database
        const userId = await saveUserToDB({
            name: userData.name,
            email: userData.email,
            password: hashedPassword
        });

        return { success: true, userId };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('login-user', async (event, loginData) => {
    try {
        const user = await getUserByEmail(loginData.email);

        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const passwordMatch = await comparePassword(loginData.password, user.password);

        if (!passwordMatch) {
            return { success: false, message: 'Invalid password' };
        }

        // Set current user with default preferences
        currentUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            preferences: {
                darkMode: false,
                lastUsedAI: 'claude'
            }
        };

        // Save session
        saveSession(currentUser);

        return {
            success: true,
            user: currentUser
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.message };
    }
});

// Get current user with session validation
ipcMain.handle('get-current-user', (event) => {
    // Validate session on each request
    if (currentUser) {
        const sessionValid = loadSavedSession();
        if (sessionValid) {
            refreshSession(); // Update session timestamp
            return currentUser;
        }
    }
    return null;
});

// Navigate to home page
ipcMain.on('navigate-to-home', (event) => {
    if (!currentUser) {
        console.error('No authenticated user found');
        return;
    }

    // Switch to home preload script before loading home page
    switchPreloadScript('home-preload.js');
    mainWindow.loadFile(path.join(__dirname, '../renderer/home.html'));
});

// Enhanced logout handler
ipcMain.on('logout', (event) => {
    console.log('Logout initiated');
    
    // Clear current user and session
    clearSession();

    // Switch back to login preload script
    switchPreloadScript('preload.js');

    // Clear all session data
    Promise.all([
        session.defaultSession.clearStorageData(),
        session.fromPartition('persist:claude').clearStorageData(),
        session.fromPartition('persist:gpt').clearStorageData()
    ])
    .then(() => {
        console.log('All session data cleared successfully');
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    })
    .catch(error => {
        console.error('Failed to clear session data:', error);
        // Still redirect to login even if clearing fails
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
});

// Save user preferences with session update
ipcMain.on('save-user-preferences', async (event, preferences) => {
    if (!currentUser) {
        console.error('No authenticated user to save preferences for');
        return;
    }

    try {
        // Update current user preferences
        currentUser.preferences = { ...currentUser.preferences, ...preferences };
        
        // Save updated user data to session
        saveSession(currentUser);
        
        console.log('User preferences saved:', preferences);
    } catch (error) {
        console.error('Error saving user preferences:', error);
    }
});

// Session activity tracking
ipcMain.on('session-activity', (event) => {
    refreshSession();
});

// Check session validity
ipcMain.handle('validate-session', (event) => {
    return loadSavedSession();
});

// Simplified cookie loading (removed since you want to skip this)
ipcMain.handle('load-cookies', async (event, aiType) => {
    console.log(`Cookie loading skipped for ${aiType} as requested`);
    return { 
        success: true, 
        message: 'Cookie loading disabled - using fresh session' 
    };
});

// Database helper functions
async function getUserByEmail(email) {
    try {
        const stmt = db.prepare("SELECT * FROM user WHERE email = ?");
        const user = stmt.get(email);
        return user || null;
    } catch (error) {
        console.error('Error getting user by email:', error);
        throw error;
    }
}

async function getUserById(id) {
    try {
        const stmt = db.prepare("SELECT * FROM user WHERE id = ?");
        const user = stmt.get(id);
        return user || null;
    } catch (error) {
        console.error('Error getting user by id:', error);
        throw error;
    }
}

async function saveUserToDB(userData) {
    try {
        const { name, email, password } = userData;
        const stmt = db.prepare("INSERT INTO user (name, email, password) VALUES (?, ?, ?)");
        const result = stmt.run(name, email, password);
        return result.lastInsertRowid;
    } catch (error) {
        console.error('Error saving user to database:', error);
        throw error;
    }
}