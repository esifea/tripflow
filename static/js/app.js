/**
 * TripFlow — Main Application JavaScript
 * SPA router, trip editor, event management
 */
(function () {
  'use strict';

  var t = window.i18n.t;

  // ── State ──
  let currentTrip = null;
  let currentEvents = [];
  let currentDay = 1;
  let editingEventId = null;
  let saveTimer = null;

  // ── API helpers ──
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  // ── Router ──
  function route() {
    const path = window.location.pathname;

    if (path.startsWith('/plan/')) {
      const token = path.replace('/plan/', '');
      if (token) {
        showPage('loading');
        loadTrip(token);
        return;
      }
    }

    showPage('landing');
    initLandingAnimations();
  }

  function showPage(name) {
    document.querySelectorAll('.page').forEach((p) => (p.style.display = 'none'));
    const page = document.getElementById('page-' + name);
    if (page) page.style.display = '';

    // Show features alongside landing
    if (name === 'landing') {
      document.getElementById('features').style.display = '';
    }

    // Show/hide footer
    const footer = document.getElementById('footer');
    footer.style.display = name === 'landing' ? '' : 'none';

    // Scroll to top for non-landing pages
    if (name !== 'landing') {
      window.scrollTo(0, 0);
    }

    // Update nav
    const navActions = document.getElementById('nav-actions');
    if (name === 'landing') {
      navActions.innerHTML = `
        <button class="btn btn-primary btn-sm" id="nav-new-trip">${t('nav.newTrip')}</button>
      `;
      document.getElementById('nav-new-trip').addEventListener('click', createNewTrip);
    } else if (name === 'trip') {
      navActions.innerHTML = '';
    } else {
      navActions.innerHTML = '';
    }
  }

  // ── Trip loading ──
  async function loadTrip(token) {
    try {
      const data = await api('GET', `/api/trips/${token}`);
      currentTrip = data.trip;
      currentEvents = data.events || [];
      // Restore day from URL hash (e.g. #day3), default to 1
      const hashMatch = window.location.hash.match(/^#day(\d+)$/);
      currentDay = hashMatch ? parseInt(hashMatch[1]) : 1;
      renderTripEditor();
      showPage('trip');
    } catch (e) {
      console.error('Failed to load trip:', e);
      showPage('notfound');
    }
  }

  // ── Create new trip ──
  async function createNewTrip() {
    try {
      const trip = await api('POST', '/api/trips', {});
      window.history.pushState({}, '', `/plan/${trip.token}`);
      currentTrip = trip;
      currentEvents = [];
      currentDay = 1;
      renderTripEditor();
      showPage('trip');
      showToast(t('toast.tripCreated'));
    } catch (e) {
      showToast(t('toast.tripCreateFailed'), true);
    }
  }

  // ── Render trip editor ──
  function renderTripEditor() {
    if (!currentTrip) return;

    document.getElementById('trip-name').value = currentTrip.name || '';
    document.getElementById('trip-destination').value = currentTrip.destination || '';
    document.getElementById('trip-start-date').value = currentTrip.start_date || '';
    document.getElementById('trip-end-date').value = currentTrip.end_date || '';
    renderChecklist();
    document.getElementById('trip-memo').value = currentTrip.memo || '';
    updateMemoBadge();

    updateDuration();
    renderDayTabs();
    renderEvents();
  }

  // ── Auto-save trip metadata ──
  function scheduleSave() {
    if (!validateTripDates()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveTrip, 800);
  }

  async function saveTrip() {
    if (!currentTrip) return;
    try {
      const updated = await api('PUT', `/api/trips/${currentTrip.token}`, {
        name: document.getElementById('trip-name').value || 'Untitled Trip',
        destination: document.getElementById('trip-destination').value.trim(),
        start_date: document.getElementById('trip-start-date').value,
        end_date: document.getElementById('trip-end-date').value,
        checklist: JSON.stringify(checklistItems),
        memo: document.getElementById('trip-memo').value,
      });
      currentTrip = updated;
      updateDuration();
      renderDayTabs();
    } catch (e) {
      console.error('Failed to save trip:', e);
    }
  }

  // ── Checklist ──
  let checklistItems = [];

  function toggleChecklist() {
    document.getElementById('checklist-section').classList.toggle('open');
  }

  function getChecklist() {
    try {
      return JSON.parse(currentTrip.checklist || '[]');
    } catch { return []; }
  }

  function renderChecklist() {
    checklistItems = getChecklist();
    const container = document.getElementById('checklist-items');
    container.innerHTML = checklistItems.map((item, i) => `
      <div class="checklist-item${item.checked ? ' checked' : ''}" data-idx="${i}">
        <input type="checkbox" ${item.checked ? 'checked' : ''} data-idx="${i}">
        <span class="checklist-item-text">${escapeHtml(item.text)}</span>
        <button class="checklist-item-delete" data-idx="${i}">✕</button>
      </div>
    `).join('');

    // Bind events
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        checklistItems[parseInt(cb.dataset.idx)].checked = cb.checked;
        saveChecklist();
      });
    });
    container.querySelectorAll('.checklist-item-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        checklistItems.splice(parseInt(btn.dataset.idx), 1);
        saveChecklist();
      });
    });

    updateChecklistBadge();
  }

  function addChecklistItem(text) {
    if (!text.trim()) return;
    checklistItems.push({ text: text.trim(), checked: false });
    saveChecklist();
    document.getElementById('checklist-new').value = '';
  }

  function saveChecklist() {
    currentTrip.checklist = JSON.stringify(checklistItems);
    renderChecklist();
    scheduleSave();
  }

  function updateChecklistBadge() {
    const badge = document.getElementById('checklist-badge');
    if (checklistItems.length === 0) {
      badge.textContent = '';
    } else {
      const done = checklistItems.filter((i) => i.checked).length;
      badge.textContent = t('trip.checklistCount', { done, total: checklistItems.length });
    }
  }

  // ── Memo toggle ──
  function toggleMemo() {
    const section = document.getElementById('memo-section');
    section.classList.toggle('open');
    if (section.classList.contains('open')) {
      document.getElementById('trip-memo').focus();
    }
  }

  function updateMemoBadge() {
    const memo = document.getElementById('trip-memo').value.trim();
    const badge = document.getElementById('memo-badge');
    badge.textContent = memo ? t('trip.memoHasContent') : '';
  }

  // ── Duration ──
  function updateDuration() {
    const start = document.getElementById('trip-start-date').value;
    const end = document.getElementById('trip-end-date').value;
    const el = document.getElementById('trip-duration');

    if (start && end) {
      const days = Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
      if (days > 0) {
        el.textContent = t(days > 1 ? 'trip.duration' : 'trip.durationSingular', { n: days });
        el.style.display = '';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  // ── Day tabs ──
  function renderDayTabs() {
    const container = document.getElementById('day-tabs');
    const start = document.getElementById('trip-start-date').value;
    const end = document.getElementById('trip-end-date').value;

    let totalDays = 0;
    if (start && end) {
      totalDays = Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
    }

    if (totalDays <= 0) {
      // No dates set — show single "All Events" tab
      container.innerHTML = `<button class="day-tab active" data-day="1">${t('trip.allEvents')}</button>`;
      currentDay = 1;
      container.querySelector('.day-tab').addEventListener('click', () => {
        currentDay = 1;
        renderEvents();
      });
      return;
    }

    let html = '';
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + d - 1);
      const label = date.toLocaleDateString(window.i18n.getDateLocale(), { month: 'short', day: 'numeric' });
      const eventCount = currentEvents.filter((e) => e.day_number === d).length;
      html += `<button class="day-tab ${d === currentDay ? 'active' : ''}" data-day="${d}">
        <span class="day-tab-label">${t('trip.dayLabel', { n: d })}</span>
        <span class="day-tab-date">${label}</span>
        ${eventCount > 0 ? `<span class="day-tab-badge">${eventCount}</span>` : ''}
      </button>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.day-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        currentDay = parseInt(tab.dataset.day);
        container.querySelectorAll('.day-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        window.history.replaceState(null, '', '#day' + currentDay);
        renderEvents();
      });
    });
  }

  // ── Render events ──
  function renderEvents() {
    const list = document.getElementById('events-list');
    const empty = document.getElementById('events-empty');
    const dayEvents = sortDayEvents(
      currentEvents.filter((e) => e.day_number === currentDay)
    );

    if (dayEvents.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    // Detect overlapping time ranges
    const overlappingIds = new Set();
    const timedEvents = dayEvents.filter((ev) => ev.start_time);
    for (let i = 0; i < timedEvents.length; i++) {
      for (let j = i + 1; j < timedEvents.length; j++) {
        const a = timedEvents[i];
        const b = timedEvents[j];
        const aStart = a.start_time;
        const aEnd = a.end_time || a.start_time;
        const bStart = b.start_time;
        const bEnd = b.end_time || b.start_time;
        if (aStart < bEnd && bStart < aEnd) {
          overlappingIds.add(a.id);
          overlappingIds.add(b.id);
        }
      }
    }

    empty.style.display = 'none';
    list.innerHTML = dayEvents
      .map(
        (ev) => `
      <div class="event-card${overlappingIds.has(ev.id) ? ' event-card-warn' : ''}${!ev.start_time ? ' event-card-draggable' : ''}" data-id="${ev.id}" ${!ev.start_time ? 'draggable="true"' : ''}>
        ${overlappingIds.has(ev.id) ? `<div class="event-warn-badge" title="${t('event.duplicateTimeWarn')}">⚠️</div>` : ''}
        ${!ev.start_time ? '<div class="drag-handle" title="Drag to reorder">⠿</div>' : ''}
        <div class="event-card-left">
          ${ev.start_time ? `<div class="event-time-col">
            <span class="event-time">${formatTime(ev.start_time)}</span>
            ${ev.end_time ? `<span class="event-time">— ${formatTime(ev.end_time)}</span>` : ''}
          </div>` : ''}
          <div class="event-dot-line">
            <span class="event-dot"></span>
            <span class="event-line"></span>
          </div>
          <div class="event-info">
            <div class="event-title-row">
              <span class="event-title">${escapeHtml(ev.title)}</span>
            </div>
            ${ev.location ? `<div class="event-location">📍 ${escapeHtml(ev.location)}</div>` : ''}
            ${ev.description ? `<div class="event-desc">${escapeHtml(ev.description)}</div>` : ''}
          </div>
        </div>
        <div class="event-card-actions">
          <button class="event-action-btn" data-action="edit" data-id="${ev.id}" title="Edit">✏️</button>
          <button class="event-action-btn" data-action="delete" data-id="${ev.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `
      )
      .join('');

    // Bind event actions
    list.querySelectorAll('.event-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (btn.dataset.action === 'edit') openEditEvent(id);
        else if (btn.dataset.action === 'delete') deleteEvent(id);
      });
    });

    // Drag-and-drop for untimed events
    initDragReorder(list);
  }

  // ── Event sort: sort_order primary, timed runs sub-sorted by time ──
  function sortDayEvents(events) {
    // First pass: sort by sort_order
    const sorted = [...events].sort((a, b) => a.sort_order - b.sort_order);
    // Second pass: within consecutive timed events, sort by start_time
    const result = [];
    let timedRun = [];
    for (const ev of sorted) {
      if (ev.start_time) {
        timedRun.push(ev);
      } else {
        if (timedRun.length > 0) {
          timedRun.sort((a, b) => a.start_time.localeCompare(b.start_time));
          result.push(...timedRun);
          timedRun = [];
        }
        result.push(ev);
      }
    }
    if (timedRun.length > 0) {
      timedRun.sort((a, b) => a.start_time.localeCompare(b.start_time));
      result.push(...timedRun);
    }
    return result;
  }

  // ── Drag-and-drop reordering ──
  let dragSrcEl = null;
  let dragContainerBound = false;
  let dragOrderChanged = false;

  function liveReorder(list, clientY) {
    if (!dragSrcEl) return;
    const cards = [...list.querySelectorAll('.event-card:not(.dragging)')];
    let inserted = false;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        if (card !== dragSrcEl.nextElementSibling) {
          list.insertBefore(dragSrcEl, card);
          dragOrderChanged = true;
        }
        inserted = true;
        break;
      }
    }
    if (!inserted && list.lastElementChild !== dragSrcEl) {
      list.appendChild(dragSrcEl);
      dragOrderChanged = true;
    }
  }

  function initDragReorder(list) {
    const draggables = list.querySelectorAll('.event-card-draggable');

    draggables.forEach((card) => {
      const handle = card.querySelector('.drag-handle');
      if (!handle) return;

      // ── Desktop: HTML5 drag ──
      card.draggable = false;
      handle.addEventListener('mousedown', () => { card.draggable = true; });
      card.addEventListener('dragstart', (e) => {
        dragSrcEl = card;
        dragOrderChanged = false;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.draggable = false;
        if (dragOrderChanged) saveDragOrder(list);
        dragSrcEl = null;
        dragOrderChanged = false;
      });

      // ── Touch: manual drag ──
      handle.addEventListener('touchstart', (e) => {
        dragSrcEl = card;
        dragOrderChanged = false;
        card.classList.add('dragging');
        e.preventDefault();
      }, { passive: false });
    });

    // Bind container listeners once
    if (dragContainerBound) return;
    dragContainerBound = true;
    const container = document.getElementById('events-container');

    // Desktop dragover
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      liveReorder(list, e.clientY);
    });
    container.addEventListener('drop', (e) => { e.preventDefault(); });

    // Touch move/end (bound on document so finger can move outside container)
    document.addEventListener('touchmove', (e) => {
      if (!dragSrcEl) return;
      e.preventDefault();
      const touch = e.touches[0];
      liveReorder(list, touch.clientY);
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!dragSrcEl) return;
      dragSrcEl.classList.remove('dragging');
      if (dragOrderChanged) saveDragOrder(list);
      dragSrcEl = null;
      dragOrderChanged = false;
    });
  }

  async function saveDragOrder(list) {
    // Read new order from DOM, assign sequential sort_orders
    const cards = list.querySelectorAll('.event-card');
    const eventIds = [];
    cards.forEach((card, i) => {
      const id = parseInt(card.dataset.id);
      const ev = currentEvents.find((e) => e.id === id);
      if (!ev) return;
      ev.sort_order = i + 1;
      eventIds.push(id);
    });

    // Save via batch reorder endpoint
    try {
      await api('PUT', `/api/trips/${currentTrip.token}/events/reorder`, {
        event_ids: eventIds,
      });
    } catch (e) {
      console.error('Failed to save reorder:', e);
    }
    renderEvents();
  }

  // ── Time/Date validation ──
  function validateEventTimes() {
    const startEl = document.getElementById('event-start-time');
    const endEl = document.getElementById('event-end-time');
    const errorEl = document.getElementById('time-error');

    // Check incomplete: browser sets validity.badInput when time is partially filled
    if (startEl.validity.badInput || endEl.validity.badInput) {
      errorEl.textContent = t('toast.timeIncomplete');
      startEl.classList.toggle('input-error', startEl.validity.badInput);
      endEl.classList.toggle('input-error', endEl.validity.badInput);
      return false;
    }

    // Check end before start
    if (startEl.value && endEl.value && endEl.value <= startEl.value) {
      errorEl.textContent = t('toast.endBeforeStart');
      endEl.classList.add('input-error');
      startEl.classList.remove('input-error');
      return false;
    }

    errorEl.textContent = '';
    startEl.classList.remove('input-error');
    endEl.classList.remove('input-error');
    return true;
  }

  function validateTripDates() {
    const startEl = document.getElementById('trip-start-date');
    const endEl = document.getElementById('trip-end-date');
    const errorEl = document.getElementById('date-error');
    const startVal = startEl.value;
    const endVal = endEl.value;

    if (startVal && endVal && endVal < startVal) {
      errorEl.textContent = t('toast.dateEndBeforeStart');
      endEl.classList.add('input-error');
      return false;
    }

    errorEl.textContent = '';
    endEl.classList.remove('input-error');
    return true;
  }

  // ── Event modal ──
  function openAddEvent() {
    editingEventId = null;
    document.getElementById('modal-title').textContent = t('event.addTitle');
    document.getElementById('event-title').value = '';
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    document.getElementById('time-error').textContent = '';
    document.getElementById('event-start-time').classList.remove('input-error');
    document.getElementById('event-end-time').classList.remove('input-error');
    document.getElementById('event-location').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('event-modal').style.display = '';
    document.getElementById('event-title').focus();
  }

  function openEditEvent(id) {
    const ev = currentEvents.find((e) => e.id === id);
    if (!ev) return;

    editingEventId = id;
    document.getElementById('modal-title').textContent = t('event.editTitle');
    document.getElementById('event-title').value = ev.title;
    document.getElementById('event-start-time').value = ev.start_time || '';
    document.getElementById('event-end-time').value = ev.end_time || '';
    document.getElementById('time-error').textContent = '';
    document.getElementById('event-start-time').classList.remove('input-error');
    document.getElementById('event-end-time').classList.remove('input-error');
    document.getElementById('event-location').value = ev.location || '';
    document.getElementById('event-description').value = ev.description || '';
    document.getElementById('event-modal').style.display = '';
    document.getElementById('event-title').focus();
  }

  function closeModal() {
    document.getElementById('event-modal').style.display = 'none';
    editingEventId = null;
  }

  async function saveEvent() {
    const title = document.getElementById('event-title').value.trim();
    if (!title) {
      showToast(t('toast.titleRequired'), true);
      return;
    }

    if (!validateEventTimes()) return;

    const payload = {
      day_number: currentDay,
      start_time: document.getElementById('event-start-time').value,
      end_time: document.getElementById('event-end-time').value,
      title: title,
      description: document.getElementById('event-description').value.trim(),
      location: document.getElementById('event-location').value.trim(),
    };

    try {
      if (editingEventId) {
        await api('PUT', `/api/trips/${currentTrip.token}/events/${editingEventId}`, payload);
        const idx = currentEvents.findIndex((e) => e.id === editingEventId);
        if (idx >= 0) {
          currentEvents[idx] = { ...currentEvents[idx], ...payload };
        }
        showToast(t('toast.eventUpdated'));
      } else {
        const created = await api('POST', `/api/trips/${currentTrip.token}/events`, payload);
        currentEvents.push(created);
        showToast(t('toast.eventAdded'));
      }
      closeModal();
      renderEvents();
      renderDayTabs();
    } catch (e) {
      showToast(t('toast.eventSaveFailed') + e.message, true);
    }
  }

  async function deleteEvent(id) {
    if (!confirm(t('confirm.deleteEvent'))) return;
    try {
      await api('DELETE', `/api/trips/${currentTrip.token}/events/${id}`);
      currentEvents = currentEvents.filter((e) => e.id !== id);
      renderEvents();
      renderDayTabs();
      showToast(t('toast.eventDeleted'));
    } catch (e) {
      showToast(t('toast.eventDeleteFailed'), true);
    }
  }

  // ── History ──
  async function openHistory() {
    document.getElementById('history-modal').style.display = 'flex';
    document.getElementById('history-list').innerHTML = '<div class="history-empty">' + t('historyModal.loading') + '</div>';
    try {
      const data = await api('GET', `/api/trips/${currentTrip.token}/history`);
      renderHistory(data.history || []);
    } catch (e) {
      document.getElementById('history-list').innerHTML = '<div class="history-empty">' + t('historyModal.loadFailed') + '</div>';
    }
  }

  function closeHistory() {
    document.getElementById('history-modal').style.display = 'none';
  }

  function renderHistory(logs) {
    const list = document.getElementById('history-list');
    if (logs.length === 0) {
      list.innerHTML = '<div class="history-empty">' + t('historyModal.empty') + '</div>';
      return;
    }

    list.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleString(window.i18n.getDateLocale(), { dateStyle: 'short', timeStyle: 'short' });
      // Only show Recover button if snapshot exists
      const canRecover = log.snapshot_data && log.snapshot_data.length > 2; // more than "{}"

      const displayAction = t('historyModal.actions.' + log.action) || log.action;

      return `
        <div class="history-item">
          <div class="history-header">
            <span class="history-action">${displayAction}</span>
            <span class="history-time">${time}</span>
          </div>
          <div class="history-detail">${escapeHtml(log.detail)}</div>
          ${canRecover ? `<button class="history-recover-btn" data-id="${log.id}">${t('historyModal.recover')}</button>` : ''}
        </div>
      `;
    }).join('');

    // Attach listeners
    list.querySelectorAll('.history-recover-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!confirm(t('historyModal.confirmRecover'))) return;
        try {
          await api('POST', `/api/trips/${currentTrip.token}/history/${id}/recover`);
          showToast(t('historyModal.recoverSuccess'));
          closeHistory();
          // Reload trip data while preserving the current day tab
          const savedDay = currentDay;
          const data = await api('GET', `/api/trips/${currentTrip.token}`);
          currentTrip = data.trip;
          currentEvents = data.events || [];
          currentDay = savedDay;
          renderTripEditor();
        } catch (err) {
          showToast(t('historyModal.recoverFailed') + err.message, true);
        }
      });
    });
  }

  // ── Share ──
  function shareTrip() {
    if (!currentTrip) return;
    const url = window.location.origin + '/plan/' + currentTrip.token;
    navigator.clipboard.writeText(url).then(() => {
      showToast(t('toast.linkCopied'));
    }).catch(() => {
      prompt(t('share.copyPrompt'), url);
    });
  }

  // ── Delete trip ──
  async function deleteTripConfirm() {
    if (!currentTrip) return;
    if (!confirm(t('confirm.deleteTrip'))) return;
    try {
      await api('DELETE', `/api/trips/${currentTrip.token}`);
      showToast(t('toast.tripDeleted'));
      window.history.pushState({}, '', '/');
      currentTrip = null;
      currentEvents = [];
      route();
    } catch (e) {
      showToast(t('toast.tripDeleteFailed'), true);
    }
  }

  // ── Toast ──
  function showToast(message, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' toast-error' : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }

  // ── Helpers ──
  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    return `${h}:${m}`;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ── Landing page animations ──
  function initLandingAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.feature-card, .hero-content, .hero-visual, .hero-stats .stat').forEach((el) => {
      el.classList.add('animate-target');
      observer.observe(el);
    });

    // Card tilt
    const card = document.querySelector('.trip-card-preview');
    if (card) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -8;
        const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 8;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      });
    }

    // Timeline animation
    document.querySelectorAll('.timeline-item').forEach((item, i) => {
      item.style.animationDelay = `${0.8 + i * 0.15}s`;
      item.classList.add('timeline-animate');
    });
  }

  // ── Navbar scroll effect ──
  function initNavbar() {
    window.addEventListener('scroll', () => {
      document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  // ── Language switcher ──
  function initLangPicker() {
    const btn = document.getElementById('lang-picker-btn');
    const menu = document.getElementById('lang-picker-menu');

    function renderMenu() {
      const locales = window.i18n.getAvailableLocales();
      btn.textContent = locales.find(l => l.code === window.i18n.locale)?.label || 'EN';
      menu.innerHTML = locales.map(function (l) {
        return '<button class="lang-picker-option' + (l.code === window.i18n.locale ? ' active' : '') + '" data-lang="' + l.code + '">' + l.label + '</button>';
      }).join('');
    }

    renderMenu();

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('open');
    });

    menu.addEventListener('click', function (e) {
      const opt = e.target.closest('.lang-picker-option');
      if (!opt) return;
      menu.classList.remove('open');
      window.i18n.setLocale(opt.dataset.lang);
      renderMenu();
      if (currentTrip) {
        renderTripEditor();
      }
      const path = window.location.pathname;
      if (!path.startsWith('/plan/')) {
        const navActions = document.getElementById('nav-actions');
        navActions.innerHTML = `
          <button class="btn btn-primary btn-sm" id="nav-new-trip">${t('nav.newTrip')}</button>
        `;
        document.getElementById('nav-new-trip').addEventListener('click', createNewTrip);
      }
    });

    // Close on outside click
    document.addEventListener('click', function () {
      menu.classList.remove('open');
    });
  }

  // ── Initialize ──
  function init() {
    // Apply i18n to static DOM
    window.i18n.applyI18n();

    initNavbar();
    initLangPicker();

    // Landing page buttons
    document.getElementById('hero-cta').addEventListener('click', createNewTrip);
    document.getElementById('hero-demo').addEventListener('click', () => {
      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });

    // Trip editor inputs — auto save
    ['trip-name', 'trip-destination', 'trip-start-date', 'trip-end-date', 'trip-memo'].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('change', scheduleSave);
    });

    // Memo: also save on input (debounced) and update badge
    document.getElementById('trip-memo').addEventListener('input', () => {
      updateMemoBadge();
      scheduleSave();
    });
    document.getElementById('memo-toggle').addEventListener('click', toggleMemo);

    // Checklist
    document.getElementById('checklist-toggle').addEventListener('click', toggleChecklist);
    document.getElementById('checklist-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addChecklistItem(e.target.value);
      }
    });

    // Live date validation
    ['trip-start-date', 'trip-end-date'].forEach((id) => {
      document.getElementById(id).addEventListener('change', validateTripDates);
    });

    // Live time validation
    ['event-start-time', 'event-end-time'].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('input', validateEventTimes);
      el.addEventListener('change', validateEventTimes);
    });

    // Trip buttons
    document.getElementById('btn-share-trip').addEventListener('click', shareTrip);
    document.getElementById('btn-delete-trip').addEventListener('click', deleteTripConfirm);
    document.getElementById('btn-add-event').addEventListener('click', openAddEvent);

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveEvent);
    document.getElementById('event-modal').addEventListener('click', (e) => {
      if (e.target.id === 'event-modal') closeModal();
    });

    // History
    document.getElementById('btn-history-trip').addEventListener('click', openHistory);
    document.getElementById('history-modal-close').addEventListener('click', closeHistory);
    document.getElementById('history-modal').addEventListener('click', (e) => {
      if (e.target.id === 'history-modal') closeHistory();
    });

    // Keyboard shortcut: Escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && document.getElementById('event-modal').style.display !== 'none') {
        const focused = document.activeElement;
        if (focused.tagName !== 'TEXTAREA' && focused.type !== 'time') saveEvent();
      }
    });

    // Browser back/forward
    window.addEventListener('popstate', route);

    // Initial route
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
