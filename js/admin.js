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
const loginBtn = document.getElementById('loginBtn');
const statusMsg = document.getElementById('statusMsg');
const messageList = document.getElementById('messageList');
const messageCount = document.getElementById('messageCount');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Check auth state on load
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session && session.user.email === ADMIN_EMAIL) {
    showDashboard();
    loadMessages();
  } else if (session && session.user.email !== ADMIN_EMAIL) {
    // Not the admin — sign them out
    await supabase.auth.signOut();
    showLogin();
    showStatus('Access denied. Only the admin can log in.', 'error');
  } else {
    showLogin();
  }
}

// Listen for auth changes (magic link callback)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    if (session.user.email === ADMIN_EMAIL) {
      showDashboard();
      loadMessages();
    } else {
      await supabase.auth.signOut();
      showLogin();
      showStatus('Access denied. Only the admin can log in.', 'error');
    }
  }
  if (event === 'SIGNED_OUT') {
    showLogin();
  }
});

// Send magic link
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  if (!email) return;

  if (email !== ADMIN_EMAIL) {
    showStatus('Access denied. Only the admin can log in.', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span><div class="spinner"></div> Sending link...</span>';

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.href
      }
    });

    if (error) throw error;

    showStatus('✨ Magic link sent! Check your Gmail inbox.', 'success');
  } catch (err) {
    console.error('Login error:', err);
    showStatus('Failed to send magic link. Try again.', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>Send Magic Link ✉️</span>';
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
    const { data, error } = await supabase
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
    const time = formatTime(msg.created_at);
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
                <div class="msg-time">${time}</div>
              </div>
            </div>
            <button class="btn-delete" onclick="deleteMessage('${msg.id}')" title="Delete message">🗑️ Delete</button>
          </div>
          <div class="msg-body">${escapeHtml(msg.message)}</div>
          ${locationWidget}
        </div>
      </div>
    `;
  }).join('');
}

// Delete a message
async function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;

  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    loadMessages(); // Refresh
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete message.');
  }
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
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
  await supabase.auth.signOut();
  showLogin();
  statusMsg.className = 'status-msg';
});

// Refresh
refreshBtn.addEventListener('click', () => {
  loadMessages();
});

// Init
checkAuth();
