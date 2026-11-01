const SUPABASE_URL = 'https://lhlmoysvbjggwkrqjwup.supabase.co';
// Must be the publishable key and never the secret key
const SUPABASE_KEY = 'sb_publishable_nqehKsuiNMuD7qzkPkTJOQ_Ow0Uy4Bh';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let topics = [];
let selectedId = null;
let saveTimer = null;

const loginEl = document.getElementById('login');
const loginFormEl = document.getElementById('loginForm');
const emailEl = document.getElementById('loginEmail');
const passwordEl = document.getElementById('loginPassword');
const loginMsgEl = document.getElementById('loginMsg');

const headerEl = document.querySelector('.app-header');
const mainEl = document.querySelector('main');
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
const logoutBtnEl = document.getElementById('logout');
const exportBtnEl = document.getElementById('export');

function showApp() {
  loginEl.hidden = true;
  headerEl.hidden = false;
  mainEl.hidden = false;
  backdropEl.hidden = false;
  if (mobileFabEl) mobileFabEl.hidden = false;
}

function showLogin() {
  loginEl.hidden = false;
  headerEl.hidden = true;
  mainEl.hidden = true;
  backdropEl.hidden = true;
  if (mobileFabEl) mobileFabEl.hidden = true;
}

function clearDomTopics() {
  domainsEl.innerHTML = '';
  if (statsEl) statsEl.innerHTML = '';
  titleEl.textContent = 'Pick a topic';
  metaEl.textContent = 'Click a pill to read and edit its note.';
  noteEl.value = '';
  noteEl.disabled = true;
  toggleEl.disabled = true;
  toggleEl.textContent = 'Mark as covered';
  toggleEl.classList.remove('covered');
  if (fabTopicNameEl) fabTopicNameEl.textContent = '';
}

async function load() {
  try {
    const { data, error } = await sb.from('gh900_topics').select('*').order('id');
    if (error) {
      console.error('Failed to load topics', error);
      domainsEl.innerHTML = '';
      const p = document.createElement('p');
      p.style.color = 'var(--muted)';
      p.textContent = error.message || 'Failed to load topics.';
      domainsEl.append(p);
      return;
    }
    topics = data || [];
    render();
  } catch (err) {
    console.error('Failed to load topics', err);
    domainsEl.innerHTML = '';
    const p = document.createElement('p');
    p.style.color = 'var(--muted)';
    p.textContent = err.message || 'Failed to load topics.';
    domainsEl.append(p);
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
  metaEl.textContent = t.updated_at ? 'Last saved ' + new Date(t.updated_at).toLocaleString() : 'No note yet.';
  noteEl.value = t.note || '';
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
    const { data, error } = await sb
      .from('gh900_topics')
      .update({
        note: t.note,
        covered: t.covered,
        updated_at: new Date().toISOString(),
      })
      .eq('id', t.id)
      .select();

    if (error) {
      if (t.id === selectedId) metaEl.textContent = 'Save failed: ' + error.message;
      return;
    }

    if (!data || data.length !== 1) {
      if (t.id === selectedId) metaEl.textContent = 'Save failed: unauthorized or row not found';
      return;
    }

    t.updated_at = data[0].updated_at;
    if (t.id === selectedId) metaEl.textContent = 'Saved';
  } catch (err) {
    if (t.id === selectedId) metaEl.textContent = 'Save failed: ' + (err.message || 'network error');
  }
}

async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await save(current());
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
  t.covered = !t.covered;
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

exportBtnEl.addEventListener('click', async () => {
  await flushSave();
  let md = '# GH-900 notes\n';
  let lastDomain = null;
  for (const t of topics) {
    if (t.domain !== lastDomain) {
      md += `\n## ${t.domain}\n`;
      lastDomain = t.domain;
    }
    md += `\n### ${t.name}\n\n${t.covered ? 'Covered' : 'Not covered yet'}\n`;
    if (t.note && t.note.trim()) {
      md += `\n${t.note.trim()}\n`;
    }
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notes.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  metaEl.textContent = 'Exported ' + topics.length + ' topics to notes.md';
});

loginFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsgEl.textContent = '';
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      loginMsgEl.textContent = error.message;
      return;
    }
    passwordEl.value = '';
    showApp();
    await load();
  } catch (err) {
    loginMsgEl.textContent = err.message || 'Login failed';
  }
});

logoutBtnEl.addEventListener('click', async () => {
  await flushSave();
  try {
    await sb.auth.signOut();
  } catch (err) {
    console.error('Sign out error', err);
  }
  topics = [];
  selectedId = null;
  closePanel();
  clearDomTopics();
  showLogin();
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

async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      showApp();
      await load();
    } else {
      clearDomTopics();
      showLogin();
    }
  } catch (err) {
    console.error('Session check failed', err);
    clearDomTopics();
    showLogin();
  }
}

init();
