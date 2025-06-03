const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Function to get the correct database path
function getDatabasePath() {
    // In development
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        return path.join(__dirname, '../db.sqlite');
    }
    
    // In production (packaged app)
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'db.sqlite');
    
    // Check if database exists in user data folder
    if (!fs.existsSync(dbPath)) {
        // Copy database from app resources if it doesn't exist
        const resourceDbPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'db.sqlite');
        if (fs.existsSync(resourceDbPath)) {
            fs.copyFileSync(resourceDbPath, dbPath);
            console.log('Database copied to user data folder');
        }
    }
    
    return dbPath;
}

const dbPath = getDatabasePath();

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
let db;
try {
    db = new Database(dbPath);
    console.log(`Database connected at: ${dbPath}`);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Create user table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log("SQLite database initialized successfully");
} catch (error) {
    console.error('Failed to initialize database:', error);
    
    // Fallback: create in-memory database
    console.log('Creating fallback in-memory database...');
    db = new Database(':memory:');
    db.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("Fallback in-memory database created");
}

// Graceful shutdown
process.on('exit', () => {
    if (db) {
        db.close();
        console.log('Database connection closed');
    }
});

process.on('SIGINT', () => {
    if (db) {
        db.close();
        console.log('Database connection closed');
    }
    process.exit(0);
});

module.exports = db;