document.addEventListener('DOMContentLoaded', () => {
    const activeUserStr = localStorage.getItem('aura_active_user');
    if (!activeUserStr) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(activeUserStr);
    document.getElementById('userNameDisplay').innerText = `Welcome, ${user.username}`;
    
    
    loadHistory(user.email);
    filterSearch();
});

const templates = [
    { id: 'birthday', name: 'Birthday Post', desc: 'Instagram Square (1080x1080)', img: 'https://images.unsplash.com/photo-1530103862676-de8892b12fa4?w=500&q=80' },
    { id: 'festival', name: 'Festival Header', desc: 'Landscape (1920x1080)', img: 'https://images.unsplash.com/photo-1542385151-efd9000785a0?w=500&q=80' },
    { id: 'cyberpunk', name: 'Cyberpunk 3D', desc: 'Poster (1080x1920)', img: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80' },
    { id: 'abstract', name: 'Abstract Art', desc: 'Canvas (1200x800)', img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&q=80' },
    { id: 'business', name: 'Business Card', desc: 'Standard (1050x600)', img: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=500&q=80' },
    { id: 'banner', name: 'Banner Design', desc: 'Landscape (1920x1080)', img: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=500&q=80' },
    { id: 'flyer', name: 'Club Flyer', desc: 'Portrait (800x1200)', img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&q=80' },
    { id: 'wedding', name: 'Wedding Invite', desc: 'Portrait (800x1200)', img: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&q=80' },
    { id: 'resume', name: 'Professional Resume', desc: 'A4 (800x1131)', img: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=500&q=80' },
    { id: 'youtube', name: 'YouTube Thumbnail', desc: 'HD (1280x720)', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80' }
];

function filterSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    
    // Filter templates
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = '';
    const filtered = templates.filter(t => t.name.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query));
    
    if (filtered.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1;">No templates found matching "${query}".</p>`;
    } else {
        filtered.forEach(t => {
            grid.innerHTML += `<div class="project-card glass" onclick="openEditor('${t.id}')">
                <img src="${t.img}" class="project-thumb">
                <h3>${t.name}</h3>
                <p>${t.desc}</p>
            </div>`;
        });
    }

    // Filter history
    const activeUserStr = localStorage.getItem('aura_active_user');
    if (activeUserStr) {
        const user = JSON.parse(activeUserStr);
        loadHistory(user.email, query);
    }
}

function loadHistory(email, query = "") {
    const historyKey = `aura_history_${email}`;
    const historyDataStr = localStorage.getItem(historyKey);
    const grid = document.getElementById('historyGrid');

    if (!historyDataStr) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1;">No recent designs found. Start creating!</p>`;
        return;
    }

    const history = JSON.parse(historyDataStr);
    
    if (history.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1;">No recent designs found. Start creating!</p>`;
        return;
    }

    grid.innerHTML = '';
    
    // Filter history items based on search query
    const filteredHistory = history.filter(item => {
        const name = item.name || 'Untitled Canvas';
        return name.toLowerCase().includes(query);
    });

    if (filteredHistory.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1;">No projects found matching "${query}".</p>`;
        return;
    }

    // Reverse array to show newest first
    filteredHistory.reverse().forEach((item, index) => {
        const d = new Date(item.timestamp);
        
        const card = document.createElement('div');
        card.className = 'project-card glass';
        // onclick passes item.id to resume editing
        card.onclick = () => resumeEditor(item.id);
        
        card.innerHTML = `
            <img src="${item.thumbnail}" class="project-thumb">
            <h3>${item.name || 'Untitled Canvas'}</h3>
            <p>Edited on ${d.toLocaleDateString()}</p>
        `;
        
        grid.appendChild(card);
    });
}

function openEditor(templateType) {
    localStorage.removeItem('aura_resume_id'); // Clear resume flag
    localStorage.setItem('aura_template', templateType);
    window.location.href = 'editor.html';
}

function resumeEditor(id) {
    localStorage.setItem('aura_resume_id', id);
    window.location.href = 'editor.html';
}

function logout() {
    localStorage.removeItem('aura_active_user');
    window.location.href = 'index.html';
}
