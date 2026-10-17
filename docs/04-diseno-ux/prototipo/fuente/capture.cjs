const { chromium } = require(process.env.PW);
const fs = require('fs'), path = require('path');
(async () => {
  const dir = process.argv[2], out = process.argv[3];
  const b = await chromium.launch(); const frames = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html')).sort()) {
    const tanda = f.match(/Tanda (\d)/)[1];
    const p = await b.newPage({ viewport: { width: 1700, height: 1100 } });
    await p.route(/fonts\.g/, r => r.abort());
    await p.route(/unpkg\.com\/react@/, r => r.fulfill({path: process.env.V+'/react.js', contentType:'application/javascript'}));
    await p.route(/unpkg\.com\/react-dom@/, r => r.fulfill({path: process.env.V+'/react-dom.js', contentType:'application/javascript'}));
    await p.goto('file://' + path.join(dir, f)); await p.waitForTimeout(6000);
    const meta = await p.evaluate(() => [...document.querySelectorAll('.dv-opt')].map(o => {
      let sec = o.closest('div'); let h = null; let el = o;
      while (el && !h) { let s = el.previousElementSibling; while (s && !h) { if (s.matches && s.matches('h3.dv-h')) h = s; else if (s.querySelector) { const q = s.querySelectorAll('h3.dv-h'); if (q.length) h = q[q.length-1]; } s = s.previousElementSibling; } el = el.parentElement; }
      const card = o.children[1]; const r = card.getBoundingClientRect();
      const texts = [];
      card.querySelectorAll('*').forEach(e => {
        const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
        const isBtn = e.tagName === 'BUTTON' || e.tagName === 'A';
        const t = isBtn ? e.innerText.replace(/\s+/g, ' ').trim() : own;
        if (!t || t.length > 60) return;
        const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2) return;
        texts.push({ t, btn: isBtn, x: Math.round(q.x - r.x), y: Math.round(q.y - r.y), w: Math.round(q.width), h: Math.round(q.height) });
      });
      return { id: o.id, label: o.querySelector('.dv-olabel').innerText.replace(o.id, '').trim(), section: h ? h.innerText.trim() : '', w: Math.round(r.width), h: Math.round(r.height), texts };
    }));
    const handles = await p.$$('.dv-opt');
    for (let i = 0; i < handles.length; i++) {
      const card = await handles[i].$(':scope > :nth-child(2)');
      await card.screenshot({ path: path.join(out, 'img', meta[i].id + '.jpg'), type: 'jpeg', quality: 74 });
      frames.push({ tanda, ...meta[i] });
    }
    await p.close();
  }
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames));
  console.log(frames.length, 'frames');
  await b.close();
})();
