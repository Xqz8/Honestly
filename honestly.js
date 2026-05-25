let activeTag = null;
    let activeId = null;
    let prevView = 'browse';
    let selectedTag = 'custom';
    let storageReady = false;

    /* ════════════════════════════════════════
       LOGO ANIMATION
       ════════════════════════════════════════ */
    function animateLogo() {
      const text = 'Honestly.';
      const el = document.getElementById('logo-text');
      el.innerHTML = text.split('').map(c =>
        `<span class="letter">${c === ' ' ? '&nbsp;' : escHtml(c)}</span>`
      ).join('');
    }

    /* ════════════════════════════════════════
       STORAGE
       ════════════════════════════════════════ */
    function getAnswers() {
      try { return JSON.parse(localStorage.getItem('honestly_v4') || '{}'); } catch (e) { return {}; }
    }

    function getCustomQs() {
      try { return JSON.parse(localStorage.getItem('honestly_custom_qs') || '[]'); } catch (e) { return []; }
    }

    function saveCustomQs(arr) {
      try { localStorage.setItem('honestly_custom_qs', JSON.stringify(arr)); } catch (e) { }
      if (window.storage) window.storage.set('honestly_custom_qs', JSON.stringify(arr)).catch(() => { });
    }

    async function persistAnswers(obj) {
      try { localStorage.setItem('honestly_v4', JSON.stringify(obj)); } catch (e) { }
      if (window.storage) {
        try { await window.storage.set('honestly_answers_v4', JSON.stringify(obj)); } catch (e) { }
      }
      flashSaved();
    }

    async function loadFromPersistent() {
      const statusEl = document.getElementById('storage-status');
      if (!window.storage) {
        statusEl.textContent = 'Browser storage only';
        return;
      }
      try {
        const themeR = await window.storage.get('honestly_theme');
        if (themeR?.value) setTheme(themeR.value);

        const ansR = await window.storage.get('honestly_answers_v4');
        if (ansR?.value) {
          try { localStorage.setItem('honestly_v4', JSON.stringify(JSON.parse(ansR.value))); } catch (e) { }
        }

        const cqR = await window.storage.get('honestly_custom_qs');
        if (cqR?.value) {
          try { localStorage.setItem('honestly_custom_qs', JSON.stringify(JSON.parse(cqR.value))); } catch (e) { }
        }
        storageReady = true;
        statusEl.textContent = 'Persistent storage active';
      } catch (e) {
        statusEl.textContent = 'Browser storage only';
      }
    }

    function flashSaved() {
      const dot = document.getElementById('save-dot');
      const lbl = document.getElementById('save-label');
      dot.classList.add('show');
      lbl.textContent = 'Saved';
      clearTimeout(window._saveT);
      window._saveT = setTimeout(() => {
        dot.classList.remove('show');
        lbl.textContent = '';
      }, 2500);
    }

    /* ════════════════════════════════════════
       THEME
       ════════════════════════════════════════ */
    function setTheme(theme) {
      // 1. Set the theme attribute on the document
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('honestly_theme', theme);

      // 2. Remove 'active' class from all theme buttons
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
      });

      // 3. Add 'active' class to the button that matches the selected theme
      const activeBtn = document.querySelector(`.theme-btn[onclick="setTheme('${theme}')"]`);
      if (activeBtn) {
        activeBtn.classList.add('active');
      }
    }

    function loadTheme() {
      let t = 'light';
      try { t = localStorage.getItem('honestly_theme') || 'light'; } catch (e) { }
      setTheme(t);
    }

    /* ════════════════════════════════════════
       SIDEBAR
       ════════════════════════════════════════ */
    function toggleSB() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('overlay').classList.toggle('on');
    }

    function closeSB() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('on');
    }

    /* ════════════════════════════════════════
       GO HOME
       ════════════════════════════════════════ */
    function goHome() {
      activeTag = null;
      document.getElementById('search').value = '';
      document.getElementById('browse-title').textContent = 'All Questions';
      document.getElementById('browse-sub').textContent = 'Tap any question to write your honest answer.';
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('nb-browse').classList.add('active');
      goView('browse', document.getElementById('nb-browse'));
    }

    /* ════════════════════════════════════════
       VIEW CONTROLLER
       ════════════════════════════════════════ */
    function goView(v, btn) {
      const activeEl = document.querySelector('.view.active');
      if (activeEl && activeEl.id !== 'view-write') {
        prevView = activeEl.id.replace('view-', '');
      }

      document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
      document.getElementById('view-' + v).classList.add('active');

      if (btn) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }

      if (v === 'browse') renderBrowse();
      if (v === 'entries') renderEntries();
      if (v === 'stats') renderStats();

      window.scrollTo(0, 0);
      closeSB();
    }

    function goBack() {
      const dest = (['entries', 'browse', 'add', 'stats'].includes(prevView)) ? prevView : 'browse';
      goView(dest, document.getElementById('nb-' + dest));
    }

    function filterTag(tag, btn) {
      activeTag = (activeTag === tag) ? null : tag;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      if (activeTag) {
        btn.classList.add('active');
        document.getElementById('browse-title').textContent = LABELS[tag] + ' Questions';
        document.getElementById('browse-sub').textContent = 'Filtered by theme.';
      } else {
        document.getElementById('nb-browse').classList.add('active');
        document.getElementById('browse-title').textContent = 'All Questions';
        document.getElementById('browse-sub').textContent = 'Tap any question to write your honest answer.';
      }
      goView('browse', null);
    }

    /* ════════════════════════════════════════
       ALL QUESTIONS
       ════════════════════════════════════════ */
    function getAllQs() {
      const custom = getCustomQs().map(c => ({ ...c, isCustom: true }));
      return [...BUILTIN_QS, ...custom];
    }

    /* ════════════════════════════════════════
       SEARCH
       ════════════════════════════════════════ */
    function onSearch(val) {
      if (!document.getElementById('view-browse').classList.contains('active')) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('view-browse').classList.add('active');
        document.getElementById('nb-browse').classList.add('active');
      }
      renderBrowse();
    }

    /* ════════════════════════════════════════
       BROWSE
       ════════════════════════════════════════ */
    function highlightText(text, query) {
      if (!query) return escHtml(text);
      return escHtml(text).replace(
        new RegExp(escHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        m => `<span class="search-highlight">${m}</span>`
      );
    }

    function renderBrowse() {
      const grid = document.getElementById('browse-grid');
      grid.innerHTML = '';
      const query = document.getElementById('search').value.trim().toLowerCase();
      const all = getAllQs();
      const answers = getAnswers();

      let filtered = all.filter(q => {
        const matchesTag = !activeTag || q.t === activeTag;
        const matchesSearch = !query || q.q.toLowerCase().includes(query);
        return matchesTag && matchesSearch;
      });

      if (filtered.length === 0) {
        grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <span class="empty-q">No questions</span>
        <p>Try searching for a different keyword or check your custom questions.</p>
      </div>`;
        return;
      }

      filtered.forEach(q => {
        const ansList = answers[q.id] || [];
        const isAns = ansList.length > 0;
        const isMulti = ansList.length > 1;

        const div = document.createElement('div');
        div.className = `pcard ${isAns ? 'answered' : ''} ${isMulti ? 'multi-answered' : ''}`;
        div.setAttribute('data-tag', q.t);
        div.onclick = () => openWrite(q.id);

        let prev = '';
        if (isAns) {
          prev = `<div class="ppreview">${escHtml(ansList[ansList.length - 1].text)}</div>
              <div class="preview-count">${ansList.length} ${ansList.length === 1 ? 'answer' : 'answers'} recorded</div>`;
        }

        div.innerHTML = `
      <span class="ptag tag-${q.t}">${LABELS[q.t] || 'Custom'}</span>
      <span class="multi-badge">${ansList.length}</span>
      <div class="ptext">${highlightText(q.q, query)}</div>
      ${prev}
      <span class="pnum">#${q.id}</span>
    `;
        grid.appendChild(div);
      });
    }

    /* ════════════════════════════════════════
       WRITE ANSWER VIEW
       ════════════════════════════════════════ */
    function openWrite(id) {
      activeId = id;
      const q = getAllQs().find(x => x.id == id);
      if (!q) return;

      document.getElementById('write-q').innerHTML = `
    <span class="ptag tag-${q.t}">${LABELS[q.t] || 'Custom'}</span>
    <div class="big-q">${escHtml(q.q)}</div>
  `;

      document.getElementById('ta').value = '';
      document.getElementById('wc').textContent = '0 words';

      renderPastAnswers(id);
      goView('write', null);
    }

    function updateWC() {
      const t = document.getElementById('ta').value.trim();
      const words = t ? t.split(/\s+/).length : 0;
      document.getElementById('wc').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    }

    function renderPastAnswers(id) {
      const section = document.getElementById('past-answers-section');
      section.innerHTML = '';
      const all = getAnswers();
      const entries = all[id] || [];

      if (entries.length === 0) return;

      const header = document.createElement('div');
      header.className = 'past-answers-title';
      header.textContent = `Your past answers (${entries.length})`;
      section.appendChild(header);

      entries.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'past-answer-item';
        div.innerHTML = `
      <div class="past-answer-meta">
        <span class="past-answer-index">Entry ${index + 1}</span>
        <span>•</span>
        <span>${fmtDate(item.date)}</span>
      </div>
      <button class="del-past-btn" onclick="deletePastAnswer(${id}, ${index})" title="Delete entry">×</button>
      <div class="past-answer-text">${escHtml(item.text)}</div>
    `;
        section.appendChild(div);
      });
    }

    async function deletePastAnswer(id, index) {
      if (!confirm('Are you sure you want to delete this specific answer? This cannot be undone.')) return;
      const all = getAnswers();
      if (all[id]) {
        all[id].splice(index, 1);
        if (all[id].length === 0) delete all[id];
        await persistAnswers(all);
        renderPastAnswers(id);
        updateBadges();
      }
    }

    async function saveAnswer() {
      const val = document.getElementById('ta').value.trim();
      if (!val) return;

      const all = getAnswers();
      if (!all[activeId]) all[activeId] = [];

      all[activeId].push({
        text: val,
        date: new Date().toISOString()
      });

      await persistAnswers(all);

      const t = document.getElementById('toast');
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);

      document.getElementById('ta').value = '';
      updateWC();
      renderPastAnswers(activeId);
      updateBadges();
    }

    /* ════════════════════════════════════════
       MY ENTRIES
       ════════════════════════════════════════ */
    function renderEntries() {
      const c = document.getElementById('entries-container');
      c.innerHTML = '';
      const answers = getAnswers();
      const all = getAllQs();

      const activeIds = Object.keys(answers).filter(id => {
        return Array.isArray(answers[id]) && answers[id].length > 0;
      });

      if (activeIds.length === 0) {
        c.innerHTML = `
      <div class="empty">
        <span class="empty-q">Quiet here</span>
        <p>You haven't answered any questions yet.</p>
      </div>`;
        return;
      }

      activeIds.sort((a, b) => {
        const d1 = new Date(answers[a][answers[a].length - 1].date);
        const d2 = new Date(answers[b][answers[b].length - 1].date);
        return d2 - d1;
      });

      activeIds.forEach(id => {
        const q = all.find(x => x.id == id);
        if (!q) return;

        const div = document.createElement('div');
        div.className = 'ecard';

        const entries = answers[id];
        const newest = entries[entries.length - 1];

        div.innerHTML = `
      <div class="ehead" onclick="openAnswersModal(${q.id})">
        <div class="eq">
          <span class="ptag tag-${q.t}">${LABELS[q.t] || 'Custom'}</span>
          <div style="font-size:16px; color:var(--text); margin-top:4px">${escHtml(q.q)}</div>
        </div>
        <div class="emeta">
          <span>Last active</span>
          <div class="ts-chip">
            <span style="font-size:11px">🕒</span> ${fmtDate(newest.date)}
          </div>
          <span class="ans-count">${entries.length} ${entries.length === 1 ? 'answer' : 'answers'}</span>
        </div>
      </div>
      <div class="efoot">
        <button class="entry-redirect-btn" onclick="openWrite(${q.id})" title="Add an entry to this question">
          <span>Add entry</span>
        </button>
        <button class="btn btn-cancel" style="padding: 5px 12px; font-size: 12px; border-radius:8px" onclick="openAnswersModal(${q.id})">
          View all entries
        </button>
      </div>
    `;
        c.appendChild(div);
      });
    }

    function openAnswersModal(id) {
      const q = getAllQs().find(x => x.id == id);
      if (!q) return;

      const answers = getAnswers();
      const entries = answers[id] || [];

      document.getElementById('answers-modal-q').textContent = q.q;
      document.getElementById('answers-modal-count').textContent = `${entries.length} recorded ${entries.length === 1 ? 'entry' : 'entries'}`;

      const scrollContainer = document.getElementById('answers-scroll');
      scrollContainer.innerHTML = '';

      entries.forEach((entry, idx) => {
        const card = document.createElement('div');
        card.className = 'answer-entry-card';

        const words = entry.text.trim().split(/\s+/).length;

        card.innerHTML = `
      <div class="answer-entry-header">
        <span class="answer-entry-num">Entry ${idx + 1}</span>
        <span class="answer-entry-date">${fmtDate(entry.date)}</span>
        <span class="answer-entry-words">${words} words</span>
      </div>
      <button class="del-past-btn" onclick="deletePastAnswerFromModal(${id}, ${idx})" title="Delete entry">×</button>
      <div class="answer-entry-text">${escHtml(entry.text)}</div>
    `;
        scrollContainer.appendChild(card);
      });

      const writeBtn = document.getElementById('answers-modal-write-btn');
      writeBtn.onclick = () => {
        document.getElementById('modal-answers').classList.remove('open');
        openWrite(id);
      };

      const delBtn = document.getElementById('answers-modal-del-btn');
      delBtn.onclick = () => {
        if (confirm('Delete ALL entries for this question? This cannot be undone.')) {
          const all = getAnswers();
          delete all[id];
          persistAnswers(all).then(() => {
            document.getElementById('modal-answers').classList.remove('open');
            renderEntries();
            updateBadges();
          });
        }
      };

      document.getElementById('modal-answers').classList.add('open');
    }

    async function deletePastAnswerFromModal(id, index) {
      if (!confirm('Are you sure you want to delete this specific entry?')) return;
      const all = getAnswers();
      if (all[id]) {
        all[id].splice(index, 1);
        if (all[id].length === 0) {
          delete all[id];
          document.getElementById('modal-answers').classList.remove('open');
        }
        await persistAnswers(all);
        renderEntries();
        updateBadges();

        if (all[id]) {
          openAnswersModal(id);
        }
      }
    }

    /* ════════════════════════════════════════
       STATS VIEW
       ════════════════════════════════════════ */
    function renderStats() {
      const row = document.getElementById('stats-nums');
      const bars = document.getElementById('bars');
      row.innerHTML = '';
      bars.innerHTML = '';

      const answers = getAnswers();
      const allQs = getAllQs();

      let totalWords = 0;
      let ansCount = 0;
      Object.keys(answers).forEach(id => {
        (answers[id] || []).forEach(item => {
          ansCount++;
          totalWords += (item.text || '').trim().split(/\s+/).filter(Boolean).length;
        });
      });

      const uniqueAnsCount = Object.keys(answers).filter(id => (answers[id] || []).length > 0).length;
      const perc = allQs.length ? Math.round((uniqueAnsCount / allQs.length) * 100) : 0;

      row.innerHTML = `
    <div class="scard"><div class="snum">${ansCount}</div><div class="slabel">Entries recorded</div></div>
    <div class="scard"><div class="snum">${uniqueAnsCount}</div><div class="slabel">Questions answered</div></div>
    <div class="scard"><div class="snum">${perc}%</div><div class="slabel">Journal complete</div></div>
    <div class="scard"><div class="snum">${totalWords}</div><div class="slabel">Words written</div></div>
  `;

      const counts = { love: 0, feelings: 0, relationships: 0, life: 0, custom: 0 };
      const maxes = { love: 0, feelings: 0, relationships: 0, life: 0, custom: 0 };

      allQs.forEach(q => {
        if (counts[q.t] !== undefined) {
          maxes[q.t]++;
          if (answers[q.id] && answers[q.id].length > 0) {
            counts[q.t]++;
          }
        }
      });

      Object.keys(counts).forEach(tag => {
        const c = counts[tag];
        const m = maxes[tag];
        const w = m ? Math.round((c / m) * 100) : 0;

        const div = document.createElement('div');
        div.className = 'bar-row';
        div.innerHTML = `
      <div class="bar-lbl">${LABELS[tag]}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${w}%; background:${COLORS[tag]}"></div>
      </div>
      <div class="bar-ct">${c}/${m}</div>
    `;
        bars.appendChild(div);
      });
    }

    /* ════════════════════════════════════════
       ADD QUESTION
       ════════════════════════════════════════ */
    function selectTag(btn) {
      document.querySelectorAll('#tag-picker .tag-option').forEach(b => {
        b.className = 'tag-option';
      });
      selectedTag = btn.getAttribute('data-tag');
      btn.className = `tag-option sel-${selectedTag}`;
    }

    async function saveCustomQ() {
      const txt = document.getElementById('add-q-ta').value.trim();
      if (!txt) return;

      const arr = getCustomQs();
      const id = 1000 + Date.now() % 100000;

      arr.push({ id, t: selectedTag, q: txt });
      saveCustomQs(arr);

      document.getElementById('add-q-ta').value = '';
      updateBadges();

      goView('browse', document.getElementById('nb-browse'));
    }

    function clearAddForm() {
      document.getElementById('add-q-ta').value = '';
    }

    /* ════════════════════════════════════════
       RANDOM MODAL
       ════════════════════════════════════════ */
    function pickRandom() {
      const all = getAllQs();
      if (all.length === 0) return;
      const rand = all[Math.floor(Math.random() * all.length)];
      activeId = rand.id;

      document.getElementById('modal-q-text').textContent = rand.q;
      document.getElementById('modal-random').classList.add('open');
    }

    function openFromModal() {
      document.getElementById('modal-random').classList.remove('open');
      if (activeId) openWrite(activeId);
    }

    /* ════════════════════════════════════════
       BADGES & COUNTS
       ════════════════════════════════════════ */
    function updateBadges() {
      const allQs = getAllQs();
      const answers = getAnswers();
      const ids = Object.keys(answers).filter(k => Array.isArray(answers[k]) && answers[k].length > 0);

      document.getElementById('bdg-entries').textContent = ids.length;
      document.getElementById('bdg-total').textContent = allQs.length;

      const tc = { love: 0, feelings: 0, relationships: 0, life: 0, custom: 0 };
      allQs.forEach(q => {
        if (tc[q.t] !== undefined) tc[q.t]++;
      });

      Object.keys(tc).forEach(t => {
        const el = document.getElementById('bdg-' + t);
        if (el) el.textContent = tc[t];
      });

      const customQs = getCustomQs();
      const custEl = document.getElementById('bdg-custom');
      if (custEl) custEl.textContent = customQs.length;
    }

    /* ════════════════════════════════════════
       UTILS
       ════════════════════════════════════════ */
    function fmtDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function escHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /* ════════════════════════════════════════
       INITIALIZATION
       ════════════════════════════════════════ */
    window.addEventListener('DOMContentLoaded', () => {
      animateLogo();
      loadTheme();
      loadFromPersistent().then(() => {
        updateBadges();
        goView('browse', document.getElementById('nb-browse'));
      });

      // Theme auto toggle from browser setting if not explicitly saved
      if (!localStorage.getItem('honestly_theme')) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) setTheme('dark');
      }
    });