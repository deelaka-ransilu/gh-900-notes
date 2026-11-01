const express  = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, 'gh-900-notes.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    covered INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT
  )
`);

const SEED = {
  '1. Git basics (25-30%)': {
    done: ['Git vs GitHub', '3 places', 'add / commit / push', 'init vs clone', 'GitHub Flow', 'gh CLI'],
    todo: ['Accounts, orgs, enterprise', 'Markdown', 'Desktop & Mobile', 'Why version control'],
  },
  '2. Repositories (10-15%)': {
    done: ['.git vs .github', 'Branches'],
    todo: ['README', 'LICENSE', 'CONTRIBUTING', 'CODEOWNERS', 'SECURITY.md', 'Templates'],
  },
  '3. Collaboration (10-15%)': {
    done: ['Pull requests', 'Merge types', 'Draft PR', 'Closing keywords'],
    todo: ['Issues', 'Discussions', 'Notifications', 'Gists / Wikis / Pages'],
  },
  '4. Modern dev (10-15%)': {
    done: [],
    todo: ['Actions', 'Copilot', 'Copilot plans', 'Codespaces', 'Dev containers', 'github.dev'],
  },
  '5. Projects (5-10%)': {
    done: [],
    todo: ['Projects layouts', 'Labels', 'Milestones', 'Saved replies', 'Workflows', 'Insights'],
  },
  '6. Security (10-15%)': {
    done: ['gh auth login'],
    todo: ['2FA & passkeys', 'Roles', 'Branch protection', 'Enterprise Managed Users', 'Org settings', 'Visibility'],
  },
  '7. Community (5-10%)': {
    done: [],
    todo: ['Open source', 'Sponsors', 'Marketplace', 'InnerSource', 'Forks & templates'],
  },
};

const count = db.prepare('SELECT COUNT(*) AS n FROM topics').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO topics (domain, name, covered) VALUES (?, ?, ?)');
  const seedAll = db.transaction(() => {
    for (const [domain, g] of Object.entries(SEED)) {
      g.done.forEach(name => insert.run(domain, name, 1));
      g.todo.forEach(name => insert.run(domain, name, 0));
    }
  });
  seedAll();
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/topics', (req, res) => {
  const rows = db.prepare('SELECT * FROM topics ORDER BY id').all();
  res.json(rows);
});

app.put('/api/topics/:id', (req, res) => {
  const { note, covered } = req.body;
  const result = db
    .prepare("UPDATE topics SET note = ?, covered = ?, updated_at = datetime('now') WHERE id = ?")
    .run(note, covered ? 1 : 0, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.post('/api/export', (req, res) => {
  const rows = db.prepare('SELECT * FROM topics ORDER BY id').all();
  let md = '# GH-900 notes\n';
  let lastDomain = null;
  for (const t of rows) {
    if (t.domain !== lastDomain) {
      md += `\n## ${t.domain}\n`;
      lastDomain = t.domain;
    }
    md += `\n### ${t.name}\n\n${t.covered ? 'Covered' : 'Not covered yet'}\n`;
    if (t.note.trim()) md += `\n${t.note.trim()}\n`;
  }
  fs.writeFileSync(path.join(__dirname, 'notes.md'), md);
  res.json({ ok: true, topics: rows.length });
});

app.listen(3000, () => {
  console.log('GH-900 notes running at http://localhost:3000');
});