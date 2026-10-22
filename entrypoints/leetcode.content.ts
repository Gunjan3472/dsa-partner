export default defineContentScript({
  matches: ['*://*.leetcode.com/problems/*'],
  main() {
    let description = '';
    let latestCode = '';
    let latestLanguage = '';
    let slug = location.pathname.split('/')[2];
    let title = '';

    const getTitle = () => document.title.replace(' - LeetCode', '');

    // ---------- Panel (Shadow DOM keeps LeetCode's CSS out) ----------
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:70px;right:12px;z-index:2147483647;';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
        .panel {
          width: 340px; max-height: calc(100vh - 100px); display: flex; flex-direction: column;
          background: rgba(30, 27, 75, 0.82); backdrop-filter: blur(10px);
          border-radius: 16px; overflow: hidden; color: #fff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15);
        }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; background: linear-gradient(90deg, #7c3aed, #2563eb); font-weight: 700;
        }
        .min { background: rgba(255,255,255,0.25); color: #fff; border: 0; border-radius: 6px;
               width: 26px; height: 26px; cursor: pointer; font-size: 16px; line-height: 1; }
        .body { padding: 12px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .status { font-size: 12px; opacity: 0.85; line-height: 1.5; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; margin-bottom: 4px; }
        .row { display: flex; flex-wrap: wrap; gap: 6px; }
        button.act {
          border: 0; border-radius: 8px; padding: 7px 11px; cursor: pointer;
          font-weight: 600; font-size: 13px; color: #fff; transition: transform 0.1s, opacity 0.2s;
        }
        button.act:hover { transform: translateY(-1px); }
        button.act:disabled { opacity: 0.5; cursor: wait; transform: none; }
        .c-nudge { background: #10b981; }
        .c-concept { background: #0ea5e9; }
        .c-approach { background: #8b5cf6; }
        .c-pseudo { background: #ec4899; }
        .c-review { background: #f59e0b; }
        .c-teach { background: #14b8a6; }
        textarea {
          width: 100%; border: 0; border-radius: 8px; padding: 8px; font-size: 13px;
          resize: vertical; background: rgba(255,255,255,0.92); color: #111; min-height: 64px;
        }
        .answer {
          background: rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; font-size: 13px;
          line-height: 1.5; white-space: pre-wrap; max-height: 280px; overflow-y: auto; min-height: 44px;
        }
        .fab {
          display: none; width: 52px; height: 52px; border-radius: 50%; border: 0; cursor: pointer;
          background: linear-gradient(135deg, #7c3aed, #2563eb); color: #fff; font-weight: 800;
          font-size: 13px; box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        }
        .collapsed .panel { display: none; }
        .collapsed .fab { display: block; }
      </style>

      <div id="wrap">
        <div class="panel">
          <div class="header"><span>DSA Partner</span><button class="min" id="min" title="Minimize">–</button></div>
          <div class="body">
            <div class="status" id="status">Looking for the problem...</div>

            <div>
              <div class="label">Hints</div>
              <div class="row" id="hints"></div>
            </div>

            <div>
              <div class="label">Check my work</div>
              <div class="row" id="review"></div>
            </div>

            <div>
              <div class="label">Teach-back</div>
              <textarea id="explain" placeholder="Explain your approach in your own words..."></textarea>
              <div class="row" style="margin-top:6px" id="teach"></div>
            </div>

            <div class="answer" id="answer">Pick a hint level to get started.</div>
          </div>
        </div>
        <button class="fab" id="fab" title="Open DSA Partner">DSA</button>
      </div>
    `;

    const $ = (id: string) => root.getElementById(id) as HTMLElement;
    const wrap = $('wrap');
    const statusEl = $('status');
    const answerEl = $('answer');
    const explainEl = $('explain') as HTMLTextAreaElement;

    // Stop LeetCode's keyboard shortcuts from reacting while typing in the panel
    ['keydown', 'keyup', 'keypress'].forEach((evt) =>
      explainEl.addEventListener(evt, (e) => e.stopPropagation())
    );

    $('min').addEventListener('click', () => wrap.classList.add('collapsed'));
    $('fab').addEventListener('click', () => wrap.classList.remove('collapsed'));

    // ---------- Buttons ----------
    const buttons: HTMLButtonElement[] = [];

    function addButton(parentId: string, label: string, cls: string, onClick: () => void) {
      const b = document.createElement('button');
      b.className = `act ${cls}`;
      b.textContent = label;
      b.addEventListener('click', onClick);
      $(parentId).appendChild(b);
      buttons.push(b);
    }

    async function ask(levelId: string, label: string, explanation = '') {
      buttons.forEach((x) => (x.disabled = true));
      answerEl.textContent = 'Thinking...';
      try {
        const reply = await browser.runtime.sendMessage({
          type: 'get-hint',
          level: levelId,
          title,
          description,
          code: latestCode,
          language: latestLanguage,
          explanation,
        });
        answerEl.textContent = reply?.ok
          ? `${label}\n\n${reply.text}`
          : `Problem: ${reply?.error ?? 'no reply'}`;
      } catch (e) {
        answerEl.textContent = `Problem: ${String(e)}`;
      }
      buttons.forEach((x) => (x.disabled = false));
    }

    addButton('hints', 'Nudge', 'c-nudge', () => ask('nudge', 'Nudge'));
    addButton('hints', 'Concept', 'c-concept', () => ask('concept', 'Concept'));
    addButton('hints', 'Approach', 'c-approach', () => ask('approach', 'Approach'));
    addButton('hints', 'Pseudocode', 'c-pseudo', () => ask('pseudocode', 'Pseudocode'));
    addButton('review', 'Review my code', 'c-review', () => ask('review', 'Code review'));
    addButton('teach', 'Check my explanation', 'c-teach', () => {
      const text = explainEl.value.trim();
      if (!text) {
        answerEl.textContent = 'Write your approach in the box first, then click this button.';
        return;
      }
      ask('teachback', 'Teach-back', text);
    });

    // ---------- Status line ----------
    function updateStatus() {
      const codeInfo = latestLanguage
        ? `${latestLanguage}, ${latestCode.length} characters`
        : 'waiting for the editor...';
      const descInfo = description ? 'found' : 'not found yet';
      statusEl.textContent = `Problem: ${title}\nDescription: ${descInfo}\nYour code: ${codeInfo}`;
      statusEl.style.whiteSpace = 'pre-line';
    }

    // ---------- Read the problem description ----------
    let descTimer: ReturnType<typeof setInterval> | undefined;

    function loadDescription() {
      description = '';
      title = getTitle();
      updateStatus();
      if (descTimer) clearInterval(descTimer);
      let tries = 0;
      descTimer = setInterval(() => {
        tries++;
        const el = document.querySelector('[data-track-load="description_content"]');
        const text = el?.textContent?.trim();
        if (text) {
          description = text;
          title = getTitle();
          updateStatus();
          clearInterval(descTimer);
        } else if (tries >= 20) {
          clearInterval(descTimer);
        }
      }, 500);
    }

    loadDescription();

    // ---------- Read the editor code ----------
    window.addEventListener('message', (event) => {
      if (event.data?.source !== 'dsa-partner') return;
      latestCode = event.data.code;
      latestLanguage = event.data.language;
      updateStatus();
    });

    // ---------- Detect LeetCode switching problems (no page reload) ----------
    setInterval(() => {
      const newSlug = location.pathname.split('/')[2];
      if (newSlug && newSlug !== slug) {
        slug = newSlug;
        answerEl.textContent = 'Pick a hint level to get started.';
        explainEl.value = '';
        loadDescription();
      }
    }, 1000);
  },
});