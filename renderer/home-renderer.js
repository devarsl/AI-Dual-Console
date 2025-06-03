// renderer/home-renderer.js

// Alert debouncing system to prevent duplicate alerts
let lastAlertTime = 0;
let lastAlertUrl = '';
let isAlertActive = false; // Flag to prevent multiple alerts
const ALERT_DEBOUNCE_TIME = 5000; // Increased to 5 seconds
const alertQueue = new Set(); // Prevent duplicate alerts in queue

// Get DOM elements
const userNameElement = document.getElementById('user-name');
const userAvatarElement = document.querySelector('.user-avatar');
const logoutButton = document.getElementById('logout-btn');
const claudeButton = document.getElementById('claude-btn');
const gptButton = document.getElementById('gpt-btn');
const claudeWebview = document.getElementById('claude-webview');
const gptWebview = document.getElementById('gpt-webview');
const themeToggle = document.getElementById('theme-toggle');
const statusText = document.querySelector('.status-left span:last-child');

let currentAI = 'claude';
let gptLoaded = false;
let sessionCheckInterval;
let claudeLoaded = false;
// Restricted URLs for ChatGPT - Add more URLs here as needed
const RESTRICTED_URLS = [
    'https://sora.chatgpt.com',
    'https://chatgpt.com/gpts',
    'https://chat.openai.com/gpts',
    'https://sora.openai.com',
    // Add more restricted URLs here
    'https://openai.com/sora',
    'https://chatgpt.com/g/',  // Blocks all individual GPT pages
    'https://chat.openai.com/g/',  // Alternative domain for GPTs
    'https://chatgpt.com/codex',  // Blocks Codex pages
    'https://operator.chatgpt.com/?utm_source=chatgpt',
    'https://chatgpt.com/library',
];

// Function to check if URL should be blocked
function isRestrictedUrl(url) {
    return RESTRICTED_URLS.some(restrictedUrl => {
        // Check for exact match or if URL starts with restricted pattern
        return url === restrictedUrl || url.startsWith(restrictedUrl);
    });
}

// Function to add URL to restricted list (for future additions)
function addRestrictedUrl(url) {
    if (!RESTRICTED_URLS.includes(url)) {
        RESTRICTED_URLS.push(url);
        console.log(`Added restricted URL: ${url}`);
    }
}

function removeRestrictedUrl(url) {
    const index = RESTRICTED_URLS.indexOf(url);
    if (index > -1) {
        RESTRICTED_URLS.splice(index, 1);
        console.log(`Removed restricted URL: ${url}`);
    }
}
window.closeRestrictedAlert = function (buttonElement) {
    const alertOverlay = buttonElement.closest('.restricted-alert-overlay');
    if (alertOverlay && alertOverlay.parentElement) {
        alertOverlay.remove();
    }

    // Reset flags after a delay to prevent immediate re-triggering
    setTimeout(() => {
        isAlertActive = false;
        alertQueue.clear();
    }, 1000);
};

function showRestrictedPageAlert(blockedUrl) {
    const currentTime = Date.now();

    // Multiple checks to prevent duplicates
    if (isAlertActive) {
        console.log('Alert already active, skipping:', blockedUrl);
        return;
    }

    if (currentTime - lastAlertTime < ALERT_DEBOUNCE_TIME && lastAlertUrl === blockedUrl) {
        console.log('Duplicate alert suppressed for:', blockedUrl);
        return;
    }

    if (alertQueue.has(blockedUrl)) {
        console.log('Alert already queued for:', blockedUrl);
        return;
    }

    // Set flags to prevent duplicates
    isAlertActive = true;
    lastAlertTime = currentTime;
    lastAlertUrl = blockedUrl;
    alertQueue.add(blockedUrl);

    console.log(`Showing alert for blocked URL: ${blockedUrl}`);

    // Remove existing alerts first
    const existingAlerts = document.querySelectorAll('.restricted-alert-overlay');
    existingAlerts.forEach(alert => alert.remove());

    // Create custom alert overlay
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'restricted-alert-overlay';
    alertOverlay.innerHTML = `
        <div class="restricted-alert">
            <div class="alert-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Restricted Page</h3>
            <p>Access to this page is restricted:</p>
            <code>${blockedUrl}</code>
            <p>You will be redirected to the main ChatGPT page.</p>
            <button class="alert-close-btn" onclick="closeRestrictedAlert(this)">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;

    // Add styles to document if not already present
    if (!document.querySelector('#restricted-alert-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'restricted-alert-styles';
        styleElement.textContent = `
            .restricted-alert-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(3px);
                animation: fadeIn 0.3s ease-out;
            }

            .restricted-alert {
                background: linear-gradient(145deg, #ffffff, #f8f9fa);
                border: 2px solid #dc3545;
                border-radius: 15px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 
                           0 0 0 1px rgba(255, 255, 255, 0.1);
                text-align: center;
                position: relative;
                animation: slideIn 0.4s ease-out;
            }

            .alert-icon {
                font-size: 48px;
                color: #dc3545;
                margin-bottom: 20px;
                animation: pulse 2s infinite;
            }

            .restricted-alert h3 {
                color: #dc3545;
                font-size: 24px;
                font-weight: bold;
                margin: 0 0 15px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            }

            .restricted-alert p {
                color: #333;
                font-size: 16px;
                margin: 10px 0;
                line-height: 1.5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            }

            .restricted-alert code {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 8px 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 14px;
                color: #e83e8c;
                display: inline-block;
                margin: 10px 0;
                word-break: break-all;
                max-width: 100%;
            }

            .alert-close-btn {
                background: linear-gradient(145deg, #dc3545, #c82333);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            }

            .alert-close-btn:hover {
                background: linear-gradient(145deg, #c82333, #bd2130);
                transform: translateY(-2px);
                box-shadow: 0 6px 12px rgba(220, 53, 69, 0.4);
            }

            .alert-close-btn:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
            }

            .alert-close-btn i {
                margin-right: 8px;
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(-50px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            @keyframes pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                }
            }

            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .restricted-alert {
                    background: linear-gradient(145deg, #2d3748, #1a202c);
                    color: #f7fafc;
                    border-color: #e53e3e;
                }

                .restricted-alert p {
                    color: #e2e8f0;
                }

                .restricted-alert code {
                    background-color: #1a202c;
                    border-color: #4a5568;
                    color: #ed64a6;
                }
            }

            /* Mobile responsiveness */
            @media (max-width: 600px) {
                .restricted-alert {
                    padding: 20px;
                    margin: 20px;
                }

                .alert-icon {
                    font-size: 36px;
                }

                .restricted-alert h3 {
                    font-size: 20px;
                }

                .restricted-alert p {
                    font-size: 14px;
                }

                .restricted-alert code {
                    font-size: 12px;
                    padding: 6px 8px;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }

    document.body.appendChild(alertOverlay);

    // Auto-close after 7 seconds with cleanup
    setTimeout(() => {
        const closeBtn = alertOverlay.querySelector('.alert-close-btn');
        if (closeBtn) {
            closeRestrictedAlert(closeBtn);
        }
    }, 7000);
}

// Enhanced handleRestrictedAccess with better coordination
function handleRestrictedAccess(webview, blockedUrl) {
    console.log(`Blocked access to restricted URL: ${blockedUrl}`);

    // Show alert for restricted access
    showRestrictedPageAlert(blockedUrl);

    // Redirect to main ChatGPT page with delay to avoid conflicts
    setTimeout(() => {
        if (webview && webview.src) {
            webview.src = 'https://chatgpt.com/';
            updateStatusBar('Redirected from restricted page');
        }
    }, 500);
}

// Setup URL blocking for webview
function setupUrlBlocking(webview) {
    let blockingInProgress = false; // Prevent concurrent blocking attempts

    // Unified blocking handler
    function handleBlockedUrl(url, eventType) {
        if (blockingInProgress) {
            console.log(`Blocking already in progress for ${url}, skipping ${eventType}`);
            return false;
        }

        if (isRestrictedUrl(url)) {
            console.log(`Blocking ${eventType} to restricted URL: ${url}`);
            blockingInProgress = true;

            handleRestrictedAccess(webview, url);

            // Reset blocking flag after handling
            setTimeout(() => {
                blockingInProgress = false;
            }, 2000);

            return true;
        }

        return false;
    }

    // Block navigation to restricted URLs
    webview.addEventListener('will-navigate', (event) => {
        const url = event.url;
        console.log(`Navigation attempt to: ${url}`);

        if (handleBlockedUrl(url, 'will-navigate')) {
            event.preventDefault();
        }
    });

    // Block new window requests
    webview.addEventListener('new-window', (event) => {
        const url = event.url;
        console.log(`New window request to: ${url}`);

        if (handleBlockedUrl(url, 'new-window')) {
            event.preventDefault();
        }
    });

    // Monitor page loads - reduced frequency checking
    webview.addEventListener('did-finish-load', () => {
        setTimeout(() => {
            const currentUrl = webview.getURL();

            if (handleBlockedUrl(currentUrl, 'did-finish-load')) {
                return;
            }

            // Inject JavaScript to monitor client-side navigation
            if (webview === gptWebview && currentAI === 'gpt') {
                injectNavigationBlocker(webview);
            }
        }, 1000); // Delay to avoid conflicts
    });

    // Monitor in-page navigation with debouncing
    let inPageNavigationTimeout;
    webview.addEventListener('did-navigate-in-page', (event) => {
        clearTimeout(inPageNavigationTimeout);
        inPageNavigationTimeout = setTimeout(() => {
            const url = event.url;
            console.log(`In-page navigation to: ${url}`);

            handleBlockedUrl(url, 'did-navigate-in-page');
        }, 500); // Debounce in-page navigation
    });
}

// Modified injection script with alerts enabled
function injectNavigationBlocker(webview) {
    const injectionScript = `
        (function() {
            // Check if already injected to prevent duplicates
            if (window.navigationBlockerInjected) {
                console.log('Navigation blocker already injected, skipping');
                return;
            }
            window.navigationBlockerInjected = true;
            
            console.log('Navigation blocker injected into ChatGPT');
            
            // Define restricted URL patterns
            const restrictedPatterns = [
                'sora.chatgpt.com',
                'chatgpt.com/gpts',
                'chat.openai.com/gpts',
                'sora.openai.com',
                'openai.com/sora',
                'chatgpt.com/g/',
                'chat.openai.com/g/'
            ];
            
            function isRestrictedUrl(url) {
                return restrictedPatterns.some(pattern => url.includes(pattern));
            }
            
            // Function to show alert and redirect
            function showRestrictionAlert(url) {
                // Create a simple alert first
                alert('Access to this page is restricted: ' + url + '\\n\\nYou will be redirected to the main ChatGPT page.');
                
                // Then redirect
                setTimeout(() => {
                    window.location.href = 'https://chatgpt.com/';
                }, 100);
            }
            
            // Check current URL and block if restricted
            function blockRestrictedNavigation() {
                if (isRestrictedUrl(window.location.href)) {
                    console.log('Client-side: Restricted page detected:', window.location.href);
                    showRestrictionAlert(window.location.href);
                    return true;
                }
                return false;
            }
            
            // Override navigation methods
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function(state, title, url) {
                if (url && isRestrictedUrl(url)) {
                    console.log('Client-side: Blocking pushState to restricted URL:', url);
                    showRestrictionAlert(url);
                    return;
                }
                return originalPushState.apply(history, arguments);
            };
            
            history.replaceState = function(state, title, url) {
                if (url && isRestrictedUrl(url)) {
                    console.log('Client-side: Blocking replaceState to restricted URL:', url);
                    showRestrictionAlert(url);
                    return;
                }
                return originalReplaceState.apply(history, arguments);
            };
            
            // Monitor popstate events (back/forward navigation)
            window.addEventListener('popstate', function(event) {
                console.log('popstate event, checking URL...');
                setTimeout(blockRestrictedNavigation, 100);
            });
            
            // Intercept link clicks with alerts
            document.addEventListener('click', function(event) {
                const link = event.target.closest('a');
                if (link && link.href && isRestrictedUrl(link.href)) {
                    console.log('Client-side: Blocking click on restricted link:', link.href);
                    event.preventDefault();
                    event.stopPropagation();
                    showRestrictionAlert(link.href);
                    return false;
                }
            }, true);
            
            // Periodic checking with reduced frequency
            setInterval(blockRestrictedNavigation, 5000); // Every 5 seconds
            
            // Initial check with delay
            setTimeout(blockRestrictedNavigation, 2000);
            
            console.log('Navigation blocker setup complete (client-side with alerts)');
        })();
    `;

    webview.executeJavaScript(injectionScript)
        .then(() => {
            console.log('Navigation blocker injected successfully');
        })
        .catch(err => {
            console.error('Failed to inject navigation blocker:', err);
        });
}

// Function to hide ChatGPT sidebar elements
// function hideChatGPTSidebar() {
//     gptWebview.executeJavaScript(`
//         (() => {
//           const xpaths = [];
//           function hideElementByText(xpath) {
//             xpaths.push(xpath); // Store the XPath
//             const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
//             const element = result.singleNodeValue;
//             if (element) {
//               element.style.display = 'none';
//               element.style.visibility = 'hidden'; // Also hide visibility
//                 element.style.opacity = '0'; // Set opacity to 0 for good measure
//             }
//           }

//           // Hide elements by visible text
//           const xpathsToHide = [
//             '//div[text()="Search chats"]/../../..',
//             '//div[text()="Library"]/../..',
//             '//div[text()="Sora"]/../..',
//             '//div[text()="GPTs"]/../..'
//           ];
          
//           xpathsToHide.forEach(xpath => {
//             hideElementByText(xpath);
//           });

//           // Return the array of XPaths to the main context
//           return xpaths;
//         })();
//       `)
//         .then(collectedXPaths => {
//             console.log('Collected XPaths:', collectedXPaths);
//         })
//         .catch(err => console.error('Error hiding ChatGPT sidebar:', err));
// }

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeApp();
    } catch (error) {
        console.error('Error initializing app:', error);
        handleSessionExpired();
    }
});

// Initialize the application
async function initializeApp() {
    const userData = await window.electronAPI.getCurrentUser();

    if (!userData) {
        console.error('No user session found');
        handleSessionExpired();
        return;
    }

    updateUserInterface(userData);
    await restoreUserPreferences(userData);
    startSessionValidation();

    // Setup URL blocking for both webviews
    setupUrlBlocking(claudeWebview);
    setupUrlBlocking(gptWebview);

    console.log('App initialized successfully for:', userData.email);
}

// Update user interface with user data
function updateUserInterface(userData) {
    if (!userData) return;

    userNameElement.textContent = userData.name;

    // Set avatar initial
    if (userData.name && userData.name.length > 0) {
        userAvatarElement.textContent = userData.name.charAt(0).toUpperCase();
    }
}

// Restore user preferences from saved data
async function restoreUserPreferences(userData) {
    if (userData.preferences) {
        // Restore theme preference
        if (userData.preferences.darkMode) {
            toggleDarkMode(true);
        }

        // Restore last used AI
        if (userData.preferences.lastUsedAI) {
            currentAI = userData.preferences.lastUsedAI;
            setActiveAI(userData.preferences.lastUsedAI);
            await switchToAI(userData.preferences.lastUsedAI);
        } else {
            await switchToAI('claude');
        }
    } else {
        // Default to Claude
        await switchToAI('claude');
    }
}

// Start periodic session validation
function startSessionValidation() {
    // Check session validity every 5 minutes
    sessionCheckInterval = setInterval(async () => {
        try {
            const isValid = await window.electronAPI.validateSession();
            if (!isValid) {
                console.log('Session expired during validation');
                handleSessionExpired();
            }
        } catch (error) {
            console.error('Session validation error:', error);
            handleSessionExpired();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Handle session expiration
function handleSessionExpired() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }

    updateStatusBar('Session expired - redirecting to login...');

    setTimeout(() => {
        window.electronAPI.logout();
    }, 2000);
}

// Track user activity for session management
function trackUserActivity() {
    window.electronAPI.sessionActivity();
}

// Add activity listeners
document.addEventListener('click', trackUserActivity);
document.addEventListener('keypress', trackUserActivity);

// Handle logout button click
logoutButton.addEventListener('click', () => {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    saveUserPreferences();
    window.electronAPI.logout();
});

// Handle Claude button click
claudeButton.addEventListener('click', async () => {
    if (currentAI !== 'claude') {
        await switchToAI('claude');
    }
});

// Handle ChatGPT button click
gptButton.addEventListener('click', async () => {
    if (currentAI !== 'gpt') {
        await switchToAI('gpt');
    }
});

// Switch to specified AI
async function switchToAI(ai) {
    currentAI = ai;
    setActiveAI(ai);

    if (ai === 'claude') {
        await showClaudeWebview();
    } else {
        await showGPTWebview();
    }

    const aiName = ai === 'claude' ? 'Claude AI' : 'ChatGPT';
    updateStatusBar(`Connected to ${aiName}`);
    saveUserPreferences();
}

async function showClaudeWebview() {
    try {
        updateStatusBar('Loading Claude AI...');

        // Show Claude webview, hide ChatGPT webview
        claudeWebview.style.display = 'flex';
        gptWebview.style.display = 'none';

        // Only load Claude if it hasn't been loaded yet
        if (!claudeLoaded) {
            claudeWebview.partition = 'persist:claude'; // Add partition for session persistence
            claudeWebview.src = 'https://claude.ai';
            claudeLoaded = true;
            console.log('Claude webview loaded with fresh session');
        } else {
            console.log('Claude webview already loaded, just showing it');
        }

    } catch (error) {
        console.error('Error loading Claude webview:', error);
        updateStatusBar('Error loading Claude');
    }
}

// Show ChatGPT webview
async function showGPTWebview() {
    try {
        updateStatusBar('Loading ChatGPT...');

        // Show ChatGPT webview, hide Claude webview
        gptWebview.style.display = 'flex';
        claudeWebview.style.display = 'none';

        // Load ChatGPT with partition for session persistence
        if (!gptLoaded) {
            gptWebview.partition = 'persist:gpt';
            gptWebview.src = 'https://chatgpt.com';
            gptLoaded = true;

            // Hide sidebar and inject navigation blocker after loading
            setTimeout(() => {
                hideChatGPTSidebar();
                injectNavigationBlocker(gptWebview);
                console.log('ChatGPT sidebar hidden and navigation blocker injected');
            }, 3000); // Increased delay for better loading
        } else {
            // Re-inject navigation blocker if already loaded
            setTimeout(() => {
                injectNavigationBlocker(gptWebview);
            }, 1000);
        }

    } catch (error) {
        console.error('Error loading ChatGPT webview:', error);
        updateStatusBar('Error loading ChatGPT');
    }
}

// Update status bar text
function updateStatusBar(message) {
    if (statusText) {
        statusText.textContent = message;
    }
}

// Set active AI button
function setActiveAI(ai) {
    claudeButton.classList.toggle('active', ai === 'claude');
    gptButton.classList.toggle('active', ai === 'gpt');
}

// Handle theme toggle
themeToggle.addEventListener('click', () => {
    const themeIcon = themeToggle.querySelector('i');
    const isDarkMode = themeIcon.classList.contains('fa-sun');
    toggleDarkMode(!isDarkMode);
    saveUserPreferences();
});

// Toggle between light and dark mode
function toggleDarkMode(enableDark) {
    const themeIcon = themeToggle.querySelector('i');
    const cssProperties = enableDark ? {
        '--bg-color': '#1a202c',
        '--card-bg': '#2d3748',
        '--text-color': '#f7fafc',
        '--text-secondary': '#a0aec0',
        '--shadow-color-dark': '#171923'
    } : {
        '--bg-color': '#f0f4f8',
        '--card-bg': '#ffffff',
        '--text-color': '#2d3748',
        '--text-secondary': '#718096',
        '--shadow-color-dark': '#d1d9e6'
    };

    // Apply CSS properties
    Object.entries(cssProperties).forEach(([property, value]) => {
        document.documentElement.style.setProperty(property, value);
    });

    // Update theme icon
    themeIcon.classList.toggle('fa-moon', !enableDark);
    themeIcon.classList.toggle('fa-sun', enableDark);
}

// Save user preferences
function saveUserPreferences() {
    const themeIcon = themeToggle.querySelector('i');
    const isDarkMode = themeIcon.classList.contains('fa-sun');

    const preferences = {
        darkMode: isDarkMode,
        lastUsedAI: currentAI
    };

    window.electronAPI.saveUserPreferences(preferences);
}

// Claude webview event listeners
claudeWebview.addEventListener('did-start-loading', () => {
    console.log('Claude webview started loading');
    if (currentAI === 'claude') {
        updateStatusBar('Loading Claude...');
    }
});

claudeWebview.addEventListener('did-finish-load', () => {
    console.log('Claude webview finished loading');
    if (currentAI === 'claude') {
        updateStatusBar('Connected to Claude AI');
    }
});

claudeWebview.addEventListener('did-fail-load', (event) => {
    console.error('Claude webview failed to load:', event);
    if (currentAI === 'claude') {
        updateStatusBar('Failed to load Claude. Check your connection.');
    }
});

// ChatGPT webview event listeners
gptWebview.addEventListener('did-start-loading', () => {
    console.log('ChatGPT webview started loading');
    if (currentAI === 'gpt') {
        updateStatusBar('Loading ChatGPT...');
    }
});

gptWebview.addEventListener('did-finish-load', () => {
    console.log('ChatGPT webview finished loading');
    if (currentAI === 'gpt') {
        updateStatusBar('Connected to ChatGPT');
    }

    // Hide sidebar and inject navigation blocker after ChatGPT loads
    if (currentAI === 'gpt') {
        setTimeout(() => {
            hideChatGPTSidebar();
            injectNavigationBlocker(gptWebview);
            console.log('ChatGPT setup complete: sidebar hidden, navigation blocker active');
        }, 2000);
    }
});

gptWebview.addEventListener('did-fail-load', (event) => {
    console.error('ChatGPT webview failed to load:', event);
    if (currentAI === 'gpt') {
        updateStatusBar('Failed to load ChatGPT. Check your connection.');
    }
});

// Handle responsive design
window.addEventListener('resize', handleWindowResize);

function handleWindowResize() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.style.display = window.innerWidth < 768 ? 'none' : 'flex';
    }
}

// Initialize responsive state on load
window.addEventListener('DOMContentLoaded', () => {
    window.dispatchEvent(new Event('resize'));
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
});

// Export functions for external use (if needed)
window.urlBlockingAPI = {
    addRestrictedUrl,
    removeRestrictedUrl,
    isRestrictedUrl,
    getRestrictedUrls: () => [...RESTRICTED_URLS] // Return copy of array
};

document.addEventListener('DOMContentLoaded', function() {
    // Add update check button to header (optional)
    addUpdateCheckButton();
    
    // Add keyboard shortcut for checking updates
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'U') {
            e.preventDefault();
            if (window.appUpdater) {
                window.appUpdater.manualCheckForUpdates();
            }
        }
    });
});

function addUpdateCheckButton() {
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        const updateButton = document.createElement('button');
        updateButton.className = 'update-check-btn';
        updateButton.title = 'Check for Updates (Ctrl+Shift+U)';
        updateButton.innerHTML = '<i class="fas fa-sync-alt"></i>';
        
        updateButton.addEventListener('click', () => {
            if (window.appUpdater) {
                window.appUpdater.manualCheckForUpdates();
            }
        });
        
        // Insert before theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        userInfo.insertBefore(updateButton, themeToggle);
    }
}

// Add CSS for the update button (add this to your home.css)
const updateButtonStyles = `
.update-check-btn {
    background: none;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    font-size: 16px;
}

.update-check-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
    transform: rotate(180deg);
}

.update-check-btn:active {
    transform: rotate(180deg) scale(0.95);
}

/* Add update notification dot */
.update-check-btn.has-update {
    position: relative;
}

.update-check-btn.has-update::after {
    content: '';
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse 2s infinite;
}
`;

// Inject styles
const style = document.createElement('style');
style.textContent = updateButtonStyles;
document.head.appendChild(style);