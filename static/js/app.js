/**
 * TripFlow — Main Application JavaScript
 * SPA router, trip editor, event management
 */
(function () {
  'use strict';

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
        <button class="btn btn-primary btn-sm" id="nav-new-trip">+ New Trip</button>
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
      currentDay = 1;
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
      showToast('Trip created! Share the link with your family 🎉');
    } catch (e) {
      showToast('Failed to create trip', true);
    }
  }

  // ── Render trip editor ──
  function renderTripEditor() {
    if (!currentTrip) return;

    document.getElementById('trip-name').value = currentTrip.name || '';
    document.getElementById('trip-destination').value = currentTrip.destination || '';
    document.getElementById('trip-start-date').value = currentTrip.start_date || '';
    document.getElementById('trip-end-date').value = currentTrip.end_date || '';

    updateDuration();
    renderDayTabs();
    renderEvents();
  }

  // ── Auto-save trip metadata ──
  function scheduleSave() {
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
      });
      currentTrip = updated;
      updateDuration();
      renderDayTabs();
    } catch (e) {
      console.error('Failed to save trip:', e);
    }
  }

  // ── Duration ──
  function updateDuration() {
    const start = document.getElementById('trip-start-date').value;
    const end = document.getElementById('trip-end-date').value;
    const el = document.getElementById('trip-duration');

    if (start && end) {
      const days = Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
      if (days > 0) {
        el.textContent = `${days} day${days > 1 ? 's' : ''}`;
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
      container.innerHTML = `<button class="day-tab active" data-day="1">All Events</button>`;
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
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eventCount = currentEvents.filter((e) => e.day_number === d).length;
      html += `<button class="day-tab ${d === currentDay ? 'active' : ''}" data-day="${d}">
        <span class="day-tab-label">Day ${d}</span>
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
        renderEvents();
      });
    });
  }

  // ── Render events ──
  function renderEvents() {
    const list = document.getElementById('events-list');
    const empty = document.getElementById('events-empty');
    const dayEvents = currentEvents
      .filter((e) => e.day_number === currentDay)
      .sort((a, b) => a.sort_order - b.sort_order || (a.start_time || '').localeCompare(b.start_time || ''));

    if (dayEvents.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = dayEvents
      .map(
        (ev) => `
      <div class="event-card" data-id="${ev.id}">
        <div class="event-card-left">
          <div class="event-time-col">
            ${ev.start_time ? `<span class="event-time">${formatTime(ev.start_time)}</span>` : '<span class="event-time event-time-empty">--:--</span>'}
            ${ev.end_time ? `<span class="event-time-end">— ${formatTime(ev.end_time)}</span>` : ''}
          </div>
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
  }

  // ── Event modal ──
  function openAddEvent() {
    editingEventId = null;
    document.getElementById('modal-title').textContent = 'Add Event';
    document.getElementById('event-title').value = '';
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('event-modal').style.display = '';
    document.getElementById('event-title').focus();
  }

  function openEditEvent(id) {
    const ev = currentEvents.find((e) => e.id === id);
    if (!ev) return;

    editingEventId = id;
    document.getElementById('modal-title').textContent = 'Edit Event';
    document.getElementById('event-title').value = ev.title;
    document.getElementById('event-start-time').value = ev.start_time || '';
    document.getElementById('event-end-time').value = ev.end_time || '';
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
      showToast('Please enter an event title', true);
      return;
    }

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
        showToast('Event updated ✏️');
      } else {
        const created = await api('POST', `/api/trips/${currentTrip.token}/events`, payload);
        currentEvents.push(created);
        showToast('Event added 🎉');
      }
      closeModal();
      renderEvents();
      renderDayTabs();
    } catch (e) {
      showToast('Failed to save event: ' + e.message, true);
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
      await api('DELETE', `/api/trips/${currentTrip.token}/events/${id}`);
      currentEvents = currentEvents.filter((e) => e.id !== id);
      renderEvents();
      renderDayTabs();
      showToast('Event deleted');
    } catch (e) {
      showToast('Failed to delete event', true);
    }
  }

  // ── History ──
  async function openHistory() {
    document.getElementById('history-modal').style.display = 'flex';
    document.getElementById('history-list').innerHTML = '<div class="history-empty">Loading history...</div>';
    try {
      const data = await api('GET', `/api/trips/${currentTrip.token}/history`);
      renderHistory(data.history || []);
    } catch (e) {
      document.getElementById('history-list').innerHTML = '<div class="history-empty">Failed to load history</div>';
    }
  }

  function closeHistory() {
    document.getElementById('history-modal').style.display = 'none';
  }

  function renderHistory(logs) {
    const list = document.getElementById('history-list');
    if (logs.length === 0) {
      list.innerHTML = '<div class="history-empty">No edit history yet.</div>';
      return;
    }

    list.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      // Only show Recover button if snapshot exists
      const canRecover = log.snapshot_data && log.snapshot_data.length > 2; // more than "{}"
      
      const actionMap = {
        'create_trip': 'Start Trip',
        'update_trip': 'Edit Trip',
        'add_event': 'Add Event',
        'update_event': 'Edit Event',
        'delete_event': 'Delete Event',
        'recover': 'Recover'
      };
      const displayAction = actionMap[log.action] || log.action;

      return `
        <div class="history-item">
          <div class="history-header">
            <span class="history-action">${displayAction}</span>
            <span class="history-time">${time}</span>
          </div>
          <div class="history-detail">${escapeHtml(log.detail)}</div>
          ${canRecover ? `<button class="history-recover-btn" data-id="${log.id}">↩ Undo / Recover</button>` : ''}
        </div>
      `;
    }).join('');

    // Attach listeners
    list.querySelectorAll('.history-recover-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!confirm('Are you sure you want to revert to this previous state? This will overwrite the current data.')) return;
        try {
          await api('POST', `/api/trips/${currentTrip.token}/history/${id}/recover`);
          showToast('Successfully recovered previous data!');
          closeHistory();
          // Reload trip data while preserving the current day tab
          const savedDay = currentDay;
          const data = await api('GET', `/api/trips/${currentTrip.token}`);
          currentTrip = data.trip;
          currentEvents = data.events || [];
          currentDay = savedDay;
          renderTripEditor();
        } catch (err) {
          showToast('Failed to recover: ' + err.message, true);
        }
      });
    });
  }

  // ── Toast ──
  function shareTrip() {
    if (!currentTrip) return;
    const url = window.location.origin + '/plan/' + currentTrip.token;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard! 🔗');
    }).catch(() => {
      // Fallback
      prompt('Copy this link to share:', url);
    });
  }

  // ── Delete trip ──
  async function deleteTripConfirm() {
    if (!currentTrip) return;
    if (!confirm('Delete this entire trip? This cannot be undone.')) return;
    try {
      await api('DELETE', `/api/trips/${currentTrip.token}`);
      showToast('Trip deleted');
      window.history.pushState({}, '', '/');
      currentTrip = null;
      currentEvents = [];
      route();
    } catch (e) {
      showToast('Failed to delete trip', true);
    }
  }

  // ── Modals ──
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

  // ── Initialize ──
  function init() {
    initNavbar();

    // Landing page buttons
    document.getElementById('hero-cta').addEventListener('click', createNewTrip);
    document.getElementById('hero-demo').addEventListener('click', () => {
      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });

    // Trip editor inputs — auto save
    ['trip-name', 'trip-destination', 'trip-start-date', 'trip-end-date'].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('change', scheduleSave); // trigger only on blur to avoid history spam
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
        if (focused.tagName !== 'TEXTAREA') saveEvent();
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
