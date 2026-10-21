/* Orme del Mugello su mugello.info: mappa di tutti i percorsi o di un percorso con i suoi punti.
   I dati arrivano già pronti in window.ORME (scritti da orme.py), niente richieste al server. */
(function () {
  'use strict';
  const D = window.ORME;
  if (!D || !window.L) return;

  // Vista iniziale sul Mugello: senza una vista Leaflet non sa disegnare le linee (poi fitBounds).
  const map = L.map('mappa', { zoomControl: true, scrollWheelZoom: false, tap: true }).setView([43.98, 11.4], 10);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
  });
  const sentieri = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: 0.75, attribution: 'Sentieri © <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a>'
  });
  L.control.layers({ 'Mappa stradale': osm, 'Mappa con i rilievi': topo }, null, { position: 'topright' }).addTo(map);

  // La rotellina del mouse zooma solo dopo un clic sulla mappa: scorrendo la pagina non ci si incastra.
  map.on('click', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const km = v => String(v).replace('.', ',');

  // Pulsante "Dove sono": la posizione resta nel telefono, non viene mandata a nessuno.
  const Posizione = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const b = L.DomUtil.create('button', 'btn-dove');
      b.type = 'button'; b.title = 'Mostra dove sono'; b.setAttribute('aria-label', 'Mostra dove sono');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
      L.DomEvent.disableClickPropagation(b);
      b.onclick = () => map.locate({ setView: true, maxZoom: 15 });
      return b;
    }
  });
  if ('geolocation' in navigator) new Posizione().addTo(map);
  let qui;
  map.on('locationfound', ev => {
    if (qui) qui.remove();
    qui = L.circleMarker(ev.latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map)
      .bindPopup('Sei qui').openPopup();
  });
  map.on('locationerror', () => alert('Posizione non disponibile: controlla i permessi del browser.'));

  if (D.vista === 'tutti') tutti(); else percorso();

  // ---------- tutti i percorsi ----------
  function tutti() {
    const strati = {};
    const gruppo = L.featureGroup().addTo(map);
    D.percorsi.forEach(p => {
      const sotto = L.polyline(p.linee, { color: '#fff', weight: 7, opacity: 0.8 });
      const linea = L.polyline(p.linee, { color: p.colore, weight: 4, opacity: 0.9 });
      const g = L.featureGroup([sotto, linea]).addTo(gruppo);
      g.bindTooltip(`${esc(p.numero)} · ${esc(p.titolo)}`, { sticky: true });
      g.bindPopup(`<div class="pop"><p class="pop-cat" style="color:${p.colore}">Percorso ${esc(p.numero)}</p>
        <strong>${esc(p.titolo)}</strong><p>${esc(p.lunghezza)} · ${esc(p.durata)} · ${esc(p.difficolta)}</p>
        <a class="pop-vai" href="${p.slug}/">Apri il percorso →</a></div>`);
      g.on('mouseover', () => evidenzia(p.slug));
      g.on('mouseout', () => evidenzia(null));
      strati[p.slug] = { g, linea, sotto };
    });
    map.fitBounds(gruppo.getBounds(), { padding: [12, 12] });

    const carte = [...document.querySelectorAll('.percorso')];
    function evidenzia(slug) {
      Object.entries(strati).forEach(([s, o]) => {
        const on = !slug || s === slug;
        o.linea.setStyle({ opacity: on ? 0.95 : 0.15, weight: s === slug ? 6 : 4 });
        o.sotto.setStyle({ opacity: on ? 0.8 : 0.1 });
        if (s === slug) o.g.bringToFront();
      });
      carte.forEach(c => c.classList.toggle('acceso', c.dataset.slug === slug));
    }
    carte.forEach(c => {
      c.addEventListener('mouseenter', () => evidenzia(c.dataset.slug));
      c.addEventListener('mouseleave', () => evidenzia(null));
      c.addEventListener('focusin', () => evidenzia(c.dataset.slug));
    });

    // Filtri: dentro lo stesso gruppo basta un valore, tra gruppi servono tutti.
    const bottoni = [...document.querySelectorAll('.filtro')];
    bottoni.forEach(b => b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      filtra();
    }));
    function filtra() {
      const scelti = { categoria: [], modo: [] };
      bottoni.filter(b => b.getAttribute('aria-pressed') === 'true').forEach(b => scelti[b.dataset.gruppo].push(b.dataset.valore));
      let visti = 0;
      const vis = L.featureGroup();
      carte.forEach(c => {
        const okC = !scelti.categoria.length || scelti.categoria.includes(c.dataset.categoria);
        const modi = c.dataset.modi.split('|');
        const okM = !scelti.modo.length || scelti.modo.some(m => modi.includes(m));
        const ok = okC && okM;
        c.hidden = !ok;
        const o = strati[c.dataset.slug];
        if (ok) { visti++; o.g.addTo(gruppo); o.g.getLayers().forEach(l => vis.addLayer(L.polyline(l.getLatLngs()))); }
        else gruppo.removeLayer(o.g);
      });
      document.getElementById('nessuno').hidden = visti > 0;
      if (visti) map.fitBounds(vis.getBounds(), { padding: [12, 12] });
    }
  }

  // ---------- un percorso ----------
  function percorso() {
    const c = D.colore;
    const traccia = L.featureGroup([
      L.polyline(D.linee, { color: '#fff', weight: 8, opacity: 0.85 }),
      L.polyline(D.linee, { color: c, weight: 5, opacity: 0.95 })
    ]).addTo(map);
    D.varianti.forEach(v => {
      L.polyline(v.linee, { color: c, weight: 4, opacity: 0.85, dashArray: '2 9', lineCap: 'round' })
        .bindTooltip(`${esc(v.nome)} · ${km(v.km)} km`, { sticky: true }).addTo(map);
    });
    // Partenza e arrivo: un cartellino sopra il punto, così non copre il numero del luogo che sta lì.
    const bandiera = (pos, cls, testo) => L.marker(pos, {
      icon: L.divIcon({ className: 'segno ' + cls, html: `<b>${testo}</b><i></i>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
      keyboard: false, interactive: false, zIndexOffset: 1000
    }).addTo(map);
    const stessoPunto = Math.abs(D.inizio[0] - D.fine[0]) < 0.0007 && Math.abs(D.inizio[1] - D.fine[1]) < 0.0007;
    bandiera(D.inizio, 'segno-start', stessoPunto ? 'Partenza e arrivo' : 'Partenza');
    if (!stessoPunto) bandiera(D.fine, 'segno-end', 'Arrivo');

    const livelli = { punti: L.featureGroup(), strutture: L.featureGroup(), aziende: L.featureGroup(), sentieri };
    const marcatori = D.punti.map((p, i) => {
      const m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: 'num-punto', html: `<span style="background:${c}">${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: p.nome, riseOnHover: true
      });
      m.bindPopup(`<div class="pop"><p class="pop-cat">${p.emoji} ${esc(p.tipo)}</p><strong>${i + 1}. ${esc(p.nome)}</strong>
        <a class="pop-vai" href="#punto-${i + 1}" data-apri="${i + 1}">Leggi la storia ↓</a></div>`);
      m.on('click', () => segnaVoce(i));
      livelli.punti.addLayer(m);
      return m;
    });
    const piccolo = (cls, x, etichetta) => {
      const m = L.circleMarker([x.lat, x.lon], { radius: 6, weight: 2, color: '#fff', fillOpacity: 1, className: cls });
      m.bindPopup(`<div class="pop"><p class="pop-cat">${etichetta}</p><strong>${esc(x.nome)}</strong>` +
        (x.link ? `<a class="pop-vai" href="${esc(x.link)}" target="_blank" rel="noopener">Scheda e contatti →</a>` : '') + '</div>');
      return m;
    };
    D.strutture.forEach(x => livelli.strutture.addLayer(piccolo('pt-struttura', x, 'Dove dormire')));
    D.aziende.forEach(x => livelli.aziende.addLayer(piccolo('pt-azienda', x, 'Azienda')));
    livelli.punti.addTo(map);

    document.querySelectorAll('[data-strato]').forEach(cb => cb.addEventListener('change', () => {
      const l = livelli[cb.dataset.strato];
      if (cb.checked) l.addTo(map); else map.removeLayer(l);
    }));

    const tutto = L.featureGroup([traccia, livelli.punti]);
    map.fitBounds(tutto.getBounds(), { padding: [16, 16] });

    // Elenco ↔ mappa
    const voci = [...document.querySelectorAll('#punti > li')];
    function segnaVoce(i) {
      voci.forEach((v, j) => v.classList.toggle('scelto', j === i));
    }
    document.querySelectorAll('.sulla-mappa').forEach(b => b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const i = +b.dataset.i;
      if (!map.hasLayer(livelli.punti)) { livelli.punti.addTo(map); document.querySelector('[data-strato="punti"]').checked = true; }
      segnaVoce(i);
      document.getElementById('mappa').scrollIntoView({ behavior: 'smooth', block: 'center' });
      map.flyTo(marcatori[i].getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
      setTimeout(() => marcatori[i].openPopup(), 650);
    }));
    document.addEventListener('click', ev => {
      const a = ev.target.closest('[data-apri]');
      if (!a) return;
      const li = document.getElementById('punto-' + a.dataset.apri);
      if (li) { li.querySelector('details').open = true; segnaVoce(+a.dataset.apri - 1); }
    });
  }
})();
