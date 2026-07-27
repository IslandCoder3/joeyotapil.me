(function() {
  // Respect users who've asked for reduced motion — several features below
  // check this before animating anything.
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Desktop-with-a-mouse only — touch devices don't get cursor-reactive effects.
  const hasFinePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const homeSection = document.getElementById('home');

  /* ---- Preloader ---- */
  function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    preloader.classList.add('loaded');
    preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
  }
  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader);
  }
  // Safety net in case an asset (e.g. a missing image path) never fires 'load'.
  setTimeout(hidePreloader, 3500);

  /* ---- Scroll progress bar ---- */
  const scrollProgressBar = document.getElementById('scroll-progress-bar');
  if (scrollProgressBar) {
    const updateScrollProgress = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      scrollProgressBar.style.width = pct + '%';
    };
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('resize', updateScrollProgress);
    updateScrollProgress();
  }

  /* ---- Particles ---- */
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let particles = [];
  const CONNECT_RADIUS = 150; // how close the cursor needs to be to "grab" a particle
  const mouse = { x: 0, y: 0, active: false };

  if (canvas && ctx && !prefersReducedMotion) {
    // Small/touch screens get fewer particles and skip the O(n^2)
    // connecting-line pass below — that pass is by far the most
    // expensive part of every frame, and touch devices never see the
    // cursor-linking effect it exists for anyway.
    const isSmallScreen = window.matchMedia('(max-width: 700px)').matches;
    const lowPower = isSmallScreen || !hasFinePointer;
    const PARTICLE_COUNT = lowPower ? 28 : 80;
    const DRAW_CONNECTIONS = !lowPower;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    let resizeRaf = null;
    window.addEventListener('resize', () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    });
    resize();

    // Track the cursor relative to the canvas so nearby particles can
    // draw a connecting line to it, like the star field is reaching for
    // the mouse. Desktop pointer only — skipped on touch.
    if (homeSection && hasFinePointer) {
      homeSection.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      }, { passive: true });
      homeSection.addEventListener('mouseleave', () => { mouse.active = false; });
    }

    function Particle() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r = Math.random() * 2 + 0.5;
      this.a = Math.random() * 0.5 + 0.1;
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    // The loop only ever runs while the hero is actually on screen and the
    // tab is in the foreground — no point animating a canvas nobody can see.
    let rafId = null;
    let heroVisible = true;

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${p.a})`;
        ctx.fill();
      });
      // lines between nearby particles — skipped on low-power/touch devices
      if (DRAW_CONNECTIONS) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i+1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 110) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(0,212,255,${0.12 * (1 - dist/110)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }
      // connect nearby particles to the cursor, and give it its own glowing node
      if (mouse.active) {
        particles.forEach(p => {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < CONNECT_RADIUS) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(0,212,255,${0.4 * (1 - dist/CONNECT_RADIUS)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,255,.9)';
        ctx.shadowColor = 'rgba(0,212,255,.8)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      rafId = requestAnimationFrame(drawParticles);
    }

    function startParticles() {
      if (rafId === null && heroVisible && !document.hidden) rafId = requestAnimationFrame(drawParticles);
    }
    function stopParticles() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    if (homeSection && 'IntersectionObserver' in window) {
      const particlesObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          heroVisible = entry.isIntersecting;
          heroVisible ? startParticles() : stopParticles();
        });
      }, { threshold: 0 });
      particlesObserver.observe(homeSection);
    }
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stopParticles() : startParticles();
    });

    startParticles();
  }

  /* ---- Typewriter ---- */
  const roles = [
    'Web Developer',
    'Front-End Developer',
    'WordPress Developer',
    'Website Developer'
  ];
  const typedEl = document.querySelector('.typed-text');
  let roleIdx = 0, charIdx = 0, deleting = false;
  function typeLoop() {
    const current = roles[roleIdx];
    if (!deleting) {
      typedEl.textContent = current.slice(0, ++charIdx);
      if (charIdx === current.length) { deleting = true; setTimeout(typeLoop, 1800); return; }
    } else {
      typedEl.textContent = current.slice(0, --charIdx);
      if (charIdx === 0) { deleting = false; roleIdx = (roleIdx + 1) % roles.length; }
    }
    setTimeout(typeLoop, deleting ? 50 : 90);
  }
  typeLoop();

  /* ---- Scroll hint (hero) ---- */
  const scrollHintBtn = document.getElementById('scroll-hint-btn');
  if (scrollHintBtn) {
    scrollHintBtn.addEventListener('click', () => {
      const target = document.getElementById('about');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
    // Fade out once the hero is mostly scrolled past, fade back in if scrolled to top.
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        scrollHintBtn.classList.toggle('is-hidden', entry.intersectionRatio < 0.6);
      });
    }, { threshold: [0, 0.6, 1] });
    if (homeSection) heroObserver.observe(homeSection);
  }

  /* ---- Hero cursor glow (desktop mouse only) ---- */
  const heroGlow = document.getElementById('hero-cursor-glow');
  if (homeSection && heroGlow && hasFinePointer && !prefersReducedMotion) {
    homeSection.addEventListener('mousemove', (e) => {
      const rect = homeSection.getBoundingClientRect();
      heroGlow.style.left = (e.clientX - rect.left) + 'px';
      heroGlow.style.top = (e.clientY - rect.top) + 'px';
    });
  }

  /* ---- Hamburger ---- */
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hasSidebarUI = !!(hamburger && sidebar && overlay);

  function openSidebar() {
    if (!hasSidebarUI) return;
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    if (!hasSidebarUI) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hasSidebarUI) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    overlay.addEventListener('click', closeSidebar);

    /* Close the sidebar on Escape as well, for keyboard users. */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
    });

    /* Reset sidebar/overlay state if the viewport crosses back over the
       mobile breakpoint (e.g. rotating a device or leaving responsive mode
       mid-session), so the overlay/blur doesn't get stuck open. */
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024 && sidebar.classList.contains('open')) {
        closeSidebar();
      }
    });
  }

  /* ---- Active nav on scroll (IntersectionObserver) ---- */
  const navItems = document.querySelectorAll('.side-nav ul li[data-section]');
  const sections = document.querySelectorAll('section[id], #home');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach(li => {
          li.classList.toggle('active', li.dataset.section === id);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));

  /* Close sidebar on nav link click (mobile) */
  document.querySelectorAll('.side-nav a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 1024) closeSidebar();
    });
  });

  /* ---- Scroll fade-up ---- */
  const fadeEls = document.querySelectorAll('.fade-up');
  const fadeObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  fadeEls.forEach(el => fadeObs.observe(el));

  /* ---- Image loading shimmer: pause the animated background once the
     real photo has decoded, so it isn't running invisibly forever. ---- */
  document.querySelectorAll('.portfolio-img, .about-photo-wrap img').forEach(img => {
    if (img.complete) img.classList.add('img-loaded');
    else img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
  });

  /* ---- Back to top ---- */
  const backTop = document.getElementById('back-top');
  if (backTop) {
    window.addEventListener('scroll', () => {
      backTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---- Resume modal ---- */
  const resumeModal = document.getElementById('resume-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  if (resumeModal) {
    function openResumeModal(e) {
      if (e) e.preventDefault();
      resumeModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeResumeModal() {
      resumeModal.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('.sidebar-resume-btn').forEach(el => {
      el.addEventListener('click', openResumeModal);
    });
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeResumeModal);
    resumeModal.addEventListener('click', function(e) {
      if (e.target === this) closeResumeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && resumeModal.classList.contains('open')) closeResumeModal();
    });
  }

  /* ---- Portfolio: data-driven project grid ---- */
  // Add as many projects as you have — just extend this array.
  // img: screenshot path · alt: image alt text · title: display label for the link
  // url: live site link · desc: 1-2 sentence summary of the work · tools: array of tags
  //
  // NOTE: the desc/tools below are placeholders inferred from the site names/screenshots —
  // swap in the real scope of work and actual stack for each project before publishing.
  const PROJECTS = [
    {
      img: 'images/lob.webp',
      alt: 'Bayanihan LOB-DP',
      title: 'localized-online-bayanihan.infinityfree.me',
      url: 'https://localized-online-bayanihan.infinityfree.me/',
      category: 'Nonprofit / Community',
      desc: 'Community disaster-preparedness platform built to help local groups coordinate emergency response; led a full public-facing redesign with a Philippine-inspired visual system.',
      tools: ['PHP', 'MySQL', 'HTML5', 'CSS3', 'JavaScript']
    },
    {
      img: 'images/bsit.webp',
      alt: 'BSIT Department - CEBU TECH. UNIVERSITY',
      title: 'usc.edu.ph',
      url: 'bsit',
      category: 'Education',
      desc: 'Front-end development and maintenance for a university-scale website, translating design updates into responsive, cross-browser pages for thousands of daily visitors.',
      tools: ['HTML5', 'CSS3', 'JavaScript', 'WordPress']
    },
    {
      img: 'images/output3.png',
      alt: 'Dynamic Therapy',
      title: 'welovedynamictherapy.com',
      url: 'https://welovedynamictherapy.com/virtualservices',
      category: 'Healthcare',
      desc: 'Virtual-services landing page for a therapy practice, designed to convert visitors into booked consultations with a calm, trust-building layout.',
      tools: ['HTML5', 'CSS3', 'JavaScript', 'WordPress']
    },
    {
      img: 'images/output4.png',
      alt: 'Famcor Consultants',
      title: 'famcorconsultants.com',
      url: 'https://www.famcorconsultants.com/',
      category: 'Corporate / Consulting',
      desc: 'Corporate site for a consulting firm, built to present services and credibility clearly for prospective B2B clients.',
      tools: ['HTML5', 'CSS3', 'JavaScript', 'PHP']
    },
    {
      img: 'images/output5.png',
      alt: 'Kabayan Filipino Market',
      title: 'kabayanfilipinomarket.com',
      url: 'https://www.kabayanfilipinomarket.com',
      category: 'E-Commerce / Retail',
      desc: 'Storefront site for a Filipino grocery market, showcasing products and store info in a responsive, easy-to-browse layout.',
      tools: ['HTML5', 'CSS3', 'JavaScript', 'WordPress']
    }
    // { img: 'images/outputN.png', alt: '...', title: '...', url: '...', category: '...', desc: '...', tools: ['...'] },
  ];

  const PORTFOLIO_PAGE_SIZE = 3; // how many project cards show initially / per "Load More" click
  let portfolioVisibleCount = 0;

  const portfolioGrid = document.getElementById('portfolio-grid');
  const portfolioLoadMoreBtn = document.getElementById('portfolio-load-more');
  const portfolioCountBadge = document.getElementById('portfolio-count-badge');

  function buildPortfolioCard(p, batchIndex) {
    const card = document.createElement('div');
    card.className = 'portfolio-card fade-up';
    card.style.transitionDelay = `${batchIndex * 0.06}s`;
    card.innerHTML = `
      <div class="portfolio-img-wrap">
        <img class="portfolio-img" src="${p.img}" alt="${p.alt}" loading="lazy">
        <span class="portfolio-category">${p.category}</span>
      </div>
      <div class="portfolio-body">
        <div class="portfolio-header">
          <a class="portfolio-link" href="${p.url}" target="_blank">${p.title}</a>
          <span class="portfolio-arrow">↗</span>
        </div>
        <p class="portfolio-desc">${p.desc}</p>
        <div class="portfolio-tools">
          ${p.tools.map(t => `<span class="portfolio-tool-tag">${t}</span>`).join('')}
        </div>
      </div>`;
    return card;
  }

  // Appends only the next batch of cards — never touches cards already in the
  // DOM, so "Load More" can't reflow, re-animate, or shift anything already visible.
  function appendPortfolioBatch() {
    if (!portfolioGrid) return;

    if (portfolioCountBadge) {
      portfolioCountBadge.textContent = PROJECTS.length + (PROJECTS.length === 1 ? ' project' : ' projects');
    }

    const start = portfolioVisibleCount;
    const end = Math.min(portfolioVisibleCount + PORTFOLIO_PAGE_SIZE, PROJECTS.length);
    const batch = PROJECTS.slice(start, end);

    batch.forEach((p, i) => {
      const card = buildPortfolioCard(p, i);
      portfolioGrid.appendChild(card);
      fadeObs.observe(card);
    });

    portfolioVisibleCount = end;

    if (portfolioLoadMoreBtn) {
      portfolioLoadMoreBtn.classList.toggle('hidden', portfolioVisibleCount >= PROJECTS.length);
    }
  }

  if (portfolioLoadMoreBtn) {
    portfolioLoadMoreBtn.addEventListener('click', appendPortfolioBatch);
  }

  appendPortfolioBatch();

  /* ---- Certificates: data-driven gallery ---- */
  // Add as many certificates as you have — just extend this array.
  // src: image path · title: certificate name · meta: issuer / category
  const CERTIFICATES = [
    { src: 'images/cert12.webp', title: 'Certificate of Completion', meta: 'Proweaver Inc.' },
    { src: 'images/cert11.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - Top Performer' },
    { src: 'images/cert10.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert9.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - Top Performer' },
    { src: 'images/cert8.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert7.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert6.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert5.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert4.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert3.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert2.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - 2nd Top Performer' },
    { src: 'images/cert1.webp', title: 'Certificate of Appreciation', meta: 'Website Development Team - Top Performer' }
    // Replace each "src" above with your real certificate image path, e.g. 'images/cert1.jpg'
    // { src: 'images/cert5.jpg', title: 'Your Next Certificate', meta: 'Issuer Name' },
  ];

  const PAGE_SIZE = 8; // how many cards load at a time
  let visibleCount = PAGE_SIZE;
  let filteredCerts = CERTIFICATES.slice();

  const certGrid = document.getElementById('cert-grid');
  const certEmptyState = document.getElementById('cert-empty-state');
  const certCountBadge = document.getElementById('cert-count-badge');
  const certSearch = document.getElementById('cert-search');
  const certLoadMoreBtn = document.getElementById('cert-load-more');

  function renderCertGrid() {
    if (!certGrid) return;
    certGrid.innerHTML = '';
    certCountBadge.textContent = CERTIFICATES.length + (CERTIFICATES.length === 1 ? ' certificate' : ' certificates');

    if (filteredCerts.length === 0) {
      certEmptyState.style.display = 'block';
      certGrid.appendChild(certEmptyState);
      certLoadMoreBtn.classList.add('hidden');
      return;
    }
    certEmptyState.style.display = 'none';

    const slice = filteredCerts.slice(0, visibleCount);
    slice.forEach((cert) => {
      const originalIndex = CERTIFICATES.indexOf(cert);
      const card = document.createElement('div');
      card.className = 'cert-card fade-up visible';
      card.dataset.certIndex = originalIndex;
      card.innerHTML = `
        <div class="cert-img-wrap">
          <img src="${cert.src}" alt="${cert.title}" loading="lazy" onload="this.classList.add('img-loaded')">
          <div class="cert-zoom-hint">
            <span class="cert-zoom-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3.2"/>
              </svg>
            </span>
            <span class="cert-zoom-label">View Full Image</span>
          </div>
        </div>
        <div class="cert-body">
          <div class="cert-title">${cert.title}</div>
          <div class="cert-meta">${cert.meta}</div>
        </div>`;
      card.addEventListener('click', () => openLightbox(originalIndex, filteredCerts));
      certGrid.appendChild(card);
    });

    certLoadMoreBtn.classList.toggle('hidden', visibleCount >= filteredCerts.length);
  }

  if (certSearch) {
    certSearch.addEventListener('input', () => {
      const q = certSearch.value.trim().toLowerCase();
      filteredCerts = CERTIFICATES.filter(c =>
        c.title.toLowerCase().includes(q) || c.meta.toLowerCase().includes(q)
      );
      visibleCount = PAGE_SIZE;
      renderCertGrid();
    });
  }

  if (certLoadMoreBtn) {
    certLoadMoreBtn.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderCertGrid();
    });
  }

  renderCertGrid();

  /* ---- Certificate Lightbox ---- */
  const lightbox = document.getElementById('cert-lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbTitle = document.getElementById('lightbox-title');
  const lbMeta = document.getElementById('lightbox-meta');
  const lbCounter = document.getElementById('lightbox-counter');
  let activeSet = CERTIFICATES;
  let currentCert = 0;

  function showCert(index) {
    currentCert = (index + activeSet.length) % activeSet.length;
    const c = activeSet[currentCert];
    lbImg.src = c.src;
    lbImg.alt = c.title;
    lbTitle.textContent = c.title;
    lbMeta.textContent = c.meta;
    lbCounter.textContent = `${currentCert + 1} / ${activeSet.length}`;
  }

  function openLightbox(originalIndex, set) {
    activeSet = set && set.length ? set : CERTIFICATES;
    const startIndex = activeSet.indexOf(CERTIFICATES[originalIndex]);
    showCert(startIndex === -1 ? 0 : startIndex);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (lightbox) {
    const lbCloseBtn = document.getElementById('lightbox-close-btn');
    const lbPrevBtn = document.getElementById('lightbox-prev-btn');
    const lbNextBtn = document.getElementById('lightbox-next-btn');
    if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLightbox);
    if (lbPrevBtn) lbPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); showCert(currentCert - 1); });
    if (lbNextBtn) lbNextBtn.addEventListener('click', (e) => { e.stopPropagation(); showCert(currentCert + 1); });

    if (lbImg) lbImg.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
      if (e.target === this) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showCert(currentCert - 1);
      if (e.key === 'ArrowRight') showCert(currentCert + 1);
    });
  }
})();
