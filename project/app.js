// User & Admin credentials (for demo only; hardcoded)
const USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "user", password: "user123", role: "user" }
];

// Show login if not logged in
function showLogin() {
  document.getElementById('login-container').style.display = 'flex';
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('main-container').style.display = 'none';
  document.getElementById('bottombar').style.display = 'none';
}
function hideLogin() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('topbar').style.display = '';
  document.getElementById('main-container').style.display = '';
  document.getElementById('bottombar').style.display = '';
}

// Try auto-login from storage
let loginInfo = JSON.parse(localStorage.getItem('pg_login') || 'null');
window.loginInfo = loginInfo; // Make globally accessible
if (!loginInfo || !loginInfo.username) showLogin();
else hideLogin();

// Login handler
document.getElementById('login-btn').onclick = function() {
  const user = document.getElementById('login-username').value.trim();
  const pass = document.getElementById('login-password').value;
  const found = USERS.find(u => u.username === user && u.password === pass);
  if (found) {
    loginInfo = { username: found.username, role: found.role };
    window.loginInfo = loginInfo; // Update global reference
    localStorage.setItem('pg_login', JSON.stringify(loginInfo));
    hideLogin();
    location.reload(); // or refresh state in-place if SPA
  } else {
    document.getElementById('login-error').textContent = "Invalid credentials.";
  }
};

// Optional: logout function
window.pgLogout = function() {
  localStorage.removeItem('pg_login');
  window.loginInfo = null;
  location.reload();
};

// Main Web App - Processing Grapher Web
import { initTabsAndSidebar } from './ui.js';
import { SerialMonitor } from './serial_monitor.js';
import { LiveGraph } from './live_graph.js';
import { FileGraph } from './file_graph.js';
import { Settings } from './settings.js';

const state = {
  tab: 'serial',
  tabs: ['serial', 'live', 'file'],
  colorScheme: 'gravity',
  interfaceScale: 1.1,
  serialMonitor: null,
  liveGraph: null,
  fileGraph: null,
  settings: null,
};

initTabsAndSidebar(state);

const contentArea = document.getElementById('content-area');
state.tabs.forEach(tab => {
  const div = document.createElement('div');
  div.className = 'tab-content';
  div.id = `tab-${tab}`;
  if (tab === 'serial') div.classList.add('active');
  contentArea.appendChild(div);
});

state.serialMonitor = new SerialMonitor(state);
state.liveGraph = new LiveGraph(state);
state.fileGraph = new FileGraph(state);
state.settings = new Settings(state);

state.switchTab = function(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab-content').forEach(d => d.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'serial') state.serialMonitor.renderSidebar();
  else if (tab === 'live') state.liveGraph.renderSidebar();
  else if (tab === 'file') state.fileGraph.renderSidebar();
  else if (tab === 'settings') state.settings.renderSidebar();
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('settings')) {
    state.settings.openModal();
  }
});

// Enhanced keyboard shortcuts
document.addEventListener('keydown', e => {
  // Global shortcuts
  if (e.ctrlKey) {
    if (e.key === 'o') {
      if (state.tab === 'file') state.fileGraph.openFileDialog();
      e.preventDefault();
    }
    if (e.key === 's') {
      if (state.tab === 'live') state.liveGraph.saveCSV();
      if (state.tab === 'file') state.fileGraph.saveCSV();
      e.preventDefault();
    }
    if (e.key === 'r') {
      if (state.tab === 'live') state.liveGraph.toggleRecording();
      if (state.tab === 'serial') state.serialMonitor.toggleRecording();
      e.preventDefault();
    }
    // Tab switching shortcuts
    if (e.key >= '1' && e.key <= '3') {
      const tabIndex = parseInt(e.key) - 1;
      const tabNames = ['serial', 'live', 'file'];
      if (tabNames[tabIndex]) {
        state.switchTab(tabNames[tabIndex]);
        // Update active tab button
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabNames[tabIndex]}"]`).classList.add('active');
      }
      e.preventDefault();
    }
  }
  
  // Tab-specific shortcuts
  if (state.tab === 'live') {
    state.liveGraph.handleKeyboard(e);
  } else if (state.tab === 'serial') {
    state.serialMonitor.handleKeyboard(e);
  }
  
  // ESC to close modals
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal');
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
  }
});

// Focus management for better keyboard navigation
document.addEventListener('focusin', e => {
  if (e.target.matches('input, button, select')) {
    e.target.style.outline = '2px solid var(--sidebar-accent)';
  }
});

document.addEventListener('focusout', e => {
  if (e.target.matches('input, button, select')) {
    e.target.style.outline = '';
  }
});
