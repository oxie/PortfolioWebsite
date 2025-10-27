const tabContent = document.getElementById('tab-content');
const tabs = document.querySelectorAll('.nav-tabs__button');

const ENTRY_STATUSES = ['draft', 'in-review', 'scheduled', 'published'];
const MESSAGE_STATUSES = ['new', 'in-review', 'replied', 'archived'];

const state = {
  profile: {
    headline: '',
    intent: '',
    focusAreas: [],
    bio: '',
    links: [],
    cvHighlights: [],
    location: '',
    availability: '',
    avatar: '',
    skills: []
  },
  categories: [],
  entries: [],
  homepage: { hero: { title: '', cta: '' }, featured: [], highlights: [] },
  messages: []
};

const categoryFormState = { editingId: null };
const entryFormState = { editingId: null };
let homepageDraft = null;
let currentTab = 'profile';

const toast = document.createElement('div');
toast.id = 'dashboard-toast';
toast.className = 'toast';
document.body.appendChild(toast);
let toastTimeout;

function showToast(message, variant = 'success') {
  toast.textContent = message;
  toast.dataset.variant = variant;
  toast.classList.add('toast--visible');
  clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.removeAttribute('data-variant');
  }, 4200);
}

async function api(path, { method = 'GET', body, headers } = {}) {
  const options = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    if (typeof body === 'string') {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }
  }
  const response = await fetch(path, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchProfile() {
  state.profile = await api('/api/profile');
}

async function fetchCategories() {
  state.categories = await api('/api/categories');
}

async function fetchEntries() {
  state.entries = await api('/api/entries');
}

async function fetchHomepage() {
  state.homepage = await api('/api/homepage');
  homepageDraft = JSON.parse(JSON.stringify(state.homepage));
}

async function fetchMessages() {
  state.messages = await api('/api/messages');
}

async function loadAll() {
  tabContent.innerHTML = '<p class="loading">Loading workspace...</p>';
  try {
    await Promise.all([fetchProfile(), fetchCategories(), fetchEntries(), fetchHomepage(), fetchMessages()]);
    renderCurrentTab();
  } catch (error) {
    console.error(error);
    tabContent.innerHTML = '<p class="form-status" data-variant="error">Unable to load the admin data. Refresh to try again.</p>';
  }
}

function listToInput(value, separator = ', ') {
  return Array.isArray(value) ? value.join(separator) : value || '';
}

function listToTextarea(value) {
  return Array.isArray(value) ? value.join('\n') : value || '';
}

function renderProfile() {
  const profile = state.profile || {};

  tabContent.innerHTML = `
    <form id="profile-form" class="panel-card panel-card--form panel-card--stack" novalidate>
      <h2>Personal profile</h2>
      <div class="form-grid form-grid--split">
        <div class="form-field">
          <label for="profile-headline">Headline</label>
          <input id="profile-headline" name="headline" type="text" value="${escapeHtml(profile.headline || '')}" required />
        </div>
        <div class="form-field">
          <label for="profile-intent">Intent</label>
          <input id="profile-intent" name="intent" type="text" value="${escapeHtml(profile.intent || '')}" />
        </div>
      </div>
      <div class="form-grid form-grid--split">
        <div class="form-field">
          <label for="profile-location">Location</label>
          <input id="profile-location" name="location" type="text" value="${escapeHtml(profile.location || '')}" />
        </div>
        <div class="form-field">
          <label for="profile-availability">Availability</label>
          <input id="profile-availability" name="availability" type="text" value="${escapeHtml(profile.availability || '')}" />
        </div>
      </div>
      <div class="form-field">
        <label for="profile-bio">Bio</label>
        <textarea id="profile-bio" name="bio" rows="4">${escapeHtml(profile.bio || '')}</textarea>
      </div>
      <div class="form-grid form-grid--split">
        <div class="form-field">
          <label for="profile-focus">Focus areas (comma separated)</label>
          <input id="profile-focus" name="focusAreas" type="text" value="${escapeHtml(listToInput(profile.focusAreas))}" />
        </div>
        <div class="form-field">
          <label for="profile-skills">Skills (comma separated)</label>
          <input id="profile-skills" name="skills" type="text" value="${escapeHtml(listToInput(profile.skills))}" />
        </div>
      </div>
      <div class="form-field">
        <label for="profile-links">Links (one per line)</label>
        <textarea id="profile-links" name="links" rows="3">${escapeHtml(listToTextarea(profile.links))}</textarea>
      </div>
      <div class="form-field">
        <label for="profile-highlights">CV highlights (one per line)</label>
        <textarea id="profile-highlights" name="cvHighlights" rows="3">${escapeHtml(listToTextarea(profile.cvHighlights))}</textarea>
      </div>
      <div class="form-field">
        <label for="profile-avatar">Avatar image URL</label>
        <input id="profile-avatar" name="avatar" type="url" value="${escapeHtml(profile.avatar || '')}" />
      </div>
      <div class="form-actions">
        <button type="submit" class="button">Save profile</button>
        <a href="/site.html" class="button button--ghost" target="_blank" rel="noopener">Open public site</a>
      </div>
      <p id="profile-status" class="form-status" aria-live="polite"></p>
    </form>
  `;

  const form = document.getElementById('profile-form');
  const status = document.getElementById('profile-status');

  function setStatus(message, variant = '') {
    if (!status) return;
    status.textContent = message;
    if (variant) {
      status.dataset.variant = variant;
    } else {
      delete status.dataset.variant;
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const payload = {
      headline: formData.get('headline')?.toString().trim(),
      intent: formData.get('intent')?.toString().trim(),
      location: formData.get('location')?.toString().trim(),
      availability: formData.get('availability')?.toString().trim(),
      bio: formData.get('bio')?.toString().trim(),
      focusAreas: formData.get('focusAreas')?.toString() || '',
      skills: formData.get('skills')?.toString() || '',
      links: formData.get('links')?.toString() || '',
      cvHighlights: formData.get('cvHighlights')?.toString() || '',
      avatar: formData.get('avatar')?.toString().trim()
    };

    setStatus('Saving profile...', 'info');

    try {
      await api('/api/profile', { method: 'PUT', body: payload });
      await fetchProfile();
      setStatus('Profile updated successfully.', 'success');
      showToast('Profile saved', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Unable to save the profile. Please try again.', 'error');
      showToast('Profile save failed', 'error');
    }
  });
}

function escapeHtml(value) {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
}

function statusOptions(statuses, selected) {
  return statuses
    .map((status) => `<option value="${status}" ${selected === status ? 'selected' : ''}>${status}</option>`)
    .join('');
}

function entrySelectOptions(selectedId) {
  return [
    '<option value="">Select entry</option>',
    ...state.entries.map(
      (entry) => `<option value="${entry.id}" ${selectedId === entry.id ? 'selected' : ''}>${escapeHtml(entry.title)}</option>`
    )
  ].join('');
}

function renderCategories() {
  const editing = categoryFormState.editingId
    ? state.categories.find((category) => category.id === categoryFormState.editingId)
    : null;

  tabContent.innerHTML = `
    <div class="manager-grid">
      <section>
        <h2 class="section-title">Active categories</h2>
        <div class="cards-row cards-row--wrap">
          ${state.categories
            .map(
              (category) => `
                <article class="stat-card" data-id="${category.id}">
                  <strong>${escapeHtml(category.name)}</strong>
                  <p>${category.items} items</p>
                  <p class="muted">${category.description ? escapeHtml(category.description) : 'Add a short description'}</p>
                  <p>${category.featured ? 'Featured on homepage' : 'Shown in navigation only'}</p>
                  <div class="stat-card__actions">
                    <button class="button button--ghost" data-action="edit" type="button">Edit</button>
                    <button class="button button--ghost button--danger" data-action="delete" type="button">Delete</button>
                  </div>
                </article>
              `
            )
            .join('') || '<p class="muted">No categories yet.</p>'}
        </div>
      </section>
      <form id="category-form" class="panel-card panel-card--form" novalidate>
        <h2>${editing ? 'Update category' : 'Create category'}</h2>
        <div class="form-field">
          <label for="category-name">Name</label>
          <input id="category-name" name="name" type="text" value="${editing ? escapeHtml(editing.name) : ''}" required />
        </div>
        <div class="form-field">
          <label for="category-description">Description</label>
          <textarea id="category-description" name="description" rows="2">${editing ? escapeHtml(editing.description || '') : ''}</textarea>
        </div>
        <div class="form-field form-field--inline">
          <label class="form-checkbox">
            <input type="checkbox" name="featured" ${editing?.featured ? 'checked' : ''} />
            <span>Feature on homepage</span>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="button">${editing ? 'Save changes' : 'Add category'}</button>
          ${editing ? '<button type="button" id="cancel-category" class="button button--ghost">Cancel</button>' : ''}
        </div>
      </form>
    </div>
  `;

  const list = tabContent.querySelector('.cards-row');
  const form = document.getElementById('category-form');

  list?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('[data-id]');
    if (!card) return;
    const { id } = card.dataset;
    if (!id) return;

    if (button.dataset.action === 'edit') {
      categoryFormState.editingId = id;
      renderCategories();
      return;
    }

    if (button.dataset.action === 'delete') {
      if (!window.confirm('Delete this category? Entries will become uncategorised.')) return;
      try {
        await api(`/api/categories/${id}`, { method: 'DELETE' });
        showToast('Category removed', 'success');
        categoryFormState.editingId = null;
        await Promise.all([fetchCategories(), fetchEntries(), fetchHomepage()]);
        renderCategories();
      } catch (error) {
        console.error(error);
        showToast('Unable to delete category.', 'error');
      }
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name')?.toString().trim(),
      description: formData.get('description')?.toString().trim() || '',
      featured: formData.get('featured') === 'on'
    };
    try {
      if (categoryFormState.editingId) {
        await api(`/api/categories/${categoryFormState.editingId}`, { method: 'PUT', body: payload });
        showToast('Category updated', 'success');
      } else {
        await api('/api/categories', { method: 'POST', body: payload });
        showToast('Category created', 'success');
      }
      categoryFormState.editingId = null;
      form.reset();
      await Promise.all([fetchCategories(), fetchEntries(), fetchHomepage()]);
      renderCategories();
    } catch (error) {
      console.error(error);
      showToast('Unable to save category.', 'error');
    }
  });

  const cancel = document.getElementById('cancel-category');
  cancel?.addEventListener('click', () => {
    categoryFormState.editingId = null;
    renderCategories();
  });
}

function renderEntries() {
  const editing = entryFormState.editingId
    ? state.entries.find((entry) => entry.id === entryFormState.editingId)
    : null;

  const categoryOptions = ['<option value="">Select category</option>',
    ...state.categories.map((category) => `<option value="${category.id}" ${editing?.categoryId === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`)
  ].join('');

  tabContent.innerHTML = `
    <div class="manager-grid manager-grid--vertical">
      <section>
        <h2 class="section-title">Content entries</h2>
        <table class="table table--interactive">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.entries
              .map(
                (entry) => `
                  <tr data-id="${entry.id}">
                    <td>${escapeHtml(entry.title)}</td>
                    <td>${escapeHtml(entry.categoryName || 'Uncategorised')}</td>
                    <td><span class="status-pill" data-status="${entry.status}">${entry.status}</span></td>
                    <td>${formatDisplayDate(entry.updatedAt)}</td>
                    <td class="table-actions">
                      <button class="button button--ghost" data-action="edit" type="button">Edit</button>
                      <button class="button button--ghost button--danger" data-action="delete" type="button">Delete</button>
                    </td>
                  </tr>
                `
              )
              .join('') || '<tr><td colspan="5" class="muted">No entries created yet.</td></tr>'}
          </tbody>
        </table>
      </section>
      <form id="entry-form" class="panel-card panel-card--form" novalidate>
        <h2>${editing ? 'Update entry' : 'Create entry'}</h2>
        <div class="form-field">
          <label for="entry-title">Title</label>
          <input id="entry-title" name="title" type="text" value="${editing ? escapeHtml(editing.title) : ''}" required />
        </div>
        <div class="form-field">
          <label for="entry-summary">Summary</label>
          <textarea id="entry-summary" name="summary" rows="3" placeholder="Short description shown on the public site">${
            editing ? escapeHtml(editing.summary || '') : ''
          }</textarea>
        </div>
        <div class="form-grid form-grid--split">
          <div class="form-field">
            <label for="entry-category">Category</label>
            <select id="entry-category" name="categoryId">${categoryOptions}</select>
          </div>
          <div class="form-field">
            <label for="entry-status">Status</label>
            <select id="entry-status" name="status">${statusOptions(ENTRY_STATUSES, editing?.status || 'draft')}</select>
          </div>
        </div>
        <div class="form-grid form-grid--split">
          <div class="form-field">
            <label for="entry-date">Last updated</label>
            <input id="entry-date" name="updatedAt" type="date" value="${editing?.updatedAt ? escapeHtml(editing.updatedAt) : ''}" />
          </div>
          <div class="form-field form-field--inline">
            <label class="form-checkbox">
              <input type="checkbox" name="featured" ${editing?.featured ? 'checked' : ''} />
              <span>Featured on homepage</span>
            </label>
          </div>
        </div>
        <div class="form-grid form-grid--split">
          <div class="form-field">
            <label for="entry-link">Primary link</label>
            <input id="entry-link" name="link" type="url" value="${editing ? escapeHtml(editing.link || '') : ''}" placeholder="https://" />
          </div>
          <div class="form-field">
            <label for="entry-media">Cover image URL</label>
            <input id="entry-media" name="media" type="url" value="${editing ? escapeHtml(editing.media || '') : ''}" placeholder="https://" />
          </div>
        </div>
        <div class="form-grid form-grid--split">
          <div class="form-field">
            <label for="entry-tags">Tags (comma separated)</label>
            <input id="entry-tags" name="tags" type="text" value="${editing ? escapeHtml((editing.tags || []).join(', ')) : ''}" placeholder="AI, Robotics" />
          </div>
          <div class="form-field">
            <label for="entry-body">Details</label>
            <textarea id="entry-body" name="body" rows="3" placeholder="Extended description used on detail pages">${
              editing ? escapeHtml(editing.body || '') : ''
            }</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="button">${editing ? 'Save changes' : 'Add entry'}</button>
          ${editing ? '<button type="button" id="cancel-entry" class="button button--ghost">Cancel</button>' : '<button type="reset" class="button button--ghost">Reset</button>'}
        </div>
      </form>
    </div>
  `;

  const table = tabContent.querySelector('table tbody');
  const form = document.getElementById('entry-form');

  table?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr[data-id]');
    if (!row) return;
    const { id } = row.dataset;
    if (!id) return;

    if (button.dataset.action === 'edit') {
      entryFormState.editingId = id;
      renderEntries();
      return;
    }

    if (button.dataset.action === 'delete') {
      if (!window.confirm('Delete this entry?')) return;
      try {
        await api(`/api/entries/${id}`, { method: 'DELETE' });
        showToast('Entry deleted', 'success');
        entryFormState.editingId = null;
        await Promise.all([fetchEntries(), fetchHomepage(), fetchCategories()]);
        renderEntries();
      } catch (error) {
        console.error(error);
        showToast('Unable to delete entry.', 'error');
      }
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    const payload = {
      title: formData.get('title')?.toString().trim(),
      categoryId: formData.get('categoryId')?.toString() || null,
      status: formData.get('status')?.toString() || 'draft',
      updatedAt: formData.get('updatedAt')?.toString() || undefined,
      featured: formData.get('featured') === 'on',
      summary: formData.get('summary')?.toString().trim() || '',
      link: formData.get('link')?.toString().trim() || '',
      media: formData.get('media')?.toString().trim() || '',
      tags: formData.get('tags')?.toString() || '',
      body: formData.get('body')?.toString().trim() || ''
    };
    try {
      if (entryFormState.editingId) {
        await api(`/api/entries/${entryFormState.editingId}`, { method: 'PUT', body: payload });
        showToast('Entry updated', 'success');
      } else {
        await api('/api/entries', { method: 'POST', body: payload });
        showToast('Entry created', 'success');
      }
      entryFormState.editingId = null;
      form.reset();
      await Promise.all([fetchEntries(), fetchHomepage(), fetchCategories()]);
      renderEntries();
    } catch (error) {
      console.error(error);
      showToast('Unable to save entry.', 'error');
    }
  });

  const cancel = document.getElementById('cancel-entry');
  cancel?.addEventListener('click', () => {
    entryFormState.editingId = null;
    renderEntries();
  });
}

function captureHomepageDraft() {
  const form = document.getElementById('homepage-form');
  if (!form || !homepageDraft) return;
  const heroTitle = form.querySelector('#hero-title')?.value || '';
  const heroCta = form.querySelector('#hero-cta')?.value || '';
  const highlightsValue = form.querySelector('#homepage-highlights')?.value || '';
  const featuredRows = Array.from(form.querySelectorAll('.featured-row'));

  homepageDraft.hero = { title: heroTitle, cta: heroCta };
  homepageDraft.highlights = highlightsValue
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  homepageDraft.featured = featuredRows
    .map((row) => {
      const entryId = row.querySelector('select')?.value || '';
      const slot = row.querySelector('input')?.value || '';
      return { entryId, slot };
    })
    .filter((item) => item.entryId);
}

function renderHomepage() {
  if (!homepageDraft) {
    homepageDraft = JSON.parse(JSON.stringify(state.homepage));
  }
  const draft = homepageDraft;

  tabContent.innerHTML = `
    <form id="homepage-form" class="panel-card panel-card--form panel-card--stack" novalidate>
      <h2>Homepage hero</h2>
      <div class="form-field">
        <label for="hero-title">Title</label>
        <input id="hero-title" name="heroTitle" type="text" value="${escapeHtml(draft.hero.title || '')}" required />
      </div>
      <div class="form-field">
        <label for="hero-cta">Primary call to action</label>
        <input id="hero-cta" name="heroCta" type="text" value="${escapeHtml(draft.hero.cta || '')}" />
      </div>
      <h2>Featured queue</h2>
      <div id="featured-list" class="featured-list">
        ${draft.featured
          .map(
            (slot, index) => `
              <div class="featured-row" data-index="${index}">
                <div class="form-field">
                  <label>Entry</label>
                  <select>${entrySelectOptions(slot.entryId)}</select>
                </div>
                <div class="form-field">
                  <label>Layout label</label>
                  <input type="text" value="${escapeHtml(slot.slot || '')}" placeholder="Spotlight layout" />
                </div>
                <button type="button" class="button button--ghost button--danger" data-action="remove">Remove</button>
              </div>
            `
          )
          .join('') || '<p class="muted">No featured items yet. Add one below.</p>'}
      </div>
      <button type="button" class="button button--ghost" id="add-feature">Add featured slot</button>
      <div class="form-field">
        <label for="homepage-highlights">Homepage highlights</label>
        <textarea id="homepage-highlights" rows="4" placeholder="One insight per line">${escapeHtml((draft.highlights || []).join('\n'))}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="button">Save homepage</button>
        <button type="button" class="button button--ghost" id="reset-homepage">Reset</button>
      </div>
    </form>
  `;

  const form = document.getElementById('homepage-form');
  const featuredList = document.getElementById('featured-list');
  const addButton = document.getElementById('add-feature');
  const resetButton = document.getElementById('reset-homepage');

  featuredList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="remove"]');
    if (!button) return;
    captureHomepageDraft();
    const row = button.closest('.featured-row');
    if (!row) return;
    const index = Number.parseInt(row.dataset.index || '', 10);
    if (Number.isNaN(index)) return;
    homepageDraft.featured.splice(index, 1);
    renderHomepage();
  });

  addButton?.addEventListener('click', () => {
    captureHomepageDraft();
    homepageDraft.featured.push({ entryId: state.entries[0]?.id || '', slot: 'New feature' });
    renderHomepage();
  });

  resetButton?.addEventListener('click', () => {
    homepageDraft = JSON.parse(JSON.stringify(state.homepage));
    renderHomepage();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    captureHomepageDraft();
    if (!homepageDraft.hero.title.trim()) {
      showToast('Add a hero title before saving.', 'error');
      return;
    }
    try {
      await api('/api/homepage', {
        method: 'PUT',
        body: {
          hero: homepageDraft.hero,
          featured: homepageDraft.featured,
          highlights: homepageDraft.highlights
        }
      });
      showToast('Homepage updated', 'success');
      await fetchHomepage();
      renderHomepage();
    } catch (error) {
      console.error(error);
      showToast('Unable to save homepage.', 'error');
    }
  });
}

function renderMessages() {
  tabContent.innerHTML = `
    <div class="timeline">
      ${state.messages
        .map((message) => {
          const received = formatDisplayDate(message.receivedAt);
          return `
            <article class="timeline-entry message-card" data-id="${message.id}">
              <header class="message-card__header">
                <div>
                  <strong>${escapeHtml(message.sender)}</strong>
                  <p class="muted">${escapeHtml(message.email)}</p>
                </div>
                <span class="muted">${received}</span>
              </header>
              <p>${escapeHtml(message.body)}</p>
              <div class="message-card__actions">
                <label>Update status</label>
                <select data-action="status">${statusOptions(MESSAGE_STATUSES, message.status)}</select>
                <button type="button" class="button button--ghost button--danger" data-action="delete">Remove</button>
              </div>
            </article>
          `;
        })
        .join('') || '<p class="muted">No inbound messages yet.</p>'}
    </div>
  `;

  tabContent.querySelectorAll('.message-card').forEach((card) => {
    const { id } = card.dataset;
    const select = card.querySelector('select[data-action="status"]');
    const removeButton = card.querySelector('button[data-action="delete"]');

    select?.addEventListener('change', async () => {
      try {
        await api(`/api/messages/${id}`, {
          method: 'PUT',
          body: { status: select.value }
        });
        showToast('Message status updated', 'success');
        await fetchMessages();
      } catch (error) {
        console.error(error);
        showToast('Unable to update message.', 'error');
      }
    });

    removeButton?.addEventListener('click', async () => {
      if (!window.confirm('Remove this message from the inbox?')) return;
      try {
        await api(`/api/messages/${id}`, { method: 'DELETE' });
        showToast('Message removed', 'success');
        await fetchMessages();
        renderMessages();
      } catch (error) {
        console.error(error);
        showToast('Unable to remove message.', 'error');
      }
    });
  });
}

const renderers = {
  profile: renderProfile,
  categories: renderCategories,
  entries: renderEntries,
  homepage: renderHomepage,
  messages: renderMessages
};

function renderCurrentTab() {
  const renderer = renderers[currentTab];
  if (renderer) renderer();
}

function handleTabClick(event) {
  const tab = event.currentTarget;
  tabs.forEach((button) => {
    const isActive = button === tab;
    button.classList.toggle('nav-tabs__button--active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const target = tab.dataset.tab;
  if (!target) return;
  currentTab = target;
  renderCurrentTab();
}

tabs.forEach((tab) => tab.addEventListener('click', handleTabClick));

loadAll();
