import { createServer } from 'http';
import { stat, readFile, writeFile, mkdir } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'state.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const CV_SECTION_PATTERNS = [
  {
    type: 'experience',
    label: 'Experience',
    keywords: ['experience', 'work history', 'employment', 'professional experience'],
    patterns: [/^\s*(professional\s+)?experience\b[:\-]?\s*$/i, /^\s*(work\s+history|employment)\b[:\-]?\s*$/i]
  },
  {
    type: 'projects',
    label: 'Projects',
    keywords: ['projects', 'project experience', 'key projects'],
    patterns: [/^\s*(key\s+)?projects?\b[:\-]?\s*$/i]
  },
  {
    type: 'publications',
    label: 'Publications',
    keywords: ['publications', 'articles', 'writing'],
    patterns: [/^\s*(publications?|articles?)\b[:\-]?\s*$/i]
  },
  {
    type: 'education',
    label: 'Education',
    keywords: ['education', 'studies', 'academics'],
    patterns: [/^\s*(education|academics|studies)\b[:\-]?\s*$/i]
  },
  {
    type: 'achievements',
    label: 'Achievements',
    keywords: ['achievements', 'awards', 'recognition'],
    patterns: [/^\s*(achievements?|awards?|recognition)\b[:\-]?\s*$/i]
  },
  {
    type: 'skills',
    label: 'Skills',
    keywords: ['skills', 'tooling', 'technologies'],
    patterns: [/^\s*(skills?|technologies|tooling)\b[:\-]?\s*$/i]
  },
  {
    type: 'summary',
    label: 'Summary',
    keywords: ['summary', 'profile', 'about'],
    patterns: [/^\s*(summary|profile|about)\b[:\-]?\s*$/i]
  }
];

const CATEGORY_BLUEPRINTS = {
  experience: {
    id: 'experience',
    name: 'Experience',
    description: 'Career highlights, leadership roles, and mission-critical contributions.',
    featured: true
  },
  projects: {
    id: 'projects',
    name: 'Projects',
    description: 'Selected builds, experiments, and flagship launches.',
    featured: true
  },
  publications: {
    id: 'publications',
    name: 'Publications',
    description: 'Articles, essays, and research published across platforms.',
    featured: false
  },
  education: {
    id: 'education',
    name: 'Education',
    description: 'Formal studies, certifications, and continued learning.',
    featured: false
  },
  achievements: {
    id: 'achievements',
    name: 'Achievements',
    description: 'Awards, recognition, and milestone wins worth celebrating.',
    featured: false
  }
};

const FEATURE_SLOTS = ['Spotlight feature', 'Showcase highlight', 'Story spotlight'];
const MAX_ENTRIES_PER_SECTION = 4;
const MAX_TOTAL_ENTRIES = 15;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

async function ensureDataFile() {
  try {
    await mkdir(dataDir, { recursive: true });
    await stat(dataFile);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeFile(
        dataFile,
        JSON.stringify(
          {
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
          },
          null,
          2
        )
      );
    } else {
      throw error;
    }
  }
}

async function readState() {
  await ensureDataFile();
  const content = await readFile(dataFile, 'utf-8');
  const parsed = JSON.parse(content);

  const profile = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {};
  parsed.profile = {
    headline: profile.headline || '',
    intent: profile.intent || '',
    focusAreas: normaliseStringArray(profile.focusAreas),
    bio: profile.bio || '',
    links: normaliseLinks(profile.links),
    cvHighlights: normaliseStringArray(profile.cvHighlights),
    location: profile.location || '',
    availability: profile.availability || '',
    avatar: profile.avatar || '',
    skills: normaliseStringArray(profile.skills)
  };

  parsed.categories = Array.isArray(parsed.categories)
    ? parsed.categories.map((category) => ({
        id: category.id || slugify(category.name || `category-${Date.now()}`),
        name: category.name || 'Untitled category',
        featured: Boolean(category.featured),
        description: typeof category.description === 'string' ? category.description : '',
        source: typeof category.source === 'string' ? category.source : undefined
      }))
    : [];

  parsed.entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => ({
        ...entry,
        summary: typeof entry.summary === 'string' ? entry.summary : '',
        body: typeof entry.body === 'string' ? entry.body : '',
        link: typeof entry.link === 'string' ? entry.link : '',
        media: typeof entry.media === 'string' ? entry.media : '',
        tags: normaliseTags(entry.tags || []),
        source: typeof entry.source === 'string' ? entry.source : undefined,
        updatedAt: entry.updatedAt || new Date().toISOString().slice(0, 10)
      }))
    : [];

  const homepage = parsed.homepage && typeof parsed.homepage === 'object' ? parsed.homepage : {};
  parsed.homepage = {
    hero: {
      title: homepage.hero && typeof homepage.hero.title === 'string' ? homepage.hero.title : '',
      cta: homepage.hero && typeof homepage.hero.cta === 'string' ? homepage.hero.cta : ''
    },
    featured: Array.isArray(homepage.featured)
      ? homepage.featured
          .map((slot) => ({
            slot: typeof slot.slot === 'string' ? slot.slot : '',
            entryId: typeof slot.entryId === 'string' ? slot.entryId : null
          }))
          .filter((slot) => slot.entryId)
      : [],
    highlights: normaliseHighlights(homepage.highlights)
  };

  parsed.messages = Array.isArray(parsed.messages) ? parsed.messages : [];

  return parsed;
}

async function writeState(state) {
  await ensureDataFile();
  await writeFile(dataFile, JSON.stringify(state, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not Found' });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function withCategoryCounts(state) {
  const counts = state.entries.reduce((acc, entry) => {
    const current = acc.get(entry.categoryId) || 0;
    acc.set(entry.categoryId, current + 1);
    return acc;
  }, new Map());
  return state.categories.map((category) => ({
    ...category,
    items: counts.get(category.id) || 0
  }));
}

function enrichEntries(state) {
  const categoryLookup = new Map(state.categories.map((category) => [category.id, category.name]));
  return state.entries.map((entry) => ({
    ...entry,
    categoryName: categoryLookup.get(entry.categoryId) || 'Uncategorised'
  }));
}

function enrichHomepage(state) {
  const entryLookup = new Map(state.entries.map((entry) => [entry.id, entry]));
  const featured = state.homepage.featured.map((slot) => ({
    ...slot,
    entry: entryLookup.get(slot.entryId) || null
  }));
  return {
    hero: state.homepage.hero,
    featured,
    highlights: state.homepage.highlights
  };
}

function normaliseHighlights(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normaliseStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normaliseLinks(value) {
  return normaliseStringArray(value);
}

function normaliseTags(value) {
  return normaliseStringArray(value).map((tag) => tag.replace(/^#/, ''));
}

function uniqueList(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function capitaliseTitle(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 'Untitled entry';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatSkill(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  if (trimmed.toUpperCase() === trimmed) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function summariseText(value, maxLength = 220) {
  const clean = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : slice.length)}…`;
}

function detectSectionHeading(line) {
  const trimmed = line.replace(/^[-*•]\s*/, '').trim();
  if (!trimmed) return null;
  for (const definition of CV_SECTION_PATTERNS) {
    if (definition.patterns.some((pattern) => pattern.test(trimmed))) {
      return { type: definition.type, label: definition.label };
    }
    if (definition.keywords.some((keyword) => trimmed.toLowerCase().includes(keyword))) {
      return { type: definition.type, label: definition.label };
    }
  }
  if (/^[A-Z\s]{4,40}$/.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    const match = CV_SECTION_PATTERNS.find((definition) =>
      definition.keywords.some((keyword) => lower.includes(keyword))
    );
    if (match) {
      return { type: match.type, label: match.label };
    }
  }
  return null;
}

function segmentCv(cvText) {
  if (typeof cvText !== 'string' || !cvText.trim()) {
    return [];
  }
  const lines = cvText.split(/\r?\n/);
  const sections = [];
  let current = { type: 'overview', label: 'Overview', lines: [] };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      current.lines.push('');
      return;
    }
    const heading = detectSectionHeading(line);
    if (heading) {
      if (current.lines.some((item) => item.trim())) {
        sections.push({ ...current, lines: [...current.lines] });
      }
      current = { type: heading.type, label: heading.label, lines: [] };
      return;
    }
    current.lines.push(line);
  });

  if (current.lines.some((item) => item.trim())) {
    sections.push({ ...current, lines: [...current.lines] });
  }

  return sections;
}

function chunkSectionLines(lines) {
  const chunks = [];
  let buffer = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (buffer.length) {
        chunks.push(buffer.join(' '));
        buffer = [];
      }
      return;
    }
    if (/^[-*•]/.test(trimmed)) {
      const cleaned = trimmed.replace(/^[-*•]\s*/, '');
      buffer.push(cleaned);
    } else {
      buffer.push(trimmed);
    }
  });
  if (buffer.length) {
    chunks.push(buffer.join(' '));
  }
  return chunks.filter(Boolean);
}

function createEntryFromBlock(block) {
  const clean = typeof block === 'string' ? block.replace(/\s+/g, ' ').trim() : '';
  if (!clean) return null;
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const firstSentence = sentences[0] || clean;
  let title = firstSentence.split(/[-–—:]/)[0].trim();
  if (title.length < 8 && sentences.length > 1) {
    title = `${title} ${sentences[1].split(' ').slice(0, 4).join(' ')}`.trim();
  }
  if (title.length > 72) {
    const truncated = title.slice(0, 72);
    const lastSpace = truncated.lastIndexOf(' ');
    title = `${truncated.slice(0, lastSpace > 32 ? lastSpace : truncated.length)}…`;
  }
  const summary = summariseText(firstSentence, 200);
  const body = clean;
  return { title, summary, body };
}

function parseSkillsFromSection(lines) {
  const collected = [];
  lines.forEach((line) => {
    const trimmed = line.replace(/^[-*•]\s*/, '').trim();
    if (!trimmed) return;
    trimmed
      .split(/[,;•]/)
      .map((item) => formatSkill(item))
      .forEach((item) => {
        if (item) collected.push(item);
      });
  });
  return uniqueList(collected);
}

function analyseCv(cvText) {
  const segments = segmentCv(cvText);
  const sections = [];
  const skills = new Set();
  const highlightCandidates = [];

  segments.forEach((section) => {
    if (section.type === 'skills') {
      parseSkillsFromSection(section.lines).forEach((skill) => skills.add(skill));
      return;
    }
    if (section.type === 'summary' || section.type === 'overview') {
      const overviewText = section.lines.join(' ').trim();
      if (overviewText) {
        highlightCandidates.push(overviewText);
      }
      return;
    }
    const blocks = chunkSectionLines(section.lines);
    const items = blocks
      .map((block) => createEntryFromBlock(block))
      .filter(Boolean)
      .slice(0, MAX_ENTRIES_PER_SECTION + 1);
    if (!items.length) return;
    sections.push({ type: section.type, label: section.label, items });
    if (['experience', 'projects', 'achievements'].includes(section.type)) {
      items.slice(0, 2).forEach((item) => highlightCandidates.push(item.summary));
    }
  });

  const highlightList = uniqueList(highlightCandidates).slice(0, 5);

  return {
    sections,
    skills: Array.from(skills),
    highlights: highlightList
  };
}

function buildCategoriesFromAnalysis(analysis, focusAreas, retainedIds) {
  const categories = [];
  analysis.sections.forEach((section) => {
    const blueprint = CATEGORY_BLUEPRINTS[section.type];
    if (!blueprint || !section.items.length) return;
    if (retainedIds.has(blueprint.id)) return;
    categories.push({
      id: blueprint.id,
      name: blueprint.name,
      featured: Boolean(blueprint.featured),
      description: blueprint.description,
      source: 'onboarding'
    });
  });

  focusAreas.forEach((area) => {
    const id = slugify(area);
    if (!id || retainedIds.has(id) || categories.some((category) => category.id === id)) return;
    categories.push({
      id,
      name: area,
      featured: false,
      description: `Updates and stories focused on ${area.toLowerCase()}.`,
      source: 'onboarding'
    });
  });

  return categories;
}

function deriveTagsFromFocusAreas(text, focusAreas) {
  if (!Array.isArray(focusAreas) || !focusAreas.length) return [];
  const lowerText = typeof text === 'string' ? text.toLowerCase() : '';
  const tags = focusAreas.filter((area) => {
    const token = area.toLowerCase();
    const words = token.split(/\s+/).filter(Boolean);
    return words.some((word) => word.length > 3 && lowerText.includes(word));
  });
  return uniqueList(tags);
}

function buildEntriesFromAnalysis(analysis, focusAreas, categories, existingEntryIds) {
  const categoryIds = new Set(categories.map((category) => category.id));
  const entries = [];
  const now = new Date().toISOString().slice(0, 10);
  let totalEntries = 0;

  for (const section of analysis.sections) {
    const blueprint = CATEGORY_BLUEPRINTS[section.type];
    if (!blueprint) continue;
    const categoryId = blueprint.id;
    if (!categoryIds.has(categoryId)) continue;
    const sectionItems = section.items.slice(0, MAX_ENTRIES_PER_SECTION);
    sectionItems.forEach((item, index) => {
      if (totalEntries >= MAX_TOTAL_ENTRIES) return;
      const baseId = slugify(`${categoryId}-${item.title}`) || `${categoryId}-${index + 1}`;
      let finalId = baseId;
      let counter = 1;
      while (existingEntryIds.has(finalId) || entries.some((entry) => entry.id === finalId)) {
        finalId = `${baseId}-${counter++}`;
      }
      entries.push({
        id: finalId,
        title: capitaliseTitle(item.title),
        categoryId,
        status: 'published',
        featured: index === 0,
        updatedAt: now,
        summary: summariseText(item.summary, 220),
        body: item.body,
        link: '',
        media: '',
        tags: deriveTagsFromFocusAreas(item.body, focusAreas),
        source: 'onboarding'
      });
      totalEntries += 1;
    });
    if (totalEntries >= MAX_TOTAL_ENTRIES) break;
  }

  return entries;
}

function pickFeaturedEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const sorted = [...entries].sort((a, b) => {
    if (a.featured === b.featured) {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }
    return a.featured ? -1 : 1;
  });
  const selected = [];
  const usedCategories = new Set();

  for (const entry of sorted) {
    if (!entry.id) continue;
    if (selected.length >= FEATURE_SLOTS.length) break;
    if (entry.categoryId && usedCategories.has(entry.categoryId) && selected.length < FEATURE_SLOTS.length - 1) {
      continue;
    }
    selected.push(entry);
    if (entry.categoryId) usedCategories.add(entry.categoryId);
  }

  if (selected.length < FEATURE_SLOTS.length) {
    for (const entry of sorted) {
      if (selected.some((item) => item.id === entry.id)) continue;
      selected.push(entry);
      if (selected.length >= FEATURE_SLOTS.length) break;
    }
  }

  return selected.slice(0, FEATURE_SLOTS.length);
}

function buildHeroCta(intent) {
  const value = typeof intent === 'string' ? intent.toLowerCase() : '';
  if (!value) return 'Connect for collaborations';
  if (value.includes('role') || value.includes('job')) return 'Invite new opportunities';
  if (value.includes('publish') || value.includes('writing')) return 'Explore latest articles';
  if (value.includes('venture') || value.includes('startup')) return 'Pitch a partnership';
  if (value.includes('presence') || value.includes('brand')) return 'Connect for collaborations';
  return 'Reach out to collaborate';
}

function buildHomepageHighlights(profile, focusAreas, featuredEntries, existingHighlights = []) {
  const highlightCandidates = [
    ...(Array.isArray(profile.cvHighlights) ? profile.cvHighlights : []),
    ...focusAreas.map((area) => `Spotlighting ${area}`),
    ...featuredEntries.map((entry) => `New: ${entry.title}`),
    ...normaliseStringArray(existingHighlights)
  ];
  return uniqueList(highlightCandidates).slice(0, 5);
}

function buildHomepageFromBlueprint(profile, entries, focusAreas, existingHighlights = []) {
  const featuredEntries = pickFeaturedEntries(entries);
  return {
    hero: {
      title: profile.headline || 'Your new site is ready',
      cta: buildHeroCta(profile.intent)
    },
    featured: featuredEntries.map((entry, index) => ({
      slot: FEATURE_SLOTS[index] || `Feature ${index + 1}`,
      entryId: entry.id
    })),
    highlights: buildHomepageHighlights(profile, focusAreas, featuredEntries, existingHighlights)
  };
}

function applyOnboardingBlueprint(state, payload) {
  const existingProfile = state.profile || {};
  const focusAreasInput = normaliseStringArray(payload.focusAreas);
  const focusAreas = focusAreasInput.length
    ? focusAreasInput
    : normaliseStringArray(existingProfile.focusAreas);
  const providedLinks = normaliseLinks(payload.links);
  const links = providedLinks.length ? providedLinks : normaliseLinks(existingProfile.links);
  const cvHighlightsInput = normaliseStringArray(payload.cvHighlights);
  const cvText = typeof payload.cvText === 'string' ? payload.cvText : '';
  const analysis = analyseCv(cvText);
  const combinedHighlights = cvHighlightsInput.length
    ? uniqueList([...cvHighlightsInput, ...analysis.highlights]).slice(0, 5)
    : analysis.highlights;
  const profile = {
    headline: typeof payload.headline === 'string' ? payload.headline : existingProfile.headline || '',
    intent: typeof payload.intent === 'string' ? payload.intent : existingProfile.intent || '',
    focusAreas,
    bio: typeof payload.bio === 'string' ? payload.bio : existingProfile.bio || '',
    links,
    cvHighlights: combinedHighlights,
    location: existingProfile.location || '',
    availability: existingProfile.availability || '',
    avatar: existingProfile.avatar || '',
    skills: uniqueList([
      ...analysis.skills,
      ...normaliseStringArray(existingProfile.skills),
      ...focusAreas
    ])
  };

  const retainedCategories = state.categories.filter((category) => category.source !== 'onboarding');
  const retainedCategoryIds = new Set(retainedCategories.map((category) => category.id));
  const newCategories = buildCategoriesFromAnalysis(analysis, focusAreas, retainedCategoryIds);
  const updatedCategories = [...retainedCategories, ...newCategories];

  const retainedEntries = state.entries.filter((entry) => entry.source !== 'onboarding');
  const retainedEntryIds = new Set(retainedEntries.map((entry) => entry.id));
  const newEntries = buildEntriesFromAnalysis(analysis, focusAreas, updatedCategories, retainedEntryIds);
  const updatedEntries = [...retainedEntries, ...newEntries];

  const homepage = buildHomepageFromBlueprint(profile, updatedEntries, focusAreas, state.homepage?.highlights);

  state.profile = profile;
  state.categories = updatedCategories;
  state.entries = updatedEntries;
  state.homepage = homepage;

  return {
    profile: state.profile,
    categories: withCategoryCounts(state),
    entries: enrichEntries(state),
    homepage: enrichHomepage(state)
  };
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const state = await readState();

    if (pathname === '/api/profile') {
      if (req.method === 'GET') {
        sendJson(res, 200, state.profile || {});
        return;
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { error: 'Invalid payload' });
          return;
        }
        state.profile = {
          headline: body.headline || '',
          intent: body.intent || '',
          focusAreas: normaliseStringArray(body.focusAreas),
          bio: body.bio || '',
          links: normaliseLinks(body.links),
          cvHighlights: normaliseStringArray(body.cvHighlights),
          location: body.location || '',
          availability: body.availability || '',
          avatar: body.avatar || '',
          skills: normaliseStringArray(body.skills)
        };
        await writeState(state);
        sendJson(res, 200, state.profile);
        return;
      }
    }

    if (pathname === '/api/site' && req.method === 'GET') {
      sendJson(res, 200, {
        profile: state.profile || {},
        categories: withCategoryCounts(state),
        entries: enrichEntries(state),
        homepage: enrichHomepage(state)
      });
      return;
    }

    if (pathname === '/api/onboarding' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') {
        sendJson(res, 400, { error: 'Invalid payload' });
        return;
      }
      const result = applyOnboardingBlueprint(state, body);
      await writeState(state);
      sendJson(res, 200, result);
      return;
    }

    if (pathname === '/api/categories') {
      if (req.method === 'GET') {
        sendJson(res, 200, withCategoryCounts(state));
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body || typeof body.name !== 'string' || !body.name.trim()) {
          sendJson(res, 400, { error: 'Name is required' });
          return;
        }
        const id = body.id ? slugify(body.id) : slugify(body.name);
        const existing = state.categories.find((category) => category.id === id);
        const finalId = existing ? `${id}-${Date.now()}` : id;
        const category = {
          id: finalId,
          name: body.name.trim(),
          featured: Boolean(body.featured),
          description: typeof body.description === 'string' ? body.description.trim() : ''
        };
        state.categories.push(category);
        await writeState(state);
        sendJson(res, 201, category);
        return;
      }
    }

    if (pathname.startsWith('/api/categories/')) {
      const id = pathname.split('/').pop();
      const category = state.categories.find((item) => item.id === id);
      if (!category) {
        notFound(res);
        return;
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { error: 'Invalid payload' });
          return;
        }
        category.name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : category.name;
        if (typeof body.featured === 'boolean') {
          category.featured = body.featured;
        }
        if (typeof body.description === 'string') {
          category.description = body.description.trim();
        }
        await writeState(state);
        sendJson(res, 200, category);
        return;
      }
      if (req.method === 'DELETE') {
        state.categories = state.categories.filter((item) => item.id !== id);
        state.entries = state.entries.map((entry) =>
          entry.categoryId === id ? { ...entry, categoryId: null } : entry
        );
        await writeState(state);
        sendJson(res, 200, {});
        return;
      }
    }

    if (pathname === '/api/entries') {
      if (req.method === 'GET') {
        sendJson(res, 200, enrichEntries(state));
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body || typeof body.title !== 'string' || !body.title.trim()) {
          sendJson(res, 400, { error: 'Title is required' });
          return;
        }
        const id = body.id ? slugify(body.id) : slugify(body.title) || `entry-${Date.now()}`;
        const entry = {
          id,
          title: body.title.trim(),
          categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
          status: typeof body.status === 'string' ? body.status : 'draft',
          featured: Boolean(body.featured),
          updatedAt: body.updatedAt || new Date().toISOString().slice(0, 10),
          summary: typeof body.summary === 'string' ? body.summary.trim() : '',
          body: typeof body.body === 'string' ? body.body.trim() : '',
          link: typeof body.link === 'string' ? body.link.trim() : '',
          media: typeof body.media === 'string' ? body.media.trim() : '',
          tags: normaliseTags(body.tags)
        };
        state.entries.push(entry);
        await writeState(state);
        sendJson(res, 201, entry);
        return;
      }
    }

    if (pathname.startsWith('/api/entries/')) {
      const id = pathname.split('/').pop();
      const entry = state.entries.find((item) => item.id === id);
      if (!entry) {
        notFound(res);
        return;
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { error: 'Invalid payload' });
          return;
        }
        if (typeof body.title === 'string' && body.title.trim()) {
          entry.title = body.title.trim();
        }
        if (body.categoryId === null || typeof body.categoryId === 'string') {
          entry.categoryId = body.categoryId;
        }
        if (typeof body.status === 'string' && body.status.trim()) {
          entry.status = body.status.trim();
        }
        if (typeof body.featured === 'boolean') {
          entry.featured = body.featured;
        }
        if (typeof body.updatedAt === 'string' && body.updatedAt.trim()) {
          entry.updatedAt = body.updatedAt.trim();
        }
        if (typeof body.summary === 'string') {
          entry.summary = body.summary.trim();
        }
        if (typeof body.body === 'string') {
          entry.body = body.body.trim();
        }
        if (typeof body.link === 'string') {
          entry.link = body.link.trim();
        }
        if (typeof body.media === 'string') {
          entry.media = body.media.trim();
        }
        if (body.tags !== undefined) {
          entry.tags = normaliseTags(body.tags);
        }
        await writeState(state);
        sendJson(res, 200, entry);
        return;
      }
      if (req.method === 'DELETE') {
        state.entries = state.entries.filter((item) => item.id !== id);
        state.homepage.featured = state.homepage.featured.filter((slot) => slot.entryId !== id);
        await writeState(state);
        sendJson(res, 200, {});
        return;
      }
    }

    if (pathname === '/api/homepage') {
      if (req.method === 'GET') {
        sendJson(res, 200, enrichHomepage(state));
        return;
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { error: 'Invalid payload' });
          return;
        }
        if (body.hero && typeof body.hero === 'object') {
          state.homepage.hero = {
            title: typeof body.hero.title === 'string' ? body.hero.title : state.homepage.hero.title,
            cta: typeof body.hero.cta === 'string' ? body.hero.cta : state.homepage.hero.cta
          };
        }
        if (Array.isArray(body.featured)) {
          state.homepage.featured = body.featured
            .map((item) => ({
              slot: typeof item.slot === 'string' ? item.slot : '',
              entryId: typeof item.entryId === 'string' ? item.entryId : null
            }))
            .filter((item) => item.entryId);
        }
        if (body.highlights) {
          state.homepage.highlights = normaliseHighlights(body.highlights);
        }
        await writeState(state);
        sendJson(res, 200, enrichHomepage(state));
        return;
      }
    }

    if (pathname === '/api/messages') {
      if (req.method === 'GET') {
        const messages = [...state.messages].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        sendJson(res, 200, messages);
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!body || typeof body.sender !== 'string' || !body.sender.trim()) {
          sendJson(res, 400, { error: 'Sender is required' });
          return;
        }
        if (typeof body.email !== 'string' || !body.email.includes('@')) {
          sendJson(res, 400, { error: 'Valid email is required' });
          return;
        }
        if (typeof body.body !== 'string' || !body.body.trim()) {
          sendJson(res, 400, { error: 'Message body is required' });
          return;
        }
        const message = {
          id: `m-${Date.now()}`,
          sender: body.sender.trim(),
          email: body.email.trim(),
          status: 'new',
          receivedAt: new Date().toISOString(),
          body: body.body.trim()
        };
        state.messages.push(message);
        await writeState(state);
        sendJson(res, 201, message);
        return;
      }
    }

    if (pathname.startsWith('/api/messages/')) {
      const id = pathname.split('/').pop();
      const message = state.messages.find((item) => item.id === id);
      if (!message) {
        notFound(res);
        return;
      }
      if (req.method === 'PUT') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { error: 'Invalid payload' });
          return;
        }
        if (typeof body.status === 'string' && body.status.trim()) {
          message.status = body.status.trim();
        }
        await writeState(state);
        sendJson(res, 200, message);
        return;
      }
      if (req.method === 'DELETE') {
        state.messages = state.messages.filter((item) => item.id !== id);
        await writeState(state);
        sendJson(res, 200, {});
        return;
      }
    }

    notFound(res);
  } catch (error) {
    console.error('API error:', error);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURI(requestUrl.pathname);

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = path.join(publicDir, pathname);

    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch (error) {
      const notFoundPath = path.join(publicDir, '404.html');
      try {
        const notFoundContent = await readFile(notFoundPath);
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(notFoundContent);
      } catch (notFoundErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      }
      return;
    }

    if (fileStat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      try {
        await stat(indexPath);
        res.writeHead(200, { 'Content-Type': getMimeType(indexPath) });
        createReadStream(indexPath).pipe(res);
      } catch (error) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Aura Studio preview available at http://localhost:${port}`);
});
