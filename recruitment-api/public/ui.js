function initStarsAndParticles() {
  const starsEl = document.getElementById('stars');
  if (starsEl && !starsEl.hasChildNodes()) {
    for (let i = 0; i < 100; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() * 1.8 + 0.4;
      s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--min:${(Math.random()*.15+.05).toFixed(2)};--max:${(Math.random()*.5+.3).toFixed(2)};--d:${(Math.random()*4+2).toFixed(1)}s;--delay:-${(Math.random()*6).toFixed(1)}s;`;
      starsEl.appendChild(s);
    }
  }

  const partEl = document.getElementById('particles');
  if (partEl && !partEl.hasChildNodes()) {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `left:${Math.random()*100}%;--d:${(Math.random()*10+7).toFixed(1)}s;--delay:-${(Math.random()*10).toFixed(1)}s;--dx:${((Math.random()-.5)*50).toFixed(0)}px;`;
      partEl.appendChild(p);
    }
  }
}

function initClock() {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('clock-date');
  if (!clockEl || !dateEl) return;
  if (window.__uiClockStarted) return;
  window.__uiClockStarted = true;

  const days = ['Неділя','Понеділок','Вівторок','Середа','Четвер',"П'ятниця",'Субота'];
  const months = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  const pad = (n) => String(n).padStart(2, '0');

  function updateClock() {
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

function setActiveNav(href) {
  document.querySelectorAll('.sidebar-link').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === href);
  });
}

function initSidebarToggle() {
  const toggle = document.querySelector('.mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 980 && !sidebar.contains(e.target) && !toggle.contains(e.target) && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });
}

async function hideUsersNavForRecruiter() {
  const usersLinks = Array.from(document.querySelectorAll('.sidebar-link[href="/users"]'));
  if (!usersLinks.length) return;
  const token = localStorage.getItem('accessToken') || '';
  if (!token) {
    usersLinks.forEach((a) => a.remove());
    return;
  }
  try {
    const res = await fetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const me = await res.json();
    if (me?.role !== 'admin') {
      usersLinks.forEach((a) => a.remove());
    }
  } catch {
  }
}

window.UI = { initStarsAndParticles, initClock, setActiveNav, initThemeToggle, hideUsersNavForRecruiter, initSidebarToggle };

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initClock();
  initSidebarToggle();
  hideUsersNavForRecruiter();
});


