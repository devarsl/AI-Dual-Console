// renderer/updater.js - Auto-Updater UI Component
class AppUpdater {
    constructor() {
        this.isUpdateAvailable = false;
        this.isDownloading = false;
        this.isUpdateDownloaded = false;
        this.updateInfo = null;
        this.progressData = null;

        this.init();
    }

    init() {
        this.createUpdaterUI();
        this.bindEvents();
        this.checkForUpdatesOnStartup();
    }

    createUpdaterUI() {
        // Create updater notification container
        const updaterContainer = document.createElement('div');
        updaterContainer.id = 'updater-container';
        updaterContainer.className = 'updater-container hidden';

        updaterContainer.innerHTML = `
            <div class="updater-backdrop"></div>
            <div class="updater-dialog">
                <div class="updater-header">
                    <h3 class="updater-title">
                        <i class="fas fa-download updater-icon"></i>
                        <span id="updater-title-text">App Update</span>
                    </h3>
                    <button class="updater-close" id="updater-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="updater-content">
                    <div class="updater-section" id="update-available-section">
                        <div class="update-info">
                            <h4>New Version Available!</h4>
                            <p id="update-version">Version <span id="new-version"></span> is now available.</p>
                            <div class="release-notes" id="release-notes">
                                <h5>What's New:</h5>
                                <div id="release-notes-content"></div>
                            </div>
                        </div>
                        <div class="updater-actions">
                            <button class="btn-secondary" id="skip-update">Skip This Version</button>
                            <button class="btn-primary" id="download-update">
                                <i class="fas fa-download"></i>
                                Download Update
                            </button>
                        </div>
                    </div>

                    <div class="updater-section hidden" id="downloading-section">
                        <div class="download-progress">
                            <h4>Downloading Update...</h4>
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progress-fill"></div>
                                </div>
                                <div class="progress-text">
                                    <span id="progress-percent">0%</span>
                                    <span id="progress-speed">0 KB/s</span>
                                </div>
                            </div>
                            <div class="download-details">
                                <span id="download-size">0 MB / 0 MB</span>
                            </div>
                        </div>
                    </div>

                    <div class="updater-section hidden" id="ready-to-install-section">
                        <div class="install-ready">
                            <div class="success-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <h4>Update Downloaded Successfully!</h4>
                            <p>The update is ready to install. The application will restart to complete the installation.</p>
                        </div>
                        <div class="updater-actions">
                            <button class="btn-secondary" id="install-later">Install Later</button>
                            <button class="btn-primary" id="install-now">
                                <i class="fas fa-rocket"></i>
                                Restart & Install
                            </button>
                        </div>
                    </div>

                    <div class="updater-section hidden" id="checking-section">
                        <div class="checking-updates">
                            <div class="loading-spinner"></div>
                            <h4>Checking for Updates...</h4>
                            <p>Please wait while we check for the latest version.</p>
                        </div>
                    </div>

                    <div class="updater-section hidden" id="no-updates-section">
                        <div class="no-updates">
                            <div class="check-icon">
                                <i class="fas fa-check"></i>
                            </div>
                            <h4>You're Up to Date!</h4>
                            <p>You have the latest version of the application.</p>
                            <div class="current-version">
                                Current Version: <span id="current-version"></span>
                            </div>
                        </div>
                        <div class="updater-actions">
                            <button class="btn-primary" id="close-updater">Close</button>
                        </div>
                    </div>

                    <div class="updater-section hidden" id="error-section">
                        <div class="error-info">
                            <div class="error-icon">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <h4>Update Error</h4>
                            <p id="error-message">An error occurred while checking for updates.</p>
                        </div>
                        <div class="updater-actions">
                            <button class="btn-secondary" id="retry-update">Try Again</button>
                            <button class="btn-primary" id="close-error">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(updaterContainer);
    }

    bindEvents() {
        // Button event listeners
        document.getElementById('updater-close').addEventListener('click', () => this.hideUpdater());
        document.getElementById('skip-update').addEventListener('click', () => this.hideUpdater());
        document.getElementById('download-update').addEventListener('click', () => this.downloadUpdate());
        document.getElementById('install-now').addEventListener('click', () => this.installUpdate());
        document.getElementById('install-later').addEventListener('click', () => this.hideUpdater());
        document.getElementById('close-updater').addEventListener('click', () => this.hideUpdater());
        document.getElementById('close-error').addEventListener('click', () => this.hideUpdater());
        document.getElementById('retry-update').addEventListener('click', () => this.checkForUpdates());

        // Listen for update messages from main process
        if (window.electronAPI && window.electronAPI.onUpdateMessage) {
            window.electronAPI.onUpdateMessage((event, data) => {
                this.handleUpdateMessage(data);
            });
        }

        // Backdrop click to close
        document.querySelector('.updater-backdrop').addEventListener('click', () => this.hideUpdater());
    }

    async checkForUpdatesOnStartup() {
        // Auto-check for updates 5 seconds after app starts
        setTimeout(() => {
            this.checkForUpdates(false); // Silent check
        }, 5000);
    }

    async checkForUpdates(showNoUpdatesMessage = true) {
        try {
            if (showNoUpdatesMessage) {
                this.showSection('checking-section');
                this.showUpdater();
            }

            const result = await window.electronAPI.checkForUpdates();

            if (!result.success && showNoUpdatesMessage) {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            if (showNoUpdatesMessage) {
                this.showError('Failed to check for updates');
            }
        }
    }

    async downloadUpdate() {
        try {
            this.showSection('downloading-section');
            const result = await window.electronAPI.downloadUpdate();

            if (!result.success) {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error downloading update:', error);
            this.showError('Failed to download update');
        }
    }

    async installUpdate() {
        try {
            await window.electronAPI.installUpdate();
        } catch (error) {
            console.error('Error installing update:', error);
            this.showError('Failed to install update');
        }
    }

    handleUpdateMessage(data) {
        const { event, data: eventData } = data;

        switch (event) {
            case 'checking-for-update':
                // Already handled in checkForUpdates
                break;

            case 'update-available':
                this.handleUpdateAvailable(eventData);
                break;

            case 'update-not-available':
                this.handleNoUpdate(eventData);
                break;

            case 'download-progress':
                this.handleDownloadProgress(eventData);
                break;

            case 'update-downloaded':
                this.handleUpdateDownloaded(eventData);
                break;

            case 'update-error':
                this.showError(eventData.message);
                break;
        }
    }

    handleUpdateAvailable(data) {
        this.isUpdateAvailable = true;
        this.updateInfo = data;

        document.getElementById('new-version').textContent = data.version;

        // Handle release notes
        const releaseNotesContent = document.getElementById('release-notes-content');
        if (data.releaseNotes) {
            releaseNotesContent.innerHTML = this.formatReleaseNotes(data.releaseNotes);
        } else {
            document.getElementById('release-notes').style.display = 'none';
        }

        this.showSection('update-available-section');
        this.showUpdater();
    }

    handleNoUpdate(data) {
        this.getCurrentVersion().then(version => {
            document.getElementById('current-version').textContent = version;
        });

        this.showSection('no-updates-section');
    }

    handleDownloadProgress(data) {
        const { percent, bytesPerSecond, total, transferred } = data;

        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-percent').textContent = `${percent}%`;
        document.getElementById('progress-speed').textContent = `${bytesPerSecond} KB/s`;
        document.getElementById('download-size').textContent = `${transferred} MB / ${total} MB`;
    }

    handleUpdateDownloaded(data) {
        this.isUpdateDownloaded = true;
        this.showSection('ready-to-install-section');
    }

    async getCurrentVersion() {
        try {
            return await window.electronAPI.getAppVersion();
        } catch (error) {
            return 'Unknown';
        }
    }

    formatReleaseNotes(releaseNotes) {
        if (typeof releaseNotes === 'string') {
            return releaseNotes.replace(/\n/g, '<br>');
        }
        return 'New features and improvements included.';
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.updater-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show target section
        document.getElementById(sectionId).classList.remove('hidden');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showSection('error-section');
        this.showUpdater();
    }

    showUpdater() {
        document.getElementById('updater-container').classList.remove('hidden');
        document.body.classList.add('updater-open');
    }

    hideUpdater() {
        document.getElementById('updater-container').classList.add('hidden');
        document.body.classList.remove('updater-open');
    }

    // Public method to manually check for updates (called from UI)
    manualCheckForUpdates() {
        this.checkForUpdates(true);
    }
}

// Initialize updater when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.appUpdater = new AppUpdater();
    });
} else {
    window.appUpdater = new AppUpdater();
}

// Export for manual usage
window.AppUpdater = AppUpdater;