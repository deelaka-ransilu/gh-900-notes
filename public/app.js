let topics = [];
let selectedId = null;
let saveTimer = null;

const domainsEl = document.getElementById('domains');
const panelEl = document.getElementById('panel');
const backdropEl = document.getElementById('panel-backdrop');
const closeBtnEl = document.getElementById('close-panel');
const noteEl = document.getElementById('note');
const toggleEl = document.getElementById('toggle');
const titleEl = document.getElementById('title');
const metaEl = document.getElementById('meta');
const statsEl = document.getElementById('stats');
const mobileFabEl = document.getElementById('mobile-fab');
const fabTopicNameEl = document.getElementById('fab-topic-name');

async function load() {
  try {
    const res = await fetch('/api/topics');
    topics = await res.json();
    render();
  } catch (err) {
    console.error('Failed to load topics', err);
    domainsEl.innerHTML = '<p style="color:var(--muted)">Failed to load topics. Is the server running?</p>';
  }
}

function updateStats() {
  if (!statsEl) return;
  const covered = topics.filter(t => t.covered).length;
  const total = topics.length;
  const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
  statsEl.innerHTML = `Covered <span>${covered}/${total}</span> (${percent}%)`;
}

function render() {
  domainsEl.innerHTML = '';
  updateStats();

  const groups = new Map();
  for (const t of topics) {
    if (!groups.has(t.domain)) groups.set(t.domain, []);
    groups.get(t.domain).push(t);
  }

  for (const [domain, items] of groups) {
    const m = domain.match(/^(.*?)\s*\((.*)\)$/);
    const row = document.createElement('div');
    row.className = 'domain';

    const header = document.createElement('div');
    header.className = 'domain-header';

    const h = document.createElement('h3');
    h.textContent = m ? m[1] : domain;
    header.append(h);

    if (m) {
      const s = document.createElement('small');
      s.textContent = m[2] + ' of exam';
      header.append(s);
    }

    const pills = document.createElement('div');
    pills.className = 'pills';
    for (const t of items) {
      const b = document.createElement('button');
      b.className = 'pill' + (t.covered ? ' covered' : '') + (t.id === selectedId ? ' selected' : '');
      b.textContent = t.name;
      b.dataset.id = t.id;
      b.onclick = () => select(t.id);
      pills.append(b);
    }

    row.append(header, pills);
    domainsEl.append(row);
  }
}

function current() {
  return topics.find(t => t.id === selectedId);
}

function openPanel() {
  panelEl.classList.add('open');
  backdropEl.classList.add('active');
  if (mobileFabEl) mobileFabEl.classList.add('hidden');
}

function closePanel() {
  panelEl.classList.remove('open');
  backdropEl.classList.remove('active');
  if (selectedId && mobileFabEl) {
    const t = current();
    if (t) {
      fabTopicNameEl.textContent = t.name;
      mobileFabEl.classList.remove('hidden');
    }
  }
}

function updatePillSelection() {
  document.querySelectorAll('.pill').forEach(btn => {
    if (Number(btn.dataset.id) === selectedId) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function select(id) {
  flushSave();
  selectedId = id;
  const t = current();
  if (!t) return;

  titleEl.textContent = t.name;
  metaEl.textContent = t.updated_at ? 'Last saved ' + t.updated_at + ' UTC' : 'No note yet.';
  noteEl.value = t.note;
  noteEl.disabled = false;
  toggleEl.disabled = false;
  toggleEl.textContent = t.covered ? 'Mark as not covered' : 'Mark as covered';
  if (t.covered) {
    toggleEl.classList.add('covered');
  } else {
    toggleEl.classList.remove('covered');
  }

  updatePillSelection();
  openPanel();
}

async function save(t) {
  if (!t) return;
  try {
    const res = await fetch('/api/topics/' + t.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: t.note, covered: t.covered }),
    });
    if (t.id === selectedId) metaEl.textContent = res.ok ? 'Saved' : 'Save failed.';
  } catch {
    if (t.id === selectedId) metaEl.textContent = 'Save failed. Is the server running?';
  }
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    save(current());
  }
}

noteEl.addEventListener('input', () => {
  const t = current();
  if (!t) return;
  t.note = noteEl.value;
  metaEl.textContent = 'Saving...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save(t);
  }, 1000);
});

toggleEl.addEventListener('click', () => {
  const t = current();
  if (!t) return;
  t.covered = t.covered ? 0 : 1;
  toggleEl.textContent = t.covered ? 'Mark as not covered' : 'Mark as covered';
  if (t.covered) {
    toggleEl.classList.add('covered');
  } else {
    toggleEl.classList.remove('covered');
  }
  const pillBtn = document.querySelector(`.pill[data-id="${t.id}"]`);
  if (pillBtn) {
    if (t.covered) pillBtn.classList.add('covered');
    else pillBtn.classList.remove('covered');
  }
  updateStats();
  save(t);
});

document.getElementById('export').addEventListener('click', async () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await save(current());
  }
  try {
    const res = await fetch('/api/export', { method: 'POST' });
    const data = await res.json();
    metaEl.textContent = res.ok ? 'Exported ' + data.topics + ' topics to notes.md' : 'Export failed.';
  } catch {
    metaEl.textContent = 'Export failed. Is the server running?';
  }
});

closeBtnEl.addEventListener('click', closePanel);
backdropEl.addEventListener('click', closePanel);

if (mobileFabEl) {
  mobileFabEl.addEventListener('click', openPanel);
}

// Close bottom sheet if Esc key is pressed
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelEl.classList.contains('open')) {
    closePanel();
  }
});

load();
