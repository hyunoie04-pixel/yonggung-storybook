/* 웹 스토리북 — 고전파(古典波), 주사란 원고판.
   흐름: 첫 화면 → 수업·팀 → 도구 → 김시습 만나기 → 장면 영상 ×5(끝나면 김시습과 대화) → 해석 → 제작 과정 → 출처.
   대화는 직접 입력한다. 외부 API 없이, 입력한 질문을 data.js의 질문·답변과 비교해 가장 가까운 답을 고른다.
   인터넷 없이 index.html만 열어도 동작한다. 영상 파일이 없으면 먹그림 임시 화면으로 같은 흐름이 돈다. */
(function () {
  'use strict';
  var D = window.STORYBOOK, ART = window.ART, FX = window.FX;
  var deck = document.getElementById('deck');
  var pagesEl = document.getElementById('pages');
  var dotsEl = document.getElementById('dots');
  var toastEl = document.getElementById('toast');
  var psTitle = document.getElementById('ps-title'), psNo = document.getElementById('ps-no');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PORTRAITS = { main: 'assets/kimsisup-neutral.png', alt: 'assets/kimsisup-downcast.png' };
  var BRUSH = 'assets/gojeonpa-2.png';
  var HANJA_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'];
  var AI_NOTE = 'AI가 상상해 그린 모습입니다. 실제 초상이 아닙니다.';

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag), a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === false || v == null) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(e, x); }); return; }
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  function art(html, cls) { return h('div', { class: cls || '', html: html, 'aria-hidden': 'true' }); }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }
  function fit() { deck.style.transform = 'scale(' + Math.min(window.innerWidth / 1280, window.innerHeight / 720) + ')'; }
  window.addEventListener('resize', fit); fit();
  pagesEl.style.setProperty('--paper-noise', ART.paperNoise());

  /* 대사를 한 화면(4줄)에 들어가는 길이로 나눈다 */
  function toChunks(t) {
    var out = [];
    String(t).split(/\n\n+/).forEach(function (p) {
      p = p.trim(); if (!p) return;
      if (p.length <= 100) { out.push(p); return; }
      var sents = p.match(/[^.?!]+[.?!]+(\s|$)|[^.?!]+$/g) || [p], buf = '';
      sents.forEach(function (s) { if (buf && (buf + s).length > 112) { out.push(buf.trim()); buf = s; } else buf += s; });
      if (buf.trim()) out.push(buf.trim());
    });
    return out.reduce(function (acc, s) {
      while (s.length > 128) {
        var cut = s.lastIndexOf(', ', 118); if (cut < 40) cut = s.lastIndexOf(' ', 118);
        acc.push(s.slice(0, cut + 1).trim()); s = s.slice(cut + 1).trim();
      }
      acc.push(s); return acc;
    }, []);
  }

  /* ---------- 답변 찾기: 외부 API 없이 브라우저 안에서 동작하는 자체 챗봇 ----------
     1) 인사·감사·작별·정체 질문은 먼저 따로 받는다.
     2) 나머지는 모든 질문·답변과 비교해 점수를 매긴다.
        핵심 낱말이 들어 있으면 낱말 길이만큼, 대표 질문·다른 말투와 글자 두 개씩 겹치는 정도(다이스 계수)만큼 더하고,
        지금 보고 있는 장면의 질문이면 조금 더 준다.
     3) 확실하면 답하고, 애매하면 가까운 질문 셋을 단추로 되묻고, 전혀 모르면 범위 밖이라고 답한다. */
  var POOL = [];
  var SCENE_GENERIC = ['이장면', '장면의의미', '장면의뜻', '무슨뜻', '왜이렇게', '의도', '연출', '기분', '심정', '느낌', '마음이'];
  function norm(s) { return String(s).toLowerCase().replace(/[?？!.,~'"“”‘’·…()\s]/g, ''); }
  function grams(s) { var g = {}, n = 0; for (var i = 0; i < s.length - 1; i++) { var k = s.substr(i, 2); if (!g[k]) { g[k] = 1; n++; } } return { g: g, n: n }; }
  function dice(A, B) { if (!A.n || !B.n) return 0; var c = 0; for (var k in A.g) if (B.g[k]) c++; return 2 * c / (A.n + B.n); }
  function addEntry(scene, e, extraKw) {
    var texts = [e.q].concat(e.alts || []).map(norm);
    var kw = (e.kw || []).map(norm).concat(extraKw || []).filter(Boolean);
    POOL.push({ scene: scene, q: e.q, a: e.a, kw: kw, texts: texts, forms: texts.map(grams) });
  }
  (D.common || []).forEach(function (e) { addEntry('any', e); });
  D.person.questions.forEach(function (e) { addEntry('person', e); });
  D.scenes.forEach(function (s) {
    addEntry(s.id, { q: s.autoQuestion, a: s.answer, kw: s.kw, alts: [s.title + ' 장면은 무슨 뜻인가요', '이 장면은 왜 이렇게 만들었나요'] }, SCENE_GENERIC);
    s.followups.forEach(function (f) { addEntry(s.id, f); });
  });
  function rank(q, ctx) {
    var n = norm(q), G = grams(n);
    return POOL.map(function (e) {
      var kw = 0, sim = 0;
      e.kw.forEach(function (k) { if (n.indexOf(k) >= 0) kw += Math.min(k.length, 4); });
      e.forms.forEach(function (F) { sim = Math.max(sim, dice(G, F)); });
      var ctxBonus = e.scene === ctx ? 1.5 : (e.scene === 'any' ? 0.3 : 0);
      if (e.kw.indexOf('의도') >= 0 && e.scene !== ctx) kw = Math.max(0, kw - 4);   // '이 장면'류 질문은 지금 장면으로만 보낸다
      return { e: e, kw: kw, sim: sim, score: kw + sim * 10 + (kw || sim > .25 ? ctxBonus : 0) };
    }).sort(function (a, b) { return b.score - a.score; });
  }
  function findStored(q, ctx) {
    var n = norm(q), T = D.smalltalk || {};
    if (!n) return null;
    /* 준비한 질문(대표 질문·다른 말투)을 그대로 물으면 어느 쪽에서든 그 답을 낸다. 같은 질문이 여러 곳에 있으면 지금 장면 것을 고른다 */
    var exact = POOL.filter(function (e) { return e.texts.indexOf(n) >= 0; });
    if (exact.length) {
      var pick = exact.filter(function (e) { return e.scene === ctx; })[0] || exact[0];
      return { q: q, a: pick.a, key: pick.q };
    }
    if (/(안녕히|잘가|잘있|바이바이|bye)/.test(n)) return { q: q, a: T.bye };
    if (/^(안녕|반갑|여보세요|처음뵙|하이|hello|hi)/.test(n) && n.length < 12) return { q: q, a: T.hello };
    if (/(고마|감사|땡큐|thank)/.test(n) && n.length < 14) return { q: q, a: T.thanks };
    if (/(^|너|넌|당신)(ai|인공지능|챗봇|로봇)|진짜김시습|가짜|본인맞/.test(n)) return { q: q, a: T.who };
    if (/(누가만들|만든사람|만든팀|제작자|누가제작)/.test(n)) return { q: q, a: T.made };
    var r = rank(q, ctx), top = r[0], second = r[1] || { score: 0 };
    var sure = top && (top.kw >= 3 || top.sim >= .5 || (top.kw >= 2 && top.sim >= .2) || (top.score >= 3 && top.score - second.score >= 1.5));
    if (sure) return { q: q, a: top.e.a, key: top.e.q };
    var near = r.filter(function (x) { return x.score >= 1.6 && (x.kw >= 2 || x.sim >= .3); }).slice(0, 3).map(function (x) { return x.e.q; });   // '뭐예요' 같은 말끝만 겹친 질문은 권하지 않는다
    if (near.length) return { q: q, a: D.unsure, suggest: near };
    return null;
  }
  function answerFor(q, ctx) {
    var item = findStored(q, ctx) || { q: q, a: D.outOfScope };
    return new Promise(function (res) { setTimeout(function () { res(item); }, reduced ? 0 : 450 + Math.random() * 400); });   // 생각하는 틈
  }
  function chips(list) { return list.map(function (q) { return { label: q, fill: q }; }); }

  /* ---------- 초상 ---------- */
  function createPortrait() {
    var el = h('div', { class: 'portrait', 'aria-hidden': 'true' });
    var main = h('img', { class: 'main', src: PORTRAITS.main, alt: '', width: 1086, height: 1448 });
    var alt = h('img', { class: 'alt', src: PORTRAITS.alt, alt: '', width: 1086, height: 1448 });
    main.addEventListener('error', function () { el.textContent = ''; el.append(h('div', { class: 'fallback', html: ART.silhouette() })); });
    alt.addEventListener('error', function () { el.classList.add('noalt'); });
    el.append(main, alt);
    return { el: el, sad: function (on) { el.classList.toggle('sad', !!on); } };
  }

  /* ---------- 대화창 (김시습의 말 + 직접 입력) ---------- */
  function createDialogue() {
    var qLine = h('p', { class: 'dlg-q' });
    var text = h('div', { class: 'dlg-text' });
    var sr = h('p', { class: 'sr', 'aria-live': 'polite' });
    var next = h('button', { class: 'dlg-next', type: 'button', onclick: function () { api.advance(); } }, '이어서');
    var input = h('input', { class: 'ask-input', type: 'text', autocomplete: 'off', maxlength: '80', 'aria-label': '김시습에게 물어볼 질문' });
    var sendBtn = h('button', { class: 'ask-btn', type: 'button' }, '묻기');
    var goSlot = h('span', { class: 'ask-go' });
    var sugg = h('div', { class: 'ask-sugg', role: 'group', 'aria-label': '질문 예시' });
    var askBox = h('div', { class: 'dlg-ask' },
      h('p', { class: 'ask-hint' }, '직접 물어보시오. 아래 예시를 누르면 입력칸에 들어가니, 고쳐서 물어도 좋소.'),
      h('div', { class: 'ask-row' }, input, sendBtn, goSlot), sugg);
    var el = h('div', { class: 'dlg', role: 'region', 'aria-label': '김시습과의 대화' },
      h('div', { class: 'dlg-name' }, h('span', { html: ART.seal('金') }), h('b', {}, '김시습')),
      qLine, text, sr, askBox, next);
    var queue = [], qi = 0, timer = null, doneTimer = null, typing = false, onDone = null, current = '', autoNext = false, onSubmit = null, locked = false;

    function finishChunk() {
      clearTimeout(timer); typing = false; text.textContent = current;
      if (autoNext && qi === queue.length - 1) {
        var d = onDone; onDone = null; autoNext = false;
        doneTimer = setTimeout(function () { if (d) d(); }, 1500);
      } else el.classList.add('wait');
    }
    function showChunk(i) {
      current = queue[i]; text.textContent = ''; sr.textContent = current; el.classList.remove('wait', 'asking'); typing = true;
      if (reduced) { finishChunk(); return; }
      var node = document.createTextNode(''), cur = h('span', { class: 'cursor' }), n = 0;
      text.append(node, cur);
      (function tick() { n = Math.min(current.length, n + 2); node.data = current.slice(0, n); if (n >= current.length) finishChunk(); else timer = setTimeout(tick, 34); })();
    }
    function submit() {
      if (locked) return;
      var v = input.value.trim();
      if (!v) { toast('질문을 입력해 주세요'); input.focus(); return; }
      locked = true; input.disabled = true; sendBtn.disabled = true;
      try { if (onSubmit) onSubmit(v); } catch (e) { api.unlock(); }
    }
    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); } });

    var api = {
      el: el,
      unlock: function () { locked = false; input.disabled = false; sendBtn.disabled = false; },
      speak: function (item, done, opts) {
        clearTimeout(doneTimer);
        qLine.textContent = ''; if (item.q) qLine.append(h('b', {}, '물음'), item.q);
        qLine.style.display = item.q ? '' : 'none';
        queue = toChunks(item.a); qi = 0; onDone = done || null; autoNext = !!(opts && opts.auto);
        el.classList.remove('asking'); showChunk(0);
      },
      think: function (q) {
        clearTimeout(timer); typing = false; queue = []; qLine.textContent = ''; qLine.append(h('b', {}, '물음'), q); qLine.style.display = '';
        text.textContent = ''; text.append(h('span', { class: 'dots-typing' }, h('span'), h('span'), h('span')));
        el.classList.remove('asking', 'wait');
      },
      advance: function () {
        if (!queue.length || el.classList.contains('asking')) return false;
        if (typing) { finishChunk(); return true; }
        if (el.classList.contains('wait')) {
          if (qi < queue.length - 1) { qi++; showChunk(qi); }
          else { el.classList.remove('wait'); var d = onDone; onDone = null; if (d) d(); }
          return true;
        }
        return false;
      },
      settle: function () { if (typing) finishChunk(); },
      ask: function (o) {
        clearTimeout(timer); typing = false; onSubmit = o.onSubmit; api.unlock();
        input.value = ''; input.placeholder = o.placeholder || '';
        sugg.textContent = '';
        (o.suggestions || []).forEach(function (s) {
          sugg.append(h('button', { class: 'sg', type: 'button', onclick: function () { input.value = s.fill; input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* noop */ } } }, s.label));
        });
        goSlot.textContent = '';
        if (o.go) goSlot.append(h('button', { class: 'ask-next', type: 'button', onclick: o.go.onClick }, o.go.label));
        el.classList.remove('wait'); el.classList.add('asking');
        if (o.focus !== false) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { /* noop */ } }, 80);
      },
      reset: function () {
        clearTimeout(timer); clearTimeout(doneTimer); typing = false; queue = []; qi = 0; onDone = null; autoNext = false; onSubmit = null;
        text.textContent = ''; sr.textContent = ''; qLine.textContent = ''; sugg.textContent = ''; goSlot.textContent = ''; input.value = '';
        el.classList.remove('wait', 'asking'); api.unlock();
      }
    };
    el.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button,input')) return; api.advance(); });
    return api;
  }

  /* ---------- 쪽 ---------- */
  var pages = [], cur = -1;

  /* 첫 화면: 붓글씨 "고전파"가 써지듯 드러난다. 표지(제목·작품)를 함께 담는다 */
  function pOpening() {
    var O = D.opening, C = D.cover;
    var img = h('img', { class: 'op-brush', src: BRUSH, alt: O.team, width: 1888, height: 830 });
    var holder = h('h1', { class: 'op-brush-wrap' }, img);
    img.addEventListener('error', function () { holder.textContent = ''; holder.append(h('span', { class: 'op-fallback' }, O.team)); });
    return { title: '고전파', short: '首', el: h('section', { class: 'page opening' },
      holder,
      art(ART.sealTall(O.hanja.split('')), 'op-seal'),
      h('p', { class: 'op-tag' }, O.tagline),
      h('div', { class: 'op-rule', 'aria-hidden': 'true' }),
      h('p', { class: 'op-work' }, C.title),
      h('p', { class: 'op-sub' }, C.subtitle),
      h('button', { class: 'op-start', type: 'button', onclick: function () { go(cur + 1); } }, '펼쳐 보기'),
      h('p', { class: 'op-course' }, O.kicker),
      h('div', { class: 'op-vert', 'aria-hidden': 'true' }, '龍宮赴宴錄'),
      h('div', { class: 'op-rule2', 'aria-hidden': 'true' })) };
  }

  function pIntro() {
    var t = D.intro, m = /^(.*?)\s*\((.*)\)\s*$/.exec(t.course) || [0, t.course, ''];
    return { title: '수업과 팀', el: h('section', { class: 'page intro' },
      h('div', { class: 'in-left' },
        h('h2', { class: 'in-course' }, m[1]), m[2] ? h('p', { class: 'in-prof' }, m[2]) : null,
        h('p', { class: 'in-desc' }, t.courseDesc)),
      h('div', { class: 'in-right' }, h('h3', {}, t.teamName, h('span', {}, '함께 만든 사람')),
        h('ul', { class: 'toc' }, t.team.map(function (x) {
          return h('li', {}, h('span', { class: 'role' }, x.role), h('span', { class: 'nm' }, x.name, x.dept ? h('small', {}, x.dept) : null), h('span', { class: 'tnote' }, x.note));
        }))),
      h('div', { class: 'motive' }, h('b', {}, t.motiveLabel), h('p', {}, t.motive))) };
  }

  function pTools() {
    var t = D.tools;
    return { title: '만든 도구', el: h('section', { class: 'page tools' },
      h('h2', { class: 'h2' }, '영상 · 챗봇 · 웹 스토리북'),
      h('ul', { class: 'tl-rows' }, t.items.map(function (x) {
        return h('li', {}, h('span', { class: 'nm' }, x.name), h('span', { class: 'tn' }, x.tool), h('span', { class: 'why' }, x.why));
      })),
      h('ol', { class: 'tl-flow', 'aria-label': '발표 흐름' }, t.flow.map(function (s) { return h('li', {}, s); }))) };
  }

  function pInterp() {
    var t = D.interp;
    return { title: '수업의 해석', el: h('section', { class: 'page interp' },
      h('h2', { class: 'h2' }, '원문 읽기와 수업의 해석'),
      h('div', { class: 'vs' },
        h('div', { class: 'vs-box' }, h('div', { class: 'lab' }, t.banner[0].label), h('div', { class: 'txt' }, t.banner[0].text)),
        h('div', { class: 'vs-box new' }, h('div', { class: 'lab' }, t.banner[1].label), h('div', { class: 'txt' }, t.banner[1].text))),
      h('ul', { class: 'rows' }, t.rows.map(function (r) { return h('li', {}, h('span', { class: 'k' }, r.scene), h('span', { class: 'v' }, r.text)); })),
      h('p', { class: 'foot' }, t.foot)) };
  }

  /* 영상 전에 김시습을 먼저 만난다 */
  function pPerson() {
    var P = D.person, portrait = createPortrait(), dlg = createDialogue(), used = {}, started = false, t0 = null, nextSugg = null;
    var section = h('section', { class: 'page person' },
      portrait.el,
      h('div', { class: 'pr-info' },
        h('h2', { class: 'pr-name' }, P.name), h('p', { class: 'pr-yrs' }, P.years), h('p', { class: 'pr-sum' }, P.summary)),
      h('p', { class: 'ai-note' }, AI_NOTE),
      dlg.el);
    function openAsk() {
      var sugg = nextSugg ? chips(nextSugg) : P.questions.filter(function (q) { return !used[q.q]; }).slice(0, 4).map(function (q) { return { label: q.q, fill: q.q }; });
      nextSugg = null;
      dlg.ask({
        placeholder: P.placeholder, suggestions: sugg,
        go: { label: '장면 1 보러 가기', onClick: function () { go(cur + 1); } },
        onSubmit: function (text) {
          dlg.think(text);
          answerFor(text, 'person').then(function (item) { if (item.key) used[item.key] = true; nextSugg = item.suggest || null; dlg.speak(item, openAsk); });
        }
      });
    }
    return { title: '김시습 만나기', el: section,
      onEnter: function () {
        if (started) return; started = true;
        t0 = setTimeout(function () { dlg.speak({ q: '', a: P.greet }, openAsk, { auto: true }); }, 500);
      },
      onLeave: function () { dlg.settle(); },
      space: function () { return dlg.advance(); } };
  }

  /* 장면 쪽: 영상 → (끝) → 영상은 왼쪽 위로 줄고 김시습이 말을 건다 → 직접 물어본다 */
  function pScene(scene, idx) {
    var N = D.scenes.length;
    var usePH = false, state = 'idle', asked = false, capIdx = -2, phTimer = null, talkTimer = null, used = {}, nextSugg = null;
    var portrait = createPortrait(); portrait.sad(scene.mood === 'box' || scene.mood === 'mountain');
    var dlg = createDialogue();
    var video = h('video', { preload: 'metadata', playsinline: true, src: scene.video, 'aria-label': scene.title + ' 장면 영상' });
    var phTag = h('div', { class: 'ph-tag' });
    var ph = h('div', { class: 'ph' }, art(ART.mood(scene.mood), 'motif'), h('div', { class: 'ph-name' }, scene.title), phTag);
    var capText = h('span'); var cap = h('div', { class: 'cap', 'aria-live': 'off' }, capText);
    var prog = h('i');
    var seek = h('div', { class: 'seek', title: '눌러서 이동' }, prog);
    var playBtn = h('button', { class: 'play', type: 'button', 'aria-label': scene.title + ' 장면 재생' });
    var pausedTag = h('div', { class: 'paused' }, '일시정지 · 눌러서 계속');
    var amb = h('canvas', { class: 'amb', width: 64, height: 36, 'aria-hidden': 'true' }), ambCx = amb.getContext('2d'), ambTimer = null;
    function drawAmb() { try { if (video.readyState >= 2) ambCx.drawImage(video, 0, 0, 64, 36); } catch (e) { /* noop */ } }
    video.addEventListener('loadeddata', drawAmb); video.addEventListener('seeked', drawAmb);
    var veil = h('div', { class: 'veil', 'aria-hidden': 'true' }, h('span', { class: 'veil-num' }, HANJA_NUM[idx]), h('strong', {}, scene.title), h('em', {}, scene.sub));
    var box = h('div', { class: 'video-box' }, video, ph, veil, cap, pausedTag, playBtn, seek);
    var restartBtn = h('button', { class: 'tbtn', type: 'button', onclick: function () { start(); } }, '처음부터');
    var skipBtn = h('button', { class: 'tbtn', type: 'button', onclick: function () { skipToTalk(); } }, '대화로 넘어가기');
    var section = h('section', { class: 'page scene' },
      h('div', { class: 'sc-head' }, h('span', { class: 'num', 'aria-hidden': 'true' }, HANJA_NUM[idx]), h('h2', {}, scene.title), h('span', { class: 'sub' }, '장면 ' + (idx + 1) + ' / ' + N + ' · ' + scene.sub), h('div', { class: 'sc-tools' }, restartBtn, skipBtn)),
      amb, box, portrait.el,
      h('p', { class: 'ai-note' }, AI_NOTE),
      dlg.el);

    function showPH() { usePH = true; video.style.display = 'none'; ph.classList.add('on'); phTag.textContent = '영상 파일을 찾지 못했습니다 (' + scene.video + ')'; }
    video.addEventListener('error', showPH);
    video.addEventListener('timeupdate', function () { if (video.duration && state !== 'talk') setProgress(video.currentTime / video.duration); });
    /* 건너뛸 구간(scene.skip = [시작, 끝] 초): 재생 중 매 프레임 확인해 그 구간에 들어서면 끝으로 넘긴다 */
    var SKIP = scene.skip, skipRaf = 0;
    function skipGuard() {
      if (!SKIP || !video.duration) return;
      if (video.currentTime >= SKIP[0] && video.currentTime < SKIP[1]) video.currentTime = SKIP[1];
    }
    function skipLoop() { skipGuard(); skipRaf = state === 'playing' ? requestAnimationFrame(skipLoop) : 0; }
    if (SKIP) { video.addEventListener('playing', function () { cancelAnimationFrame(skipRaf); skipLoop(); }); video.addEventListener('seeking', skipGuard); }
    video.addEventListener('ended', onEnded);

    /* 자막 시각(at/to)은 초 단위. 임시 화면일 때는 25초 영상으로 보고 맞춘다 */
    function setProgress(f) {
      prog.style.width = (f * 100) + '%';
      var sec = f * (usePH ? 25 : (video.duration || 25));
      var k = -1; scene.caption.forEach(function (c, n) { if (sec >= c.at && sec < (c.to == null ? 1e9 : c.to)) k = n; });
      if (k !== capIdx) { capIdx = k; if (k < 0) cap.classList.remove('on'); else { capText.textContent = scene.caption[k].text; cap.classList.add('on'); } }
    }
    function stopTimers() { clearInterval(phTimer); phTimer = null; clearTimeout(talkTimer); talkTimer = null; }
    var mood = scene.mood;
    function runPH(from) {
      clearInterval(phTimer); var dur = D.placeholderSeconds * 1000, t0 = performance.now() - (from || 0) * dur;
      phTimer = setInterval(function () { var f = Math.min(1, (performance.now() - t0) / dur); setProgress(f); if (f >= 1) { clearInterval(phTimer); onEnded(); } }, 100);
    }
    function setState(s) {
      state = s;
      section.classList.toggle('talk', s === 'talk');
      section.classList.toggle('is-paused', s === 'paused');
      section.classList.toggle('is-idle', s === 'idle');
      clearInterval(ambTimer); if (s === 'playing') ambTimer = setInterval(drawAmb, 120);
      playBtn.style.display = s === 'idle' ? '' : 'none';
      skipBtn.textContent = s === 'talk' ? '장면 다시 보기' : '대화로 넘어가기';
      restartBtn.style.display = (s === 'playing' || s === 'paused') ? '' : 'none';
    }
    function start() {
      stopTimers(); capIdx = -2; setProgress(0); dlg.settle(); setState('playing');
      if (usePH) { runPH(0); return; }
      try { video.currentTime = 0; } catch (e) { /* 메타데이터 전 */ }
      var p = video.play();
      if (p && p.catch) p.catch(function () { if (state === 'playing' && !usePH) { setState('idle'); toast('재생 버튼을 한 번 더 눌러 주세요'); } });
    }
    function togglePause() {
      if (usePH) return;
      if (state === 'playing') { video.pause(); setState('paused'); }
      else if (state === 'paused') { setState('playing'); var p = video.play(); if (p && p.catch) p.catch(function () { setState('paused'); }); }
    }
    function onEnded() {
      if (state === 'talk') return;
      stopTimers(); setProgress(1); cap.classList.remove('on'); setState('talk');
      talkTimer = setTimeout(function () { if (!asked) { asked = true; dlg.speak({ q: '', a: scene.greet }, openAsk, { auto: true }); } else openAsk(); }, 900);
    }
    function skipToTalk() {
      if (state === 'talk') { start(); return; }
      try { video.pause(); } catch (e) { /* noop */ }
      onEnded();
    }
    box.addEventListener('click', function (e) {
      if (state === 'talk') return;
      if (e.target === seek || e.target === prog) {
        var r = seek.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (usePH) { if (state === 'playing') runPH(f); } else if (video.duration) { video.currentTime = f * video.duration; setProgress(f); }
        return;
      }
      if (state === 'idle') start(); else togglePause();
    });
    function entries() { return [{ q: scene.autoQuestion }].concat(scene.followups.map(function (f) { return { q: f.q }; })); }
    function openAsk() {
      var sugg = nextSugg ? chips(nextSugg) : entries().filter(function (e) { return !used[e.q]; }).slice(0, 4).map(function (e) { return { label: e.q, fill: e.q }; });
      nextSugg = null;
      dlg.ask({
        placeholder: '궁금한 점을 입력하세요', suggestions: sugg,
        go: { label: idx < N - 1 ? '다음 장면으로' : '수업의 해석 보기', onClick: function () { go(cur + 1); } },
        onSubmit: function (text) {
          dlg.think(text);
          answerFor(text, scene.id).then(function (item) { if (item.key) used[item.key] = true; nextSugg = item.suggest || null; dlg.speak(item, openAsk); });
        }
      });
    }
    function reset() {
      stopTimers(); try { video.pause(); } catch (e) { /* noop */ }
      asked = false; used = {}; capIdx = -2; setProgress(0); dlg.reset(); setState('idle');
    }
    setState('idle');
    return {
      title: scene.title, scene: true, el: section,
      onEnter: function () { video.preload = 'auto'; drawAmb(); },
      mood: scene.mood,
      onLeave: function () { if (state !== 'talk' || !asked) reset(); else { stopTimers(); dlg.settle(); } },
      space: function () { if (dlg.advance()) return true; if (state === 'idle') { start(); return true; } if (state !== 'talk') { togglePause(); return true; } return false; },
      skip: skipToTalk, replay: start
    };
  }

  function pProcess() {
    var t = D.process;
    return { title: '제작 과정', el: h('section', { class: 'page process' },
      h('h2', { class: 'h2' }, '어떻게 만들고 확인했나'),
      h('ol', { class: 'steps' }, t.steps.map(function (s, n) { return h('li', {}, h('b', { 'aria-hidden': 'true' }, HANJA_NUM[n]), h('span', {}, s)); })),
      h('div', { class: 'collab' }, h('b', {}, t.collabLabel), h('p', {}, t.collab))) };
  }

  function pSources() {
    return { title: '출처와 고지', el: h('section', { class: 'page sources' },
      h('h2', { class: 'h2' }, '출처와 고지'),
      h('div', { class: 'notice' }, D.notices.map(function (n) { return h('p', {}, n); })),
      h('ul', { class: 'biblio' }, D.sources.map(function (s) { return h('li', {}, s); }))) };
  }

  /* ---------- 조립 ---------- */
  pages.push(pOpening(), pIntro(), pTools(), pPerson());
  D.scenes.forEach(function (s, n) { pages.push(pScene(s, n)); });
  pages.push(pInterp(), pProcess(), pSources());

  pages.forEach(function (p, n) {
    pagesEl.append(p.el);
    var d = h('button', { class: 'dot' + (p.scene ? ' scenedot' : ''), type: 'button', 'aria-label': (n + 1) + '쪽 ' + p.title, title: (n + 1) + '. ' + p.title, onclick: function () { go(n); } });
    dotsEl.append(h('li', {}, d)); p.dot = d;
  });

  function go(n) {
    n = Math.max(0, Math.min(pages.length - 1, n));
    if (n === cur) return;
    if (cur >= 0) { var o = pages[cur]; if (o.onLeave) o.onLeave(); o.el.classList.remove('active'); o.dot.removeAttribute('aria-current'); }
    cur = n; var p = pages[n];
    p.el.classList.add('active'); p.dot.setAttribute('aria-current', 'page');
    psTitle.textContent = p.title; psNo.textContent = HANJA_NUM[n] || String(n + 1); deck.setAttribute('data-mood', p.mood || 'pond');
    if (FX) { FX.tint(p.mood || (n === 0 ? 'gold' : 'pond')); FX.burst(640, 400); }
    if (p.onEnter) p.onEnter();
    try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) { /* file:// */ }
  }

  /* ---------- 조작 ---------- */
  document.getElementById('prev').addEventListener('click', function () { go(cur - 1); });
  document.getElementById('next').addEventListener('click', function () { go(cur + 1); });
  document.getElementById('fs').addEventListener('click', toggleFs);
  function toggleFs() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var el = document.documentElement;
    if (!el.requestFullscreen) { toast('이 브라우저에서는 F11 키로 전체 화면을 켜 주세요'); return; }
    var p = el.requestFullscreen(); if (p && p.catch) p.catch(function () { toast('전체 화면을 켤 수 없습니다. F11 키를 눌러 주세요'); });
  }

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && /^(input|textarea|select)$/i.test(t.tagName)) {
      if (e.key === 'Escape') t.blur();
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !t.value) { t.blur(); go(cur + (e.key === 'ArrowRight' ? 1 : -1)); }   // 입력칸이 비어 있으면 화살표로 쪽을 넘긴다
      return;
    }   // 입력 중에는 단축키를 쓰지 않는다
    var isBtn = t && /^(button|a)$/i.test(t.tagName), p = pages[cur];
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': go(cur + 1); break;
      case 'ArrowLeft': case 'PageUp': go(cur - 1); break;
      case 'Home': go(0); break;
      case 'End': go(pages.length - 1); break;
      case ' ': case 'Enter': if (isBtn) return; e.preventDefault(); if (!(p.space && p.space()) && !p.space) go(cur + 1); break;
      case 's': case 'S': if (p.skip && !isBtn) p.skip(); break;
      case 'r': case 'R': if (p.replay && !isBtn) p.replay(); break;
      case 'f': case 'F': if (!isBtn) toggleFs(); break;
      default: return;
    }
  });

  var first = parseInt((location.hash || '').replace('#', ''), 10);
  go(isNaN(first) ? 0 : first - 1);
  window.__sb = { go: go, pages: pages, current: function () { return cur; }, find: findStored, rank: rank, pool: POOL };
})();
