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
  document.querySelectorAll('.nav-links a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === href);
  });
}

window.UI = { initStarsAndParticles, initClock, setActiveNav };

