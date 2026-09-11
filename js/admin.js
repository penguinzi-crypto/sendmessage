// ===== Admin Dashboard Logic =====

// Splash screen
const splashScreen = document.getElementById('splashScreen');
window.addEventListener('load', () => {
  setTimeout(() => {
    splashScreen.classList.add('hide');
    loginSection.style.transition = 'opacity 0.6s ease';
    loginSection.style.opacity = '1';
  }, 2200);
});

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const togglePassword = document.getElementById('togglePassword');
const loginBtn = document.getElementById('loginBtn');
const statusMsg = document.getElementById('statusMsg');
const messageList = document.getElementById('messageList');
const messageCount = document.getElementById('messageCount');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');

function getClient() {
  return window.supabaseClient || window.supabase;
}

// Password visibility toggle
if (togglePassword && passwordInput) {
  togglePassword.addEventListener('click', () => {
    const isPass = passwordInput.type === 'password';
    passwordInput.type = isPass ? 'text' : 'password';
    togglePassword.textContent = isPass ? '🙈' : '👁️';
  });
}

// Check auth state on load
async function checkAuth() {
  const client = getClient();
  if (!client || !client.auth) return;

  const { data: { session } } = await client.auth.getSession();

  if (session && session.user.email === ADMIN_EMAIL) {
    showDashboard();
    loadMessages();
  } else if (session && session.user.email !== ADMIN_EMAIL) {
    await client.auth.signOut();
    showLogin();
    showStatus('Access denied. Only the admin can log in.', 'error');
  } else {
    showLogin();
  }
}

// Listen for auth changes
(function setupAuthListener() {
  const client = getClient();
  if (!client || !client.auth) return;

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      if (session.user.email === ADMIN_EMAIL) {
        showDashboard();
        loadMessages();
      } else {
        await client.auth.signOut();
        showLogin();
        showStatus('Access denied. Only the admin can log in.', 'error');
      }
    }
    if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
})();

// Email + Password Sign In
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) return;

  if (email !== ADMIN_EMAIL) {
    showStatus('Access denied. Invalid admin email.', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span><div class="spinner"></div> Signing in...</span>';

  try {
    const client = getClient();
    if (!client || !client.auth) {
      throw new Error('Authentication service is initializing. Please try again.');
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    showStatus('Sign in successful!', 'success');
    showDashboard();
    loadMessages();
  } catch (err) {
    console.error('Login error:', err);
    showStatus(err.message || 'Invalid email or password.', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>Sign In</span>';
  }
});

// Load messages from Supabase
async function loadMessages() {
  // Show skeleton loading
  messageList.innerHTML = `
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  `;

  try {
    const client = getClient();
    if (!client || typeof client.from !== 'function') {
      throw new Error('Supabase client is not initialized.');
    }

    const { data, error } = await client
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    messageCount.textContent = `${data.length} message${data.length !== 1 ? 's' : ''}`;
    renderMessages(data);
  } catch (err) {
    console.error('Error loading messages:', err);
    messageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Failed to load messages</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// Render message cards
function renderMessages(messages) {
  if (messages.length === 0) {
    messageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>No messages yet</h3>
        <p>Share your link and wait for anonymous messages!</p>
      </div>
    `;
    return;
  }

  messageList.innerHTML = messages.map((msg, i) => {
    const name = msg.name || 'Anonymous';
    const initial = name === 'Anonymous' ? '?' : name.charAt(0).toUpperCase();
    const avatarClass = name === 'Anonymous' ? 'msg-avatar anonymous' : 'msg-avatar';
    const timeInfo = formatTime(msg.created_at);
    const locationWidget = renderLocationWidget(msg);

    return `
      <div class="message-card" style="animation-delay: ${i * 0.08}s">
        <div class="card-glow-msg"></div>
        <div class="card-glass-msg"></div>
        <div class="msg-inner">
          <div class="msg-header">
            <div class="msg-sender">
              <div class="${avatarClass}">${initial}</div>
              <div>
                <div class="msg-name">${escapeHtml(name)}</div>
                <div class="msg-time" title="Exact Sent Time: ${timeInfo.exactDate} at ${timeInfo.exactTime}">
                  <span>📅 ${timeInfo.exactDate}</span>
                  <span>🕒 ${timeInfo.exactTime}</span>
                  <span class="time-relative">${timeInfo.relative}</span>
                </div>
              </div>
            </div>
            <button class="btn-delete" onclick="deleteMessage('${msg.id}')" title="Delete this message">🗑️ Delete</button>
          </div>
          <div class="msg-body">${escapeHtml(msg.message)}</div>
          ${locationWidget}
        </div>
      </div>
    `;
  }).join('');
}

// Delete a message (explicitly attached to window)
window.deleteMessage = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this message?')) return;

  const btn = document.querySelector(`button[onclick*="${id}"]`);
  const originalText = btn ? btn.innerHTML : '🗑️ Delete';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Deleting...';
  }

  try {
    const client = getClient();
    if (!client) throw new Error('Supabase client is not ready. Please refresh.');

    const { error, count } = await client
      .from('messages')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw error;
    }

    if (count === 0) {
      throw new Error('Supabase Row Level Security (RLS) blocked the delete. Please run the SQL command below in your Supabase SQL Editor.');
    }

    // Refresh dashboard list
    await loadMessages();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Could not delete message:\n' + (err.message || 'Permission denied'));
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

// Format timestamp with exact date, exact time, and relative age
function formatTime(timestamp) {
  if (!timestamp) return { exactDate: 'Unknown date', exactTime: '', relative: '', display: 'Unknown' };
  const date = new Date(timestamp);

  // Exact localized date e.g. "Sep 11, 2026"
  const exactDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Exact localized time e.g. "10:45 PM"
  const exactTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Relative elapsed time
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = 'Just now';
  if (diffMins < 1) relative = `${Math.max(1, diffSecs)}s ago`;
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = `${diffDays}d ago`;

  return {
    exactDate,
    exactTime,
    relative,
    display: `${exactDate} • ${exactTime} (${relative})`
  };
}

// Render rich exact location widget
function renderLocationWidget(msg) {
  const city = msg.city || '';
  const rawRegion = msg.region || '';
  const country = msg.country || '';

  if (!city && !rawRegion && !country) return '';

  let coords = null;
  let ipInfo = null;
  let source = null;
  let regionName = rawRegion;

  // Parse delimiter " | "
  if (rawRegion.includes(' | ')) {
    const parts = rawRegion.split(' | ');
    regionName = parts[0] || '';
    for (const part of parts) {
      if (part.startsWith('Coords: ')) {
        coords = part.replace('Coords: ', '').trim();
      } else if (part.startsWith('IP: ')) {
        ipInfo = part.replace('IP: ', '').trim();
      } else if (part.startsWith('Source: ')) {
        source = part.replace('Source: ', '').trim();
      }
    }
  }

  // Construct location address title
  const locAddress = [city, regionName, country].filter(Boolean).join(', ');

  return `
    <div class="msg-loc-box">
      <div class="msg-loc-main">
        <div class="msg-loc-title">
          <span class="loc-icon">📍</span>
          <span class="loc-text">${escapeHtml(locAddress)}</span>
          ${source ? `<span class="loc-badge ${source.includes('GPS') ? 'badge-gps' : 'badge-ip'}">${escapeHtml(source)}</span>` : ''}
        </div>
        ${ipInfo ? `
          <div class="msg-loc-sub">
            <span class="loc-sub-item">🌐 <strong>Network:</strong> ${escapeHtml(ipInfo)}</span>
          </div>
        ` : ''}
      </div>
      ${coords ? `
        <div class="msg-loc-actions">
          <span class="coords-pill">🎯 ${escapeHtml(coords)}</span>
          <a href="https://www.google.com/maps?q=${encodeURIComponent(coords)}" target="_blank" rel="noopener noreferrer" class="btn-maps-link" title="Open exact pin in Google Maps">
            <span>View on Google Maps ↗</span>
          </a>
        </div>
      ` : ''}
    </div>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Show/hide sections
function showLogin() {
  loginSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
}

function showDashboard() {
  loginSection.style.display = 'none';
  dashboardSection.style.display = 'flex';
}

// Status message
function showStatus(text, type) {
  statusMsg.textContent = text;
  statusMsg.className = `status-msg ${type}`;
}

// Logout
logoutBtn.addEventListener('click', async () => {
  const client = getClient();
  if (client && client.auth) {
    await client.auth.signOut();
  }
  showLogin();
  statusMsg.className = 'status-msg';
  statusMsg.style.display = 'none';
});

// Refresh
refreshBtn.addEventListener('click', () => {
  loadMessages();
});

// Init
checkAuth();
