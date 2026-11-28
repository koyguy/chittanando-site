/* Chittanando v2 — email booking, campaign-tag pass-through, no analytics or cookies. */
(() => {
  'use strict';
  const CFG = window.CHITTANANDO_CONFIG || {};
  const EMAIL = CFG.email || 'ig.permaheal@gmail.com';
  const BIZ_TZ = CFG.timezone || 'Asia/Kolkata';
  const BIZ_LABEL = CFG.tzLabel || 'IST';
  const AV = CFG.availability || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const dtfCache = new Map();
  const DTF = (loc, o) => {
    const k = (loc || '') + JSON.stringify(o);
    let f = dtfCache.get(k);
    if (!f) { f = new Intl.DateTimeFormat(loc, o); dtfCache.set(k, f); }
    return f;
  };

  let userTz = 'UTC';
  try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) {}
  const inIndia = /^Asia\/(Kolkata|Calcutta)$/.test(userTz);
  const sameTz = userTz === BIZ_TZ || (inIndia && /Kolkata|Calcutta/.test(BIZ_TZ));

  /* ---- campaign tags (?src= and UTMs) stay with the visitor across v2 pages, then go into the email ---- */
  const TRACK_KEYS = ['src', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
  const TRACK_STORE = 'cht-v2-src';
  function readTrack() {
    const u = new URL(location.href);
    const found = [];
    TRACK_KEYS.forEach((k) => { const v = u.searchParams.get(k); if (v) found.push(k + '=' + v); });
    if (found.length) {
      const s = found.join(' | ');
      try { sessionStorage.setItem(TRACK_STORE, s); } catch (_) {}
      return s;
    }
    try { return sessionStorage.getItem(TRACK_STORE) || ''; } catch (_) { return ''; }
  }
  const track = readTrack();
  if (track) {
    const params = new URLSearchParams();
    track.split(' | ').forEach((pair) => {
      const i = pair.indexOf('='); if (i > 0) params.set(pair.slice(0, i), pair.slice(i + 1));
    });
    const q = params.toString();
    $$('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || /^(mailto:|https?:|tel:|#)/i.test(href)) return;
      try {
        const orig = new URL(href, location.href);
        if (orig.origin !== location.origin) return;
        TRACK_KEYS.forEach((k) => { if (params.get(k) && !orig.searchParams.get(k)) orig.searchParams.set(k, params.get(k)); });
        const pathOnly = href.split('?')[0].split('#')[0];
        a.setAttribute('href', pathOnly + orig.search + orig.hash);
      } catch (_) {}
    });
  }

  $$('.menu a').forEach((a) => a.addEventListener('click', () => { const d = a.closest('details'); if (d) d.open = false; }));

  const form = $('#booking-form');
  if (!form) return;
  const root = $('#booking');
  const status = $('#booking-status');
  const daysEl = $('#days');
  const timesEl = $('#times');
  const confirmEl = $('#booking-confirm');
  const state = { service: null, from: null, prevFrom: null, nextFrom: null, groups: [], dayIdx: -1, start: null };

  const fmt = (d, tz, o) => DTF(undefined, { timeZone: tz, ...o }).format(d);
  const localKey = (d) => DTF('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const offsetMin = (tz, d) => {
    const p = Object.fromEntries(DTF('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 60000);
  };
  const zonedToUtc = (day, min) => {
    const [y, m, d] = day.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
    let t = guess - offsetMin(BIZ_TZ, new Date(guess)) * 60000;
    const o2 = offsetMin(BIZ_TZ, new Date(t));
    return new Date(guess - o2 * 60000);
  };
  const bizDay = (d) => DTF('en-CA', { timeZone: BIZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const toM = (h) => +h.split(':')[0] * 60 + +h.split(':')[1];
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const hint = $('#tz-hint');
  if (hint && !hint.dataset.locked) {
    hint.textContent = sameTz
      ? `Times are shown in India Standard Time (${BIZ_LABEL}). The daily window is a starting point and can be adjusted.`
      : `Times are shown in your time zone (${userTz.replace(/_/g, ' ')}), with India Standard Time (${BIZ_LABEL}) alongside. The daily window is a starting point and can be adjusted.`;
  }

  function serviceOf(id) { return (CFG.services || []).find((s) => s.id === id) || { id, duration: 45, grace: 0, name: id }; }

  function localSlots(serviceId, from) {
    const svc = serviceOf(serviceId);
    const duration = svc.duration || 45;
    const grace = svc.grace || 0;
    const interval = duration + grace;
    const today = bizDay(new Date());
    const last = addDays(today, AV.bookingWindowDays || 60);
    const n = AV.daysPerPage || 14;
    if (!from || from < today || from > last) from = today;
    const earliest = Date.now() + (AV.minNoticeHours ?? 24) * 3600000;
    const open = (AV.window && AV.window[0]) || '15:00';
    const close = (AV.window && AV.window[1]) || '16:30';
    const weekly = AV.weeklyHours || {};
    const closed = AV.closedDates || [];
    const days = [];
    for (let i = 0; i < n; i++) {
      const day = addDays(from, i); if (day > last) break;
      const [y, m, d] = day.split('-').map(Number);
      const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      const ranges = closed.includes(day) ? [] : (weekly[dow] || [[open, close]]);
      const slots = [];
      for (const [o, c] of ranges) {
        for (let t = toM(o); t + duration <= toM(c); t += interval) {
          const st = zonedToUtc(day, t);
          slots.push({ start: st.toISOString(), end: new Date(st.getTime() + duration * 60000).toISOString(), available: st.getTime() >= earliest });
        }
      }
      days.push({ day, slots });
    }
    return {
      from, days,
      nextFrom: addDays(from, n) <= last ? addDays(from, n) : null,
      prevFrom: from > today ? (addDays(from, -n) < today ? today : addDays(from, -n)) : null,
    };
  }

  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg; status.className = 'notice' + (kind ? ' ' + kind : ''); status.hidden = !msg;
  }
  function fieldError(name, msg) {
    const el = $('#err-' + name); if (!el) return;
    el.textContent = msg; el.hidden = !msg;
    const input = form.elements[name];
    if (input && input.setAttribute) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function buildMailto() {
    const g = (n) => (form.elements[n] && form.elements[n].value || '').trim();
    const svc = serviceOf(state.service);
    const when = state.start
      ? `${fmt(new Date(state.start), userTz, { dateStyle: 'full', timeStyle: 'short' })} (${userTz}) = ${fmt(new Date(state.start), BIZ_TZ, { dateStyle: 'medium', timeStyle: 'short' })} ${BIZ_LABEL}`
      : '';
    const interest = form.elements.interest && !form.elements.interest.disabled ? g('interest') : '';
    const lines = [
      'Hello Chittanando,',
      '',
      `I would like to request: ${svc.name || svc.short || state.service}.`,
      `Preferred time: ${when}`,
      `Name: ${g('name')}`,
      `Phone/WhatsApp: ${g('phone')}`,
      `Country: ${g('country')}`,
    ];
    if (interest) lines.push(`Programme interest: ${interest}`);
    lines.push(`What I would like to work on: ${g('intention')}`);
    if (track) lines.push('', `Source: ${track}`);
    lines.push('', 'Thank you.');
    return `mailto:${EMAIL}?subject=${encodeURIComponent('Request: ' + (svc.short || svc.name || 'Chittanando'))}&body=${encodeURIComponent(lines.join('\n'))}`;
  }

  function pickDay(i, focus) {
    state.dayIdx = i; state.start = null;
    $$('.day', daysEl).forEach((b, j) => { b.setAttribute('aria-checked', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    const [, slots] = state.groups[i];
    timesEl.innerHTML = '';
    slots.forEach((s, j) => {
      const d = new Date(s.start);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'time'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = j === 0 ? 0 : -1;
      b.dataset.start = s.start;
      const local = fmt(d, userTz, { hour: 'numeric', minute: '2-digit' });
      const ist = fmt(d, BIZ_TZ, { hour: 'numeric', minute: '2-digit' });
      const istDay = fmt(d, BIZ_TZ, { weekday: 'short' }) !== fmt(d, userTz, { weekday: 'short' }) ? ` ${fmt(d, BIZ_TZ, { weekday: 'short' })}` : '';
      b.innerHTML = sameTz ? `<span>${local}</span><span class="ist">${BIZ_LABEL}</span>` : `<span>${local}</span><span class="ist">${ist}${istDay} ${BIZ_LABEL}</span>`;
      b.setAttribute('aria-label', sameTz ? `${local} ${BIZ_LABEL}` : `${local} your time, ${ist}${istDay} ${BIZ_LABEL}`);
      b.addEventListener('click', () => pickTime(b));
      timesEl.appendChild(b);
    });
    if (focus !== false) { const first = $('.day[aria-checked="true"]', daysEl); if (first) first.focus(); }
  }
  function pickTime(b) {
    state.start = b.dataset.start;
    $$('.time', timesEl).forEach((x) => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    fieldError('start', '');
  }
  function radioKeys(container, selector, onPick) {
    container.addEventListener('keydown', (e) => {
      const items = $$(selector, container).filter((b) => !b.disabled);
      const i = items.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % items.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
      if (e.key === 'Home') j = 0; if (e.key === 'End') j = items.length - 1;
      if (j !== null) { e.preventDefault(); items[j].focus(); onPick(items[j]); }
    });
  }

  function loadSlots(from) {
    const input = $('input[name=service]:checked', form) || form.elements.service;
    state.service = input && input.value ? input.value : (CFG.defaultService || 'soul-speak');
    state.start = null;
    const interestField = $('#interest-field');
    if (interestField) interestField.hidden = state.service !== 'discovery';
    if (form.elements.interest) form.elements.interest.disabled = state.service !== 'discovery';
    timesEl.innerHTML = ''; daysEl.innerHTML = '';
    const data = localSlots(state.service, from);
    state.from = data.from; state.prevFrom = data.prevFrom; state.nextFrom = data.nextFrom;
    const prev = $('#days-prev'); const next = $('#days-next');
    if (prev) prev.disabled = !state.prevFrom;
    if (next) next.disabled = !state.nextFrom;
    const map = new Map();
    for (const d of data.days) for (const s of d.slots) {
      if (!s.available) continue;
      const k = localKey(new Date(s.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    state.groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!state.groups.length) {
      timesEl.innerHTML = `<p class="hint">No open times in this range. Try a later period, or <a href="${buildMailto()}">email to suggest a time</a>. The daily window can be adjusted.</p>`;
      return;
    }
    state.groups.forEach((entry, i) => {
      const d = new Date(entry[1][0].start);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1;
      b.dataset.idx = i;
      b.setAttribute('aria-label', `${fmt(d, userTz, { weekday: 'long', day: 'numeric', month: 'long' })}, ${entry[1].length} time${entry[1].length > 1 ? 's' : ''} available`);
      b.innerHTML = `<span class="dow">${fmt(d, userTz, { weekday: 'short' })}</span><span class="dnum">${fmt(d, userTz, { day: 'numeric' })}</span><span class="dmon">${fmt(d, userTz, { month: 'short' })}</span>`;
      b.addEventListener('click', () => pickDay(i));
      daysEl.appendChild(b);
    });
    pickDay(0, false);
  }

  if (daysEl) radioKeys(daysEl, '.day', (b) => pickDay(+b.dataset.idx));
  if (timesEl) radioKeys(timesEl, '.time', (b) => pickTime(b));
  const prev = $('#days-prev'); const next = $('#days-next');
  if (prev) prev.addEventListener('click', () => state.prevFrom && loadSlots(state.prevFrom));
  if (next) next.addEventListener('click', () => state.nextFrom && loadSlots(state.nextFrom));
  $$('input[name=service]', form).forEach((r) => r.addEventListener('change', () => loadSlots(state.from)));

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = form.elements;
    const v = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), country: f.country.value.trim(), consent: f.consent && f.consent.checked };
    ['start', 'name', 'email', 'phone', 'country', 'consent'].forEach((k) => fieldError(k, ''));
    const errs = {};
    if (!state.start) errs.start = 'Please choose a date and time.';
    if (v.name.length < 2) errs.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errs.email = 'Please enter a valid email address.';
    if (!/^\+?[0-9 ()\-]{7,20}$/.test(v.phone)) errs.phone = 'Please enter a phone or WhatsApp number with country code.';
    if (v.country.length < 2) errs.country = 'Please enter your country.';
    if (!v.consent) errs.consent = 'Please tick the box to continue.';
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, m]) => fieldError(k, m));
      setStatus('Please check the highlighted fields.', 'error');
      const firstKey = Object.keys(errs)[0];
      const target = firstKey === 'start' ? ($('.time', timesEl) || $('.day', daysEl)) : f[firstKey];
      if (target && target.focus) target.focus();
      return;
    }
    const href = buildMailto();
    const svc = serviceOf(state.service);
    const d = new Date(state.start);
    const when = `${fmt(d, userTz, { dateStyle: 'full', timeStyle: 'short' })}` + (sameTz ? ` ${BIZ_LABEL}` : ` (${fmt(d, BIZ_TZ, { timeStyle: 'short' })} ${BIZ_LABEL})`);
    confirmEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `<p class="eyebrow">Almost done</p>
      <h3>Send your request by email</h3>
      <p>Your email app should open with the request filled in. Press send, and Chittanando will reply to confirm the time and share the next steps. No payment is taken on this website.</p>
      <dl>
        <dt>Request</dt><dd></dd>
        <dt>Your time</dt><dd></dd>
      </dl>
      <div class="cta-row"><a class="btn" id="email-again">Open email again</a></div>
      <p class="hint">If nothing opened, write to <a href="mailto:${EMAIL}">${EMAIL}</a> with the session, time, your name and a phone or WhatsApp number.</p>`;
    const dds = wrap.querySelectorAll('dd');
    dds[0].textContent = svc.name || svc.short || state.service;
    dds[1].textContent = when;
    wrap.querySelector('#email-again').href = href;
    confirmEl.appendChild(wrap);
    form.hidden = true; if (status) status.hidden = true;
    confirmEl.hidden = false; root.dataset.state = 'emailed';
    confirmEl.tabIndex = -1; confirmEl.focus(); confirmEl.scrollIntoView({ block: 'start' });
    window.location.href = href;
  });

  form.hidden = false; setStatus('', ''); if (status) status.hidden = true;
  root.dataset.state = 'ready';
  loadSlots(null);
})();
