const form = document.getElementById('onboarding-form');
const stepperLabel = document.getElementById('stepper-label');
const stepperProgress = document.getElementById('stepper-progress');
const backButton = document.getElementById('back-button');
const nextButton = document.getElementById('next-button');
const summaryContainer = document.getElementById('summary');
const statusEl = document.getElementById('onboarding-status');

const templates = Array.from(form.querySelectorAll('template'));
const state = {
  step: 0,
  focusAreas: [],
  intent: '',
  cvText: '',
  cvHighlights: [],
  headline: '',
  bio: '',
  links: '',
  cvFilename: '',
  skills: [],
  analysis: null
};

let isSaving = false;
let hasSaved = false;

function setStatus(message, variant = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  if (variant) {
    statusEl.dataset.variant = variant;
  } else {
    delete statusEl.dataset.variant;
  }
}

function renderStep() {
  const template = templates[state.step];
  const fragment = template.content.cloneNode(true);
  form.querySelectorAll('.step-content').forEach((node) => node.remove());
  const wrapper = document.createElement('div');
  wrapper.className = 'step-content';
  wrapper.appendChild(fragment);
  form.insertBefore(wrapper, form.querySelector('.step-actions'));

  const progress = ((state.step + 1) / templates.length) * 100;
  stepperProgress.style.width = `${progress}%`;
  stepperLabel.textContent = `Step ${state.step + 1} of ${templates.length}`;

  if (state.step !== templates.length - 1) {
    setStatus('');
  }

  hydrateStep();
  wireChips();
  wireFileUpload();
  updateActions();
}

function wireChips() {
  document.querySelectorAll('.chip-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLButtonElement)) return;
      event.target.classList.toggle('chip--active');
      const field = row.dataset.field;
      if (!field) return;

      if (field === 'focusAreas') {
        const value = event.target.dataset.value;
        if (!value) return;
        if (event.target.classList.contains('chip--active')) {
          if (!state.focusAreas.includes(value)) state.focusAreas.push(value);
        } else {
          state.focusAreas = state.focusAreas.filter((item) => item !== value);
        }
      }

      if (field === 'intent') {
        document.querySelectorAll('[data-field="intent"] .chip').forEach((chip) => {
          if (chip !== event.target) chip.classList.remove('chip--active');
        });
        if (event.target.classList.contains('chip--active')) {
          state.intent = event.target.dataset.value || '';
        } else {
          state.intent = '';
        }
      }
    });
  });
}

function wireFileUpload() {
  const fileInput = form.querySelector('#cv-upload');
  const status = form.querySelector('#cv-upload-status');
  if (!fileInput) return;

  const setUploadStatus = (message, variant = '') => {
    if (!status) return;
    status.textContent = message;
    if (variant) {
      status.dataset.variant = variant;
    } else {
      delete status.dataset.variant;
    }
  };

  if (state.cvFilename) {
    setUploadStatus(`Loaded ${state.cvFilename}. You can continue editing the extracted text below.`, 'success');
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    state.analysis = null;
    if (!file) {
      setUploadStatus('Select a CV file to auto-populate the highlights or paste the contents below.');
      state.cvFilename = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadStatus('The file is larger than 2 MB. Please upload a smaller text-based CV.', 'error');
      fileInput.value = '';
      return;
    }

    setUploadStatus(`Reading ${file.name}...`, 'info');

    try {
      const text = await file.text();
      if (!isReadableText(text)) {
        throw new Error('Unrecognised format');
      }
      state.cvText = text;
      state.cvFilename = file.name;
      const textarea = form.querySelector('#cv-text');
      if (textarea) {
        textarea.value = text;
      }
      setUploadStatus(`Loaded ${file.name}. Review the extracted text before continuing.`, 'success');
      if (state.step === templates.length - 1) {
        renderSummary();
      }
    } catch (error) {
      console.error('Failed to read file', error);
      state.cvFilename = '';
      setUploadStatus('Unable to read that file. Upload a TXT, Markdown, or RTF CV instead.', 'error');
      fileInput.value = '';
    }
  });
}

function hydrateStep() {
  if (state.step === 0) {
    const cvText = form.querySelector('#cv-text');
    if (cvText) cvText.value = state.cvText;
    const uploadStatus = form.querySelector('#cv-upload-status');
    if (uploadStatus) {
      if (state.cvFilename) {
        uploadStatus.textContent = `Loaded ${state.cvFilename}. You can continue editing the extracted text below.`;
        uploadStatus.dataset.variant = 'success';
      } else {
        uploadStatus.textContent = 'Drop a file to auto-populate the highlights or paste the contents below.';
        delete uploadStatus.dataset.variant;
      }
    }
    document.querySelectorAll('[data-field="focusAreas"] .chip').forEach((chip) => {
      if (state.focusAreas.includes(chip.dataset.value)) {
        chip.classList.add('chip--active');
      }
    });
  }

  if (state.step === 1) {
    const headline = form.querySelector('#headline');
    if (headline) headline.value = state.headline;
    document.querySelectorAll('[data-field="intent"] .chip').forEach((chip) => {
      if (chip.dataset.value === state.intent) {
        chip.classList.add('chip--active');
      }
    });
  }

  if (state.step === 2) {
    const bio = form.querySelector('#bio');
    const links = form.querySelector('#links');
    if (bio) bio.value = state.bio;
    if (links) links.value = state.links;
  }

  if (state.step === 3) {
    renderSummary();
  }
}

function renderSummary() {
  if (!summaryContainer) return;
  const { focusAreas, intent, headline, bio, links } = state;
  const highlights = extractHighlights();
  state.cvHighlights = highlights;
  const generated = state.analysis;
  const categories = Array.isArray(generated?.categories) ? generated.categories : [];
  const entries = Array.isArray(generated?.entries) ? generated.entries : [];
  const skills = Array.isArray(state.skills) ? state.skills : [];

  const categoryPreview = categories
    .slice(0, 5)
    .map(
      (category) => `
        <li>
          <strong>${escapeHtml(category.name)}</strong>
          <span class="muted">${Number(category.items || 0)} item${Number(category.items || 0) === 1 ? '' : 's'}</span>
        </li>
      `
    )
    .join('');

  const additionalCategories = Math.max(0, categories.length - 5);

  summaryContainer.innerHTML = `
    <div class="panel-card summary-card">
      <h2>Blueprint preview</h2>
      <p class="lead">Here is how Aura Studio will shape your site before you make edits.</p>
      <div class="cards-row">
        <div class="stat-card">
          <strong>Hero headline</strong>
          <p>${escapeHtml(headline) || 'Add your headline'}</p>
        </div>
        <div class="stat-card">
          <strong>Primary intent</strong>
          <p>${escapeHtml(intent) || 'Select your intent'}</p>
        </div>
        <div class="stat-card">
          <strong>Focus areas</strong>
          <p>${focusAreas.length ? escapeHtml(focusAreas.join(', ')) : 'Choose at least one focus area'}</p>
        </div>
      </div>
      <div class="timeline">
        <div class="timeline-entry">
          <strong>Spotlight summary</strong>
          <p>${escapeHtml(bio) || 'Share a short bio to generate the hero section.'}</p>
        </div>
        <div class="timeline-entry">
          <strong>CV highlights</strong>
          <ul>
            ${highlights.map((sentence) => `<li>${escapeHtml(sentence.trim())}</li>`).join('') || '<li>Add your CV to see highlights.</li>'}
          </ul>
        </div>
        <div class="timeline-entry">
          <strong>Suggested navigation</strong>
          <p>${buildNavigationSummary()}</p>
        </div>
        <div class="timeline-entry">
          <strong>Links</strong>
          <p>${links ? escapeHtml(links) : 'Add your important links to surface them on the contact page.'}</p>
        </div>
      </div>
    </div>
    ${
      generated
        ? `
      <div class="panel-card summary-card summary-card--workspace">
        <h3>Workspace setup</h3>
        <p class="lead">We populated your admin workspace with ${categories.length} categor${
            categories.length === 1 ? 'y' : 'ies'
          } and ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.</p>
        <div class="summary-grid">
          <div>
            <h4>Categories ready to edit</h4>
            <ul class="summary-list">
              ${categoryPreview || '<li class="muted">Blueprint categories appear here after saving.</li>'}
              ${additionalCategories ? `<li class="muted">+ ${additionalCategories} more categories</li>` : ''}
            </ul>
          </div>
          <div>
            <h4>Detected skills & tags</h4>
            ${
              skills.length
                ? `<div class="pill-grid">${skills
                    .map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`)
                    .join('')}</div>`
                : '<p class="muted">Add more context to surface your core skills.</p>'
            }
          </div>
        </div>
        <a class="button" href="/dashboard.html" target="_blank" rel="noopener">Open the admin workspace</a>
      </div>
    `
        : ''
    }
  `;
}

function buildNavigationSummary() {
  const base = ['Home', 'About', 'Portfolio', 'Articles'];
  const extras = state.focusAreas.filter((area) => !['Portfolio', 'Articles'].includes(area));
  const combined = [...new Set([...base, ...extras])];
  return combined.join(' • ');
}

function captureStepData() {
  if (state.step === 0) {
    const cvText = form.querySelector('#cv-text');
    state.cvText = cvText ? cvText.value : '';
  }

  if (state.step === 1) {
    const headline = form.querySelector('#headline');
    state.headline = headline ? headline.value : '';
  }

  if (state.step === 2) {
    const bio = form.querySelector('#bio');
    const links = form.querySelector('#links');
    state.bio = bio ? bio.value : '';
    state.links = links ? links.value : '';
  }
}

function updateActions() {
  const isFirstStep = state.step === 0;
  backButton.disabled = isFirstStep || isSaving;
  backButton.setAttribute('aria-disabled', backButton.disabled ? 'true' : 'false');

  if (state.step === templates.length - 1) {
    if (isSaving) {
      nextButton.textContent = 'Saving...';
      nextButton.disabled = true;
    } else if (hasSaved) {
      nextButton.textContent = 'Blueprint saved';
      nextButton.disabled = true;
    } else {
      nextButton.textContent = 'Save blueprint';
      nextButton.disabled = false;
    }
    return;
  }

  nextButton.textContent = 'Continue';
  nextButton.disabled = false;
}

function extractHighlights() {
  if (Array.isArray(state.analysis?.profile?.cvHighlights) && state.analysis.profile.cvHighlights.length) {
    return state.analysis.profile.cvHighlights;
  }
  const trimmedCv = state.cvText.trim();
  if (trimmedCv) {
    const sentences = trimmedCv.split(/\n|\.\s/).filter(Boolean);
    return sentences.slice(0, 3).map((sentence) => sentence.trim());
  }
  if (Array.isArray(state.cvHighlights) && state.cvHighlights.length) {
    return state.cvHighlights;
  }
  return [];
}

function parseLinks() {
  if (!state.links) return [];
  return state.links
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean);
}

function validateCurrentStep() {
  setStatus('');
  if (state.step === 1) {
    const headline = form.querySelector('#headline');
    if (headline && !headline.value.trim()) {
      setStatus('Add a headline to keep the hero section compelling.', 'error');
      headline.focus();
      return false;
    }
    if (!state.intent) {
      setStatus('Select your primary intent to tailor recommendations.', 'error');
      return false;
    }
  }
  if (state.step === 2) {
    const bio = form.querySelector('#bio');
    if (bio && !bio.value.trim()) {
      setStatus('Share a short bio so we can draft your summary.', 'error');
      bio.focus();
      return false;
    }
  }
  return true;
}

async function saveBlueprint() {
  if (isSaving) return;
  setStatus('Saving blueprint...', 'info');
  isSaving = true;
  state.analysis = null;
  updateActions();

  const payload = {
    headline: state.headline,
    intent: state.intent,
    focusAreas: state.focusAreas,
    bio: state.bio,
    links: parseLinks(),
    cvHighlights: extractHighlights(),
    cvText: state.cvText
  };

  try {
    const response = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error('Failed to save blueprint');
    }
    const data = await response.json();
    state.analysis = data;
    if (data?.profile) {
      if (Array.isArray(data.profile.cvHighlights) && data.profile.cvHighlights.length) {
        state.cvHighlights = data.profile.cvHighlights;
      }
      if (Array.isArray(data.profile.links)) {
        state.links = data.profile.links.join(', ');
      }
      if (Array.isArray(data.profile.skills)) {
        state.skills = data.profile.skills;
      }
    }
    hasSaved = true;
    const categoryCount = Array.isArray(data?.categories) ? data.categories.length : 0;
    const entryCount = Array.isArray(data?.entries) ? data.entries.length : 0;
    setStatus(
      `Blueprint saved. ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'} and ${entryCount} entr${
        entryCount === 1 ? 'y' : 'ies'
      } are ready in your admin workspace.`,
      'success'
    );
    renderSummary();
  } catch (error) {
    console.error(error);
    setStatus('Unable to save the blueprint right now. Please try again.', 'error');
    hasSaved = false;
    isSaving = false;
    updateActions();
    return;
  }

  isSaving = false;
  updateActions();
}

backButton.addEventListener('click', () => {
  if (state.step === 0 || isSaving) return;
  state.step -= 1;
  hasSaved = false;
  renderStep();
});

nextButton.addEventListener('click', async () => {
  if (state.step === templates.length - 1) {
    captureStepData();
    await saveBlueprint();
    return;
  }

  if (!validateCurrentStep()) {
    return;
  }

  captureStepData();
  hasSaved = false;
  state.step += 1;
  renderStep();
});

async function loadProfile() {
  try {
    const response = await fetch('/api/profile');
    if (!response.ok) return;
    const profile = await response.json();
    state.headline = profile.headline || '';
    state.intent = profile.intent || '';
    state.focusAreas = Array.isArray(profile.focusAreas) ? profile.focusAreas : [];
    state.bio = profile.bio || '';
    state.links = Array.isArray(profile.links) ? profile.links.join(', ') : profile.links || '';
    state.cvHighlights = Array.isArray(profile.cvHighlights) ? profile.cvHighlights : [];
    state.skills = Array.isArray(profile.skills) ? profile.skills : [];
  } catch (error) {
    console.error('Failed to load profile', error);
  }
}

async function bootstrap() {
  await loadProfile();
  renderStep();
}

bootstrap();

function isReadableText(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const sample = trimmed.slice(0, 2000);
  const printableMatches = sample.match(/[\x09\x0A\x0D\x20-\x7E]/g) || [];
  return printableMatches.length / sample.length > 0.7;
}

function escapeHtml(value) {
  return value
    ? value
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    : '';
}
