// ===== Landing Page Animations =====

document.addEventListener('DOMContentLoaded', () => {

  // ===== SPLASH SCREEN =====
  const splash = document.getElementById('splashScreen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => { splash.style.display = 'none'; }, 600);
    }, 2000);
  }

  // ===== TYPING ANIMATION =====
  const typingEl = document.getElementById('heroTyping');
  if (typingEl) {
    const text = typingEl.getAttribute('data-text') || 'Denzeru';
    typingEl.textContent = '';
    let i = 0;
    const typeInterval = setInterval(() => {
      typingEl.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(typeInterval);
        typingEl.classList.add('typing-done');
      }
    }, 120);
  }

  // ===== SCROLL REVEAL (IntersectionObserver) =====
  const revealElements = document.querySelectorAll('.reveal');
  
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach((el) => {
      revealObserver.observe(el);
    });
  }

  // ===== STAGGERED CARD REVEAL =====
  const staggerContainers = document.querySelectorAll('.stagger-container');
  
  if (staggerContainers.length > 0 && 'IntersectionObserver' in window) {
    const staggerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cards = entry.target.querySelectorAll('.stagger-item');
          cards.forEach((card, index) => {
            setTimeout(() => {
              card.classList.add('revealed');
            }, index * 120);
          });
          staggerObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px'
    });

    staggerContainers.forEach((container) => {
      staggerObserver.observe(container);
    });
  }

  // ===== NAVBAR SCROLL EFFECT =====
  const navbar = document.getElementById('landingNav');
  if (navbar) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > 60) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Background stays fixed — no parallax scroll

  // Strips & conveyors use pure CSS hardware-accelerated animations

});
