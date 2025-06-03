// renderer/renderer.js
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.form}Form`).classList.add('active');
    });
});

// Snackbar utility
function showSnackbar(message, isError = false) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.className = `snackbar show${isError ? ' error' : ' success'}`;
    setTimeout(() => {
        snackbar.className = snackbar.className.replace('show', '');
    }, 4000);
}

// Show status message (deprecated inline)
function showStatus(message, isError = false) {
    // Hide inline status, use snackbar instead
    showSnackbar(message, isError);
}

// Utility to enable/disable login form
function setLoginFormDisabled(disabled) {
    const form = document.getElementById('login-form');
    Array.from(form.elements).forEach(el => {
        el.disabled = disabled;
    });
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        if (disabled) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = 'Logging in...';
        } else {
            btn.textContent = btn.dataset.originalText || 'Login';
        }
    }
}

// Handle login form submission
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoginFormDisabled(true);
    showSnackbar('', false); // Hide any previous snackbar

    const loginData = {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    };

    try {
        const result = await window.electronAPI.loginUser(loginData);
        if (result.success) {
            showSnackbar('Login successful! Redirecting...');
            setTimeout(() => {
                window.electronAPI.navigateToHome({ user: result.user });
            }, 1000);
        } else {
            showSnackbar(result.message || 'Login failed. Please check your credentials.', true);
        }
    } catch (error) {
        showSnackbar('Login failed: ' + error.message, true);
    } finally {
        setLoginFormDisabled(false);
    }
});

// Handle signup form submission
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    if (password !== confirmPassword) {
        showStatus('Passwords do not match!', true);
        return;
    }
    
    const userData = {
        name: document.getElementById('signup-name').value,
        email: document.getElementById('signup-email').value,
        password: password,
        type: 'manual'
    };

    try {
        const result = await window.electronAPI.registerUser(userData);
        if (result.success) {
            showStatus('Account created successfully! Please login.');
            // Reset form and switch to login tab
            e.target.reset();
            document.querySelector('[data-form="login"]').click();
        } else {
            showStatus(result.message || 'Failed to create account.', true);
        }
    } catch (error) {
        showStatus('Registration failed: ' + error.message, true);
    }
});