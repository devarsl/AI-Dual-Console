// main/main.js
const { app, BrowserWindow, ipcMain, dialog, session,Menu } = require('electron');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcrypt');
const fs = require('fs');

let mainWindow;
let currentUser = null;
const userSessionPath = path.join(app.getPath('userData'), 'user-session.json');

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

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
}

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

// async function loadCookiesFromFile(cookiesFilePath, partition = 'default') {
//     try {
//         if (!fs.existsSync(cookiesFilePath)) {
//             console.log(`Cookie file not found: ${cookiesFilePath}`);
//             return false;
//         }

//         const cookiesData = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf8'));
//         const ses = partition === 'default' ? session.defaultSession : session.fromPartition(partition);

//         // Clear existing cookies first
//         await ses.clearStorageData({ storages: ['cookies'] });

//         let successCount = 0;
//         let errorCount = 0;

//         // Determine the base URL for cookies - FIXED
//         const baseUrl = cookiesFilePath.includes('claude') ? 'https://claude.ai' : 'https://chatgpt.com';

//         // Load cookies from file
//         for (const cookie of cookiesData) {
//             try {
//                 // Skip invalid cookies
//                 if (!cookie.name || !cookie.value) {
//                     errorCount++;
//                     continue;
//                 }

//                 // Create basic cookie object
//                 const cookieDetails = {
//                     url: baseUrl,
//                     name: cookie.name,
//                     value: cookie.value,
//                     path: cookie.path || '/',
//                     secure: cookie.secure !== false, // Default to secure for HTTPS
//                     httpOnly: cookie.httpOnly || false
//                 };

//                 // Handle sameSite attribute properly
//                 if (cookie.sameSite) {
//                     const sameSiteValue = cookie.sameSite.toLowerCase();
//                     if (['strict', 'lax', 'none'].includes(sameSiteValue)) {
//                         cookieDetails.sameSite = sameSiteValue;
//                     }
//                 }

//                 // Handle domain attribute more carefully
//                 if (cookie.domain && !cookie.name.startsWith('__Host-')) {
//                     let domain = cookie.domain;

//                     // Clean and validate domain
//                     if (domain.startsWith('.')) {
//                         domain = domain.substring(1);
//                     }

//                     // Only set domain if it matches our target domain
//                     if (cookiesFilePath.includes('claude')) {
//                         if (domain === 'claude.ai' || domain.endsWith('.claude.ai')) {
//                             cookieDetails.domain = cookie.domain;
//                         }
//                     } else {
//                         if (domain === 'chatgpt.com' || domain.endsWith('.chatgpt.com') ||
//                             domain === 'openai.com' || domain.endsWith('.openai.com')) {
//                             cookieDetails.domain = cookie.domain;
//                         }
//                     }
//                 }

//                 // Handle expiration properly
//                 if (cookie.expirationDate && typeof cookie.expirationDate === 'number' && cookie.expirationDate > 0) {
//                     cookieDetails.expirationDate = cookie.expirationDate;
//                 } else if (cookie.expires && typeof cookie.expires === 'number' && cookie.expires > 0) {
//                     cookieDetails.expirationDate = cookie.expires;
//                 }

//                 // Try to set the cookie
//                 await ses.cookies.set(cookieDetails);
//                 successCount++;

//             } catch (cookieError) {
//                 errorCount++;
//                 // Only log the first few errors to avoid spam
//                 if (errorCount <= 3) {
//                     console.log(`Skipped cookie "${cookie.name}": ${cookieError.message}`);
//                 }
//             }
//         }

//         if (errorCount > 3) {
//             console.log(`... and ${errorCount - 3} more cookie errors`);
//         }

//         console.log(`Cookie loading completed for ${cookiesFilePath}:`);
//         console.log(`  ✓ ${successCount} cookies loaded successfully`);
//         console.log(`  ✗ ${errorCount} cookies skipped due to errors`);

//         return successCount > 0;
//     } catch (error) {
//         console.error('Error loading cookies from file:', error);
//         return false;
//     }
// }

// ipcMain.handle('load-cookies', async (event, aiType) => {
//     console.log(`Skipping cookies loading as not a required feature for now if need in future uncomment the required code.`);
//     try {
//         let cookiesPath;
//         let partition;

//         if (aiType === 'claude') {
//             cookiesPath = claudeCookiesPath;
//             partition = 'persist:claude';
//             // Use original function for Claude (it works)
//             const success = await loadCookiesFromFile(cookiesPath, partition);
//             return { success, message: success ? 'Cookies loaded successfully' : 'Failed to load cookies' };
//         }
//         // else if (aiType === 'gpt') {
//         //     cookiesPath = gptCookiesPath;
//         //     partition = 'persist:gpt';
//         //     const success = await loadChatGPTCookies(cookiesPath, partition);
//         //     return { success, message: success ? 'ChatGPT cookies loaded successfully' : 'Failed to load ChatGPT cookies' };
//         // } 
//         else {
//             return { success: false, message: 'Invalid AI type' };
//         }
//     } catch (error) {
//         console.error('Error in load-cookies handler:', error);
//         return { success: false, message: error.message };
//     }
// });
