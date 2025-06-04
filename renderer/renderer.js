// renderer/renderer.js

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

// Add helpful hint for demo credentials
document.addEventListener('DOMContentLoaded', () => {
    // You can uncomment this to show demo credentials on page load
    // showSnackbar('Demo: usman@bxtrack.com / 123usman', false);
    
    // Initialize password toggle functionality
    initPasswordToggle();
});

// Password show/hide functionality
function initPasswordToggle() {
    const passwordInput = document.getElementById('login-password');
    const passwordToggle = document.getElementById('password-toggle');
    
    if (passwordInput && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            
            // Toggle input type
            passwordInput.type = isPassword ? 'text' : 'password';
            
            // Toggle visual state
            passwordToggle.classList.toggle('hidden', !isPassword);
            
            // Update icon
            const eyeIcon = passwordToggle.querySelector('.eye-icon');
            if (isPassword) {
                // Show "eye-off" icon when password is visible
                eyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                // Show normal "eye" icon when password is hidden
                eyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
            
            // Keep focus on input
            passwordInput.focus();
        });
    }
}