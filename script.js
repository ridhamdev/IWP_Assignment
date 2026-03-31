function toggleAuth(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authSubtitle = document.getElementById('authSubtitle');

    if (mode === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authSubtitle.innerText = 'Join the creative revolution.';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authSubtitle.innerText = 'Empower your creativity. Sign in to continue.';
    }
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    if (!email || !pass) {
        errorEl.innerText = "Please fill in all fields.";
        return;
    }

    const users = JSON.parse(localStorage.getItem('aura_users')) || [];
    const user = users.find(u => u.email === email && u.password === pass);

    if (user) {
        localStorage.setItem('aura_active_user', JSON.stringify(user));
        window.location.href = 'home.html';
    } else {
        errorEl.innerText = "Invalid credentials. Try again.";
    }
}

function handleRegister() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const errorEl = document.getElementById('regError');

    if (!username || !email || !pass) {
        errorEl.innerText = "Please fill in all fields.";
        return;
    }
    
    if (pass.length < 6) {
        errorEl.innerText = "Password must be at least 6 characters.";
        return;
    }

    const users = JSON.parse(localStorage.getItem('aura_users')) || [];
    if (users.find(u => u.email === email)) {
        errorEl.innerText = "Email already mapped to an account.";
        return;
    }

    const newUser = { username, email, password: pass };
    users.push(newUser);
    localStorage.setItem('aura_users', JSON.stringify(users));
    localStorage.setItem('aura_active_user', JSON.stringify(newUser));

    window.location.href = 'home.html';
}

// Redirect if already logged in
window.onload = function() {
    if (localStorage.getItem('aura_active_user')) {
        window.location.href = 'home.html';
    }
};