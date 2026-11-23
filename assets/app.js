/* Chittanando — progressive enhancement: currency toggle + booking widget. No dependencies. */
(() => {
  'use strict';
  const CFG = window.CHITTANANDO_CONFIG || {};
  const API = String(CFG.apiBase || '').replace(/\/+$/, '');
  const EMAIL = CFG.email || 'ig.permaheal@gmail.com';
  const BIZ_TZ = CFG.timezone || 'Asia/Kolkata';
  const BIZ_LABEL = CFG.tzLabel || 'IST';
  const $ = (s, r = document) => r.querySelector(s);
  // Intl formatters are expensive to construct; cache them.
  const dtfCache = new Map();
  const DTF = (loc, o) => { const k = (loc || '') + JSON.stringify(o); let f = dtfCache.get(k); if (!f) { f = new Intl.DateTimeFormat(loc, o); dtfCache.set(k, f); } return f; };
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let userTz = 'UTC';
  try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) {}
  const inIndia = /^Asia\/(Kolkata|Calcutta)$/.test(userTz);

  /* ---------- currency ---------- */
  function setCurrency(cur, persist) {
    $$('[data-usd]').forEach((el) => { el.textContent = el.dataset[cur]; });
    $$('.cur').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.currency === cur)));
    if (persist) { try { localStorage.setItem('cht-cur', cur); } catch (_) {} }
  }
  let saved = null; try { saved = localStorage.getItem('cht-cur'); } catch (_) {}
  const initialCur = saved || (inIndia ? 'inr' : 'usd');
  setCurrency(initialCur, false);
  if (!saved && inIndia) { const h = $('#geo-hint'); if (h) { h.textContent = 'Showing Indian rupees because your device is set to India time. You can switch above.'; h.hidden = false; } }
  $$('.cur').forEach((b) => b.addEventListener('click', () => setCurrency(b.dataset.currency, true)));

  /* close mobile menu after choosing a link */
  $$('.menu a').forEach((a) => a.addEventListener('click', () => { const d = a.closest('details'); if (d) d.open = false; }));

  /* ---------- booking ---------- */
  const root = $('#booking'); if (!root) return;
  const form = $('#booking-form'), status = $('#booking-status'), daysEl = $('#days'), timesEl = $('#times');
  const confirmEl = $('#booking-confirm'), fallbackEl = $('#booking-fallback');
  let mode = 'api'; // 'api' = live booking; 'email' = API unreachable, request is sent by prefilled email
  const AV = CFG.availability || null;
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const offsetMin = (tz, d) => {
    const p = Object.fromEntries(DTF('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 60000);
  };
  const zonedToUtc = (day, min) => {
    const [y, m, d] = day.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
    let t = guess - offsetMin(BIZ_TZ, new Date(guess)) * 60000;
    const o2 = offsetMin(BIZ_TZ, new Date(t)); t = guess - o2 * 60000; return new Date(t);
  };
  const bizDay = (d) => DTF('en-CA', { timeZone: BIZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  function localSlots(serviceId, from) {
    const svc = (CFG.services || []).find((x) => x.id === serviceId) || { duration: 60 };
    const today = bizDay(new Date()); const last = addDays(today, AV.bookingWindowDays || 60); const n = AV.daysPerPage || 14;
    if (!from || from < today || from > last) from = today;
    const earliest = Date.now() + (AV.minNoticeHours ?? 24) * 3600000; const step = AV.slotIntervalMinutes || 60;
    const days = [];
    for (let i = 0; i < n; i++) {
      const day = addDays(from, i); if (day > last) break;
      const [y, m, d] = day.split('-').map(Number);
      const ranges = (AV.closedDates || []).includes(day) ? [] : (AV.weeklyHours[DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]] || []);
      const slots = [];
      for (const [o, c] of ranges) {
        const toM = (h) => +h.split(':')[0] * 60 + +h.split(':')[1];
        for (let t = toM(o); t + svc.duration <= toM(c); t += step) {
          const st = zonedToUtc(day, t);
          slots.push({ start: st.toISOString(), end: new Date(st.getTime() + svc.duration * 60000).toISOString(), available: st.getTime() >= earliest });
        }
      }
      days.push({ day, slots });
    }
    return { from, days, nextFrom: addDays(from, n) <= last ? addDays(from, n) : null, prevFrom: from > today ? (addDays(from, -n) < today ? today : addDays(from, -n)) : null };
  }
  function switchToEmail(msg) {
    if (!AV) return showFallback(msg);
    mode = 'email'; root.dataset.state = 'email';
    form.hidden = false;
    setStatus((msg ? msg + ' ' : '') + 'You can still choose a time below — we’ll prepare an email with your request, and Chittanando will confirm availability personally.', 'error');
    $('#submit-btn').textContent = 'Send request by email';
    const h = $('.submit-row .hint'); if (h) h.textContent = 'Opens your email app with everything filled in. No payment now.';
  }
  const state = { service: null, from: null, prevFrom: null, nextFrom: null, groups: [], dayIdx: -1, start: null };
  const sameTz = userTz === BIZ_TZ || (inIndia && /Kolkata|Calcutta/.test(BIZ_TZ));

  const fmt = (d, tz, o) => DTF(undefined, { timeZone: tz, ...o }).format(d);
  const localKey = (d) => DTF('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const tzName = (() => { try { return fmt(new Date(), userTz, { timeZoneName: 'short' }).split(' ').pop(); } catch (_) { return userTz; } })();
  const hint = $('#tz-hint');
  if (hint) hint.textContent = sameTz ? `Times are shown in India Standard Time (${BIZ_LABEL}).` : `Times are shown in your time zone (${userTz.replace(/_/g, ' ')}, ${tzName}), with India Standard Time (${BIZ_LABEL}) alongside.`;

  function timeout(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
  async function api(path, opts = {}) {
    const res = await fetch(API + path, { ...opts, mode: 'cors', credentials: 'omit', signal: timeout(12000), headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    let data = null; try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  }
  function setStatus(msg, kind) { status.textContent = msg; status.className = 'notice' + (kind ? ' ' + kind : ''); status.hidden = !msg; }

  function buildMailto() {
    const g = (n) => (form.elements[n] && form.elements[n].value || '').trim();
    const svc = $('input[name=service]:checked', form);
    const svcName = svc ? svc.closest('label').querySelector('.choice-title').textContent : '';
    const when = state.start ? `${fmt(new Date(state.start), userTz, { dateStyle: 'full', timeStyle: 'short' })} (${userTz}) = ${fmt(new Date(state.start), BIZ_TZ, { dateStyle: 'medium', timeStyle: 'short' })} ${BIZ_LABEL}` : '';
    const body = `Hello Chittanando,\n\nI would like to book a session.\n\nSession: ${svcName}\nPreferred time: ${when}\nName: ${g('name')}\nPhone/WhatsApp: ${g('phone')}\nCountry: ${g('country')}${state.service === 'enquiry' ? `\nInterested in: ${g('interest')}` : ''}\nWhat I would like to work on: ${g('intention')}\n\nThank you.`;
    return `mailto:${EMAIL}?subject=${encodeURIComponent('Session booking request — ' + (svcName || 'Chittanando'))}&body=${encodeURIComponent(body)}`;
  }
  function showFallback(reason) {
    root.dataset.state = 'fallback';
    setStatus(reason || 'Online booking is temporarily unavailable.', 'error');
    $('#fallback-mailto').href = buildMailto();
    fallbackEl.hidden = false;
  }

  /* roving radio-group keyboard support */
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

  async function loadSlots(from) {
    const svc = $('input[name=service]:checked', form); if (!svc) return;
    state.service = svc.value; state.start = null;
    $('#interest-field').hidden = svc.value !== 'enquiry';
    timesEl.innerHTML = ''; daysEl.innerHTML = ''; daysEl.setAttribute('aria-busy', 'true');
    let r;
    if (mode === 'email') r = { ok: true, data: localSlots(state.service, from) };
    else {
      try { r = await api(`/api/slots?service=${encodeURIComponent(state.service)}${from ? `&from=${from}` : ''}`); } catch (_) { r = { ok: false }; }
      if (!r.ok) { switchToEmail('Live booking is offline right now.'); r = { ok: !!AV, data: AV ? localSlots(state.service, from) : null }; if (!r.ok) return; }
    }
    daysEl.removeAttribute('aria-busy');
    state.from = r.data.from; state.prevFrom = r.data.prevFrom; state.nextFrom = r.data.nextFrom;
    $('#days-prev').disabled = !state.prevFrom; $('#days-next').disabled = !state.nextFrom;
    // regroup available slots by the visitor's local date
    const map = new Map();
    for (const d of r.data.days) for (const s of d.slots) {
      if (!s.available) continue;
      const k = localKey(new Date(s.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    state.groups = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!state.groups.length) {
      daysEl.innerHTML = '';
      timesEl.innerHTML = `<p class="hint">No open times in this range. Try “Later”, or <a href="${buildMailto()}">email to ask for a time</a>.</p>`;
      return;
    }
    state.groups.forEach(([k, slots], i) => {
      const d = new Date(slots[0].start);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1;
      b.dataset.idx = i;
      b.setAttribute('aria-label', `${fmt(d, userTz, { weekday: 'long', day: 'numeric', month: 'long' })}, ${slots.length} time${slots.length > 1 ? 's' : ''} available`);
      b.innerHTML = `<span class="dow">${fmt(d, userTz, { weekday: 'short' })}</span><span class="dnum">${fmt(d, userTz, { day: 'numeric' })}</span><span class="dmon">${fmt(d, userTz, { month: 'short' })}</span>`;
      b.addEventListener('click', () => pickDay(i));
      daysEl.appendChild(b);
    });
    pickDay(0, false);
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
    if (focus !== false) { const first = $('.day[aria-checked=true]', daysEl); if (first) first.focus(); }
  }
  function pickTime(b) {
    state.start = b.dataset.start;
    $$('.time', timesEl).forEach((x) => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    fieldError('start', '');
  }
  radioKeys(daysEl, '.day', (b) => pickDay(+b.dataset.idx));
  radioKeys(timesEl, '.time', (b) => pickTime(b));
  $('#days-prev').addEventListener('click', () => state.prevFrom && loadSlots(state.prevFrom));
  $('#days-next').addEventListener('click', () => state.nextFrom && loadSlots(state.nextFrom));
  $$('input[name=service]', form).forEach((r) => r.addEventListener('change', () => loadSlots(state.from)));
  $$('[data-pick-service]').forEach((a) => a.addEventListener('click', () => {
    const r = $(`input[name=service][value="${a.dataset.pickService}"]`, form);
    if (r && !r.checked) { r.checked = true; loadSlots(state.from); }
  }));

  function fieldError(name, msg) {
    const el = $('#err-' + name); if (!el) return;
    el.textContent = msg; el.hidden = !msg;
    const input = form.elements[name];
    if (input && input.setAttribute) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function validate(v) {
    const e = {};
    if (!state.start) e.start = 'Please choose a date and time.';
    if (v.name.length < 2) e.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = 'Please enter a valid email address.';
    if (!/^\+?[0-9 ()\-]{7,20}$/.test(v.phone)) e.phone = 'Please enter a phone or WhatsApp number with country code.';
    if (v.country.length < 2) e.country = 'Please enter your country.';
    if (!v.consent) e.consent = 'Please tick the box to continue.';
    return e;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = form.elements;
    const v = { service: state.service, start: state.start, name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), country: f.country.value.trim(), intention: f.intention.value.trim(), interest: state.service === 'enquiry' ? f.interest.value : '', consent: f.consent.checked, website: f.website.value, tz: userTz };
    ['start', 'name', 'email', 'phone', 'country', 'consent'].forEach((k) => fieldError(k, ''));
    const errs = validate(v);
    if (Object.keys(errs).length) {
      Object.entries(errs).forEach(([k, m]) => fieldError(k, m));
      setStatus('Please check the highlighted fields.', 'error');
      const firstKey = Object.keys(errs)[0];
      const target = firstKey === 'start' ? ($('.time', timesEl) || $('.day', daysEl)) : f[firstKey];
      if (target && target.focus) target.focus();
      return;
    }
    if (mode === 'email') return sendByEmail();
    const btn = $('#submit-btn'); btn.disabled = true; btn.textContent = 'Sending…';
    setStatus('Sending your request…');
    let r;
    try { r = await api('/api/bookings', { method: 'POST', body: JSON.stringify(v) }); }
    catch (_) { btn.disabled = false; switchToEmail('We couldn’t reach the booking system.'); return sendByEmail(); }
    btn.disabled = false; btn.textContent = 'Request booking';
    if (r.status === 201) return showConfirmation(r.data.booking);
    if (r.status === 409) { setStatus('Sorry — that time was just taken. Please choose another.', 'error'); await loadSlots(state.from); fieldError('start', 'That time is no longer available.'); return; }
    if (r.status === 400 && r.data.errors) { Object.entries(r.data.errors).forEach(([k, m]) => fieldError(k, m)); setStatus('Please check the highlighted fields.', 'error'); return; }
    if (r.status === 429) { setStatus('Too many attempts. Please wait a few minutes and try again.', 'error'); return; }
    switchToEmail('Something went wrong on our side.'); btn.textContent = 'Send request by email';
  });

  function sendByEmail() {
    const href = buildMailto();
    const svc = $('input[name=service]:checked', form);
    const d = new Date(state.start);
    confirmEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `<p class="eyebrow">Almost done</p><h3>Send your request by email</h3>
      <p>Your email app should open with your request filled in — just press send. Chittanando will reply to confirm the time and share payment details and the video-call link.</p>
      <dl><dt>Session</dt><dd></dd><dt>Your time</dt><dd></dd></dl>
      <div class="cta-row"><a class="btn" id="email-again">Open email again</a></div>
      <p class="hint">If nothing opened, write to <a href="mailto:${EMAIL}">${EMAIL}</a> with the session, time, your name and phone/WhatsApp number.</p>`;
    const dds = wrap.querySelectorAll('dd');
    dds[0].textContent = svc ? svc.closest('label').querySelector('.choice-title').textContent : '';
    dds[1].textContent = `${fmt(d, userTz, { dateStyle: 'full', timeStyle: 'short' })}` + (sameTz ? ` ${BIZ_LABEL}` : ` (${fmt(d, BIZ_TZ, { timeStyle: 'short' })} ${BIZ_LABEL})`);
    wrap.querySelector('#email-again').href = href;
    confirmEl.appendChild(wrap);
    form.hidden = true; status.hidden = true; confirmEl.hidden = false; root.dataset.state = 'emailed';
    confirmEl.focus(); confirmEl.scrollIntoView({ block: 'start' });
    window.location.href = href;
  }

  function ics(b) {
    const t = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const e = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chittanando//Booking//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${b.ref}@chittanando`, `DTSTAMP:${t(new Date().toISOString())}`, `DTSTART:${t(b.start)}`, `DTEND:${t(b.end)}`,
      `SUMMARY:${e(b.service + ' with Chittanando')}`,
      `DESCRIPTION:${e(`Booking reference: ${b.ref}\nStatus: pending — Chittanando will confirm and share payment details and the video-call link by email or WhatsApp.\nQuestions: ${EMAIL}`)}`,
      'LOCATION:Online video call (link shared on confirmation)', 'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${e(b.service)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  }
  function showConfirmation(b) {
    const d = new Date(b.start);
    const local = fmt(d, userTz, { dateStyle: 'full', timeStyle: 'short' });
    const ist = fmt(d, BIZ_TZ, { dateStyle: 'medium', timeStyle: 'short' });
    const blobUrl = URL.createObjectURL(new Blob([ics(b)], { type: 'text/calendar' }));
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(b.service + ' with Chittanando')}&dates=${new Date(b.start).toISOString().replace(/[-:]|\.\d{3}/g, '')}/${new Date(b.end).toISOString().replace(/[-:]|\.\d{3}/g, '')}&details=${encodeURIComponent('Booking reference ' + b.ref + ' (pending confirmation)')}`;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    confirmEl.innerHTML = `
      <p class="eyebrow">Request received</p>
      <h3>Thank you, ${esc(b.name.split(' ')[0])}.</h3>
      <p>Your time is held. Chittanando will confirm personally by email or WhatsApp, usually within 24 hours, and share payment details and your video-call link.</p>
      <dl>
        <dt>Reference</dt><dd class="ref">${esc(b.ref)}</dd>
        <dt>Session</dt><dd>${esc(b.service)} · ${b.duration} min</dd>
        <dt>Your time</dt><dd>${esc(local)}${sameTz ? '' : ` <span class="muted">(${esc(userTz.replace(/_/g, ' '))})</span>`}</dd>
        ${sameTz ? '' : `<dt>India time</dt><dd>${esc(ist)} ${BIZ_LABEL}</dd>`}
        <dt>Status</dt><dd>Pending confirmation</dd>
      </dl>
      <div class="cta-row">
        <a class="btn" href="${blobUrl}" download="chittanando-${esc(b.ref)}.ics">Download calendar invite (.ics)</a>
        <a class="btn btn-ghost" href="${gcal}" target="_blank" rel="noopener">Add to Google Calendar</a>
      </div>
      <p class="hint">Please keep your reference number. To change or cancel, email <a href="mailto:${EMAIL}?subject=${encodeURIComponent('Booking ' + b.ref)}">${EMAIL}</a> quoting it.</p>`;
    form.hidden = true; setStatus('', ''); status.hidden = true;
    confirmEl.hidden = false; root.dataset.state = 'done';
    confirmEl.focus(); confirmEl.scrollIntoView({ block: 'start' });
  }

  // boot: health check, then load slots; fall back to email if the API is down
  (async () => {
    try {
      if (!API && !CFG.sameOriginApi) throw new Error('no api configured'); // e.g. GitHub Pages without a live API
      const r = await api('/api/health');
      if (!r.ok || !API && location.hostname.endsWith('github.io')) throw new Error('down');
      form.hidden = false; setStatus('', ''); status.hidden = true; root.dataset.state = 'ready';
      await loadSlots(null);
    } catch (_) { switchToEmail('Live booking is offline right now.'); await loadSlots(null); }
  })();
})();
