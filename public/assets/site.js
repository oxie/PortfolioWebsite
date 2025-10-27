const headlineEl = document.getElementById('profile-headline');
const intentEl = document.getElementById('profile-intent');
const bioEl = document.getElementById('profile-bio');
const focusContainer = document.getElementById('focus-areas');
const locationEl = document.getElementById('profile-location');
const availabilityEl = document.getElementById('profile-availability');
const linksContainer = document.getElementById('profile-links');
const avatarContainer = document.getElementById('profile-avatar');
const skillsContainer = document.getElementById('skills-list');
const featuredGrid = document.getElementById('featured-grid');
const featuredTitle = document.getElementById('featured-title');
const featuredSubtitle = document.getElementById('featured-subtitle');
const homepageHighlights = document.getElementById('homepage-highlights');
const highlightsList = document.getElementById('cv-highlights');
const categorySections = document.getElementById('category-sections');
const navLinks = document.getElementById('site-nav-links');

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

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderProfile(profile) {
  if (!profile) return;
  headlineEl.textContent = profile.headline || 'Untitled explorer';
  intentEl.textContent = profile.intent || '';
  bioEl.textContent = profile.bio || '';

  clearChildren(focusContainer);
  if (Array.isArray(profile.focusAreas) && profile.focusAreas.length) {
    profile.focusAreas.forEach((area) => {
      const chip = document.createElement('span');
      chip.className = 'chip chip--accent';
      chip.textContent = area;
      focusContainer.appendChild(chip);
    });
  } else {
    const fallback = document.createElement('p');
    fallback.className = 'muted';
    fallback.textContent = 'Add focus areas to spotlight your domains.';
    focusContainer.appendChild(fallback);
  }

  locationEl.textContent = profile.location || 'Add your location';
  availabilityEl.textContent = profile.availability || 'Share your current availability';

  clearChildren(linksContainer);
  if (Array.isArray(profile.links) && profile.links.length) {
    profile.links.forEach((link) => {
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.textContent = link.replace(/^https?:\/\//, '');
      anchor.target = link.startsWith('http') ? '_blank' : '_self';
      anchor.rel = 'noopener';
      linksContainer.appendChild(anchor);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Add key links to drive visitors to your work.';
    linksContainer.appendChild(empty);
  }

  clearChildren(skillsContainer);
  if (Array.isArray(profile.skills) && profile.skills.length) {
    profile.skills.forEach((skill) => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = skill;
      skillsContainer.appendChild(pill);
    });
  } else if (skillsContainer) {
    const emptySkill = document.createElement('p');
    emptySkill.className = 'muted';
    emptySkill.textContent = 'Add your standout skills to surface them here.';
    skillsContainer.appendChild(emptySkill);
  }

  if (profile.avatar) {
    avatarContainer.style.backgroundImage = `url("${encodeURI(profile.avatar)}")`;
  } else {
    avatarContainer.classList.add('site-hero__avatar--placeholder');
    avatarContainer.textContent = profile.headline ? profile.headline.charAt(0) : 'A';
  }
}

function renderFeatured(homepage, entries) {
  clearChildren(featuredGrid);
  clearChildren(homepageHighlights);

  if (homepage.hero?.title) {
    featuredTitle.textContent = homepage.hero.title;
  }
  if (homepage.hero?.cta) {
    featuredSubtitle.textContent = homepage.hero.cta;
  }

  const entryLookup = new Map(entries.map((entry) => [entry.id, entry]));
  const featured = Array.isArray(homepage.featured) ? homepage.featured : [];

  if (!featured.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No featured content yet. Mark entries as featured to see them here.';
    featuredGrid.appendChild(empty);
  } else {
    featured.forEach((slot) => {
      const entry = entryLookup.get(slot.entryId);
      if (!entry) return;
      const card = document.createElement('article');
      card.className = 'entry-card entry-card--featured';
      card.innerHTML = `
        <header>
          <p class="entry-card__eyebrow">${escapeHtml(slot.slot || 'Featured')}</p>
          <h3>${escapeHtml(entry.title)}</h3>
        </header>
        <p>${escapeHtml(entry.summary || entry.body || '')}</p>
        ${renderTagList(entry.tags)}
        ${entry.link ? `<a class="entry-card__link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">Visit project</a>` : ''}
      `;
      if (entry.media) {
        card.style.setProperty('--entry-media', `url("${encodeURI(entry.media)}")`);
        card.classList.add('entry-card--with-media');
      }
      featuredGrid.appendChild(card);
    });
  }

  if (Array.isArray(homepage.highlights) && homepage.highlights.length) {
    homepage.highlights.forEach((item) => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = item;
      homepageHighlights.appendChild(pill);
    });
  }
}

function renderTagList(tags) {
  if (!Array.isArray(tags) || !tags.length) return '';
  return `<ul class="tag-list">${tags.map((tag) => `<li>#${escapeHtml(tag)}</li>`).join('')}</ul>`;
}

function renderCvHighlights(profile) {
  clearChildren(highlightsList);
  if (!Array.isArray(profile.cvHighlights) || !profile.cvHighlights.length) {
    const empty = document.createElement('li');
    empty.className = 'timeline-entry';
    empty.textContent = 'Add your CV highlights to populate this section.';
    highlightsList.appendChild(empty);
    return;
  }
  profile.cvHighlights.forEach((highlight) => {
    const item = document.createElement('li');
    item.className = 'timeline-entry';
    item.innerHTML = `<strong>${escapeHtml(highlight)}</strong>`;
    highlightsList.appendChild(item);
  });
}

function renderCategories(categories, entries) {
  clearChildren(categorySections);
  clearChildren(navLinks);

  const navItems = [
    { href: '#featured-section', label: 'Featured' },
    { href: '#cv-section', label: 'Highlights' }
  ];

  const grouped = entries.reduce((acc, entry) => {
    if (!entry.categoryId) return acc;
    if (!acc.has(entry.categoryId)) acc.set(entry.categoryId, []);
    acc.get(entry.categoryId).push(entry);
    return acc;
  }, new Map());

  categories.forEach((category) => {
    const sectionId = `category-${category.id}`;
    navItems.push({ href: `#${sectionId}`, label: category.name });

    const section = document.createElement('section');
    section.className = 'site-section site-section--category';
    section.id = sectionId;
    section.innerHTML = `
      <header class="site-section__header">
        <h2>${escapeHtml(category.name)}</h2>
        <p>${escapeHtml(category.description || '')}</p>
      </header>
    `;

    const list = document.createElement('div');
    list.className = 'entry-grid';
    const categoryEntries = grouped.get(category.id) || [];

    if (!categoryEntries.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No entries yet. Create one in the admin dashboard.';
      list.appendChild(empty);
    } else {
      categoryEntries
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .forEach((entry) => {
          const card = document.createElement('article');
          card.className = 'entry-card';
          card.innerHTML = `
            <header>
              <h3>${escapeHtml(entry.title)}</h3>
              <span class="status-pill" data-status="${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span>
            </header>
            <p>${escapeHtml(entry.summary || entry.body || 'Add a summary to showcase this piece.')}</p>
            ${renderTagList(entry.tags)}
            ${entry.link ? `<a class="entry-card__link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">Open link</a>` : ''}
          `;
          list.appendChild(card);
        });
    }

    section.appendChild(list);
    categorySections.appendChild(section);
  });

  navItems.forEach((item) => {
    const li = document.createElement('li');
    const anchor = document.createElement('a');
    anchor.href = item.href;
    anchor.textContent = item.label;
    li.appendChild(anchor);
    navLinks.appendChild(li);
  });
}

async function bootstrap() {
  try {
    const response = await fetch('/api/site');
    if (!response.ok) throw new Error('Failed to load site data');
    const data = await response.json();
    renderProfile(data.profile);
    renderFeatured(data.homepage, data.entries);
    renderCvHighlights(data.profile);
    renderCategories(data.categories, data.entries);
  } catch (error) {
    console.error(error);
    const errorBanner = document.createElement('p');
    errorBanner.className = 'form-status';
    errorBanner.dataset.variant = 'error';
    errorBanner.textContent = 'Unable to load the site preview. Please refresh to try again.';
    document.querySelector('.site-main')?.prepend(errorBanner);
  }
}

bootstrap();
