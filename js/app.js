/* Economics with Soma Korcsog: renders everything from posts.json.
   You never need to edit this file to add a post. */
(function () {
  "use strict";

  var state = { data: null, filter: "all", query: "", glossaryQuery: "", view: "list" };
  try { if (localStorage.getItem("view") === "cards") state.view = "cards"; } catch (e) {}
  var app = document.getElementById("app");
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /* ---------- helpers ---------- */
  function slug(s) { return String(s).toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toText(c) { return Array.isArray(c) ? c.join("\n") : String(c || ""); }
  function formatDate(d, short) {
    if (!d) return "";
    var p = String(d).split("-"), y = p[0], m = parseInt(p[1], 10), day = parseInt(p[2], 10);
    if (!m) return y;
    var mon = short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1];
    return (day ? day + " " : "") + mon + " " + y;
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s:]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function markdown(src) {
    var lines = toText(src).replace(/\r/g, "").split("\n");
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<" + list.tag + (list.start > 1 ? ' start="' + list.start + '"' : "") + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flushPara(); flushList(); var l = Math.min(m[1].length + 1, 3); out.push("<h" + l + ">" + inline(m[2]) + "</h" + l + ">"); }
      else if ((m = line.match(/^[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); }
      else if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [], start: parseInt(m[1], 10) }; } list.items.push(m[2]); }
      else if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); }
      else { flushList(); para.push(line); }
    });
    flushPara(); flushList();
    return out.join("");
  }
  function youtubeId(url) {
    var m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : null;
  }
  function slidesEmbed(url) {
    url = String(url);
    var m = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);
    if (m) return "https://docs.google.com/presentation/d/" + m[1] + "/embed?start=false&loop=false";
    if (/canva\.com\/design\//.test(url) && !/[?&]embed/.test(url)) return url.split("?")[0].replace(/\/(edit|view)\/?$/, "/view") + "?embed";
    return url;
  }
  function hasType(post, types) { return (post.blocks || []).some(function (b) { return types.indexOf(b.type) > -1; }); }
  function hasVideo(post) { return hasType(post, ["video", "youtube"]); }
  function readingTime(post) {
    var words = 0;
    (post.blocks || []).forEach(function (b) { if (b.content) words += toText(b.content).split(/\s+/).length; });
    return Math.max(1, Math.round(words / 200));
  }
  function posts() {
    return (state.data.posts || []).filter(function (p) { return !p.draft; }).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
  }
  function postById(id) { return (state.data.posts || []).filter(function (p) { return p.id === id; })[0]; }
  function formatLabel(post) {
    var f = [];
    if (hasVideo(post)) f.push("Video");
    if (hasType(post, ["audio", "podcast"])) f.push("Podcast");
    if (hasType(post, ["pdf", "slides", "presentation"])) f.push("Slides");
    if (hasType(post, ["quiz"])) f.push("Quiz");
    return f.length ? f.join(" · ") : readingTime(post) + " min read";
  }

  /* Cover: a photo, or a big typographic tile */
  function cover(post, opts) {
    opts = opts || {};
    var play = hasVideo(post) ? '<span class="play"><svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg></span>' : "";
    if (post.cover) return '<div class="cover"><img src="' + esc(post.cover) + '" alt="" loading="lazy">' + play + "</div>";
    var a = post.coverArt || { big: post.title.split(/[:\s]/)[0], small: "", tone: "sky" };
    return '<div class="cover cover-art tone-' + esc(a.tone || "sky") + '">' +
      (opts.chip ? '<span class="chip">' + esc(opts.chip) + "</span>" : "") +
      '<div class="big">' + esc(a.big) + "</div>" + (a.small ? '<div class="small">' + esc(a.small) + "</div>" : "") + "</div>";
  }

  /* ---------- blocks ---------- */
  function placeholder(title, file, note) {
    return '<div class="placeholder"><div class="play"><svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg></div>' +
      "<strong>" + esc(title) + "</strong>" + (file ? "<code>" + esc(file) + "</code>" : "") + (note ? "<span>" + esc(note) + "</span>" : "") + "</div>";
  }
  function caption(b) { return b.caption ? "<figcaption>" + inline(b.caption) + "</figcaption>" : ""; }

  var quizCount = 0;
  function renderBlock(b) {
    var t = (b.type || "text").toLowerCase();
    switch (t) {
      case "heading": return '<h2 class="section-heading" id="' + slug(b.text) + '">' + esc(b.text) + "</h2>";
      case "text": return '<div class="prose">' + markdown(b.content) + "</div>";
      case "notes": return '<div class="notes">' + (b.label ? '<span class="label">' + esc(b.label) + "</span>" : "") + '<div class="prose">' + markdown(b.content) + "</div></div>";
      case "quote": return '<div class="prose"><blockquote>' + inline(toText(b.content)) + (b.author ? "<br>— " + esc(b.author) : "") + "</blockquote></div>";
      case "video":
        var portrait = b.portrait === true;
        if (!b.src) return '<figure class="media"><div class="media-frame">' + placeholder(b.title || "Video coming soon", "", "The video will be added soon.") + "</div>" + caption(b) + "</figure>";
        return '<figure class="media"><div class="media-frame' + (portrait ? " portrait" : "") + '" data-video>' +
          '<video controls playsinline preload="metadata"' + (b.poster ? ' poster="' + esc(b.poster) + '"' : "") + ">" +
          '<source src="' + esc(b.src) + '" type="' + (/\.webm$/i.test(b.src) ? "video/webm" : "video/mp4") + '"></video>' +
          "<template>" + placeholder(b.title || "Video coming soon", "", "The video will be added soon.") + "</template></div>" + caption(b) + "</figure>";
      case "youtube":
        var id = youtubeId(b.url || b.src);
        if (!id) return "";
        return '<figure class="media"><div class="media-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="' + esc(b.title || "YouTube video") +
          '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>' + caption(b) + "</figure>";
      case "audio": case "podcast":
        return '<figure class="audio-card"><div><div style="font-weight:600;font-size:1.1rem">' + esc(b.title || "Podcast episode") + "</div>" +
          (b.caption ? '<div class="muted" style="font-size:.9rem">' + inline(b.caption) + "</div>" : "") + "</div>" +
          '<audio controls preload="metadata" src="' + esc(b.src) + '"></audio></figure>';
      case "pdf":
        return '<figure class="media"><div class="doc-bar"><div style="font-weight:600;font-size:1.1rem">' + esc(b.title || "Document") + '</div><a class="btn-ghost" href="' + esc(b.src) + '" target="_blank" rel="noopener">Open PDF</a></div>' +
          '<div class="media-frame tall"><iframe src="' + esc(b.src) + '#view=FitH" title="' + esc(b.title || "PDF") + '" loading="lazy"></iframe></div>' + caption(b) + "</figure>";
      case "slides": case "presentation":
        return '<figure class="media"><div class="doc-bar"><div style="font-weight:600;font-size:1.1rem">' + esc(b.title || "Slides") + '</div><a class="btn-ghost" href="' + esc(b.url || b.src) + '" target="_blank" rel="noopener">Open slides</a></div>' +
          '<div class="media-frame"><iframe src="' + esc(slidesEmbed(b.url || b.src)) + '" title="' + esc(b.title || "Slides") + '" allowfullscreen loading="lazy"></iframe></div>' + caption(b) + "</figure>";
      case "image": return '<figure class="media"><img class="single" src="' + esc(b.src) + '" alt="' + esc(b.alt || b.caption || "") + '" loading="lazy">' + caption(b) + "</figure>";
      case "gallery":
        return '<div class="gallery">' + (b.images || []).map(function (im) {
          return '<figure><img src="' + esc(im.src) + '" alt="' + esc(im.caption || "") + '" loading="lazy" data-zoom>' + (im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>";
      case "link": return '<p><a class="btn" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.text || b.url) + "</a></p>";
      case "quiz":
        var qid = "quiz-" + (quizCount++);
        return '<section class="quiz" id="' + qid + '" data-quiz><div class="quiz-head"><h3>' + esc(b.title || "Test yourself") + '</h3><span class="quiz-score" data-score>0 of ' + (b.questions || []).length + " answered</span></div>" +
          (b.questions || []).map(function (q, i) {
            return '<div class="q" data-answer="' + q.answer + '"><div class="q-text">' + (i + 1) + ". " + esc(q.q) + '</div><div class="q-options">' +
              q.options.map(function (o, j) { return '<button type="button" class="q-opt" data-i="' + j + '">' + esc(o) + "</button>"; }).join("") +
              '</div><div class="q-explain" hidden>' + esc(q.explain || "") + "</div></div>";
          }).join("") + "</section>";
      default: return b.content ? '<div class="prose">' + markdown(b.content) + "</div>" : "";
    }
  }

  function wireBlocks(root) {
    root.querySelectorAll("[data-video]").forEach(function (frame) {
      var video = frame.querySelector("video"), tpl = frame.querySelector("template");
      if (!video || !tpl) return;
      var swap = function () { var fig = frame.closest("figure"); if (fig && fig.parentNode) fig.parentNode.removeChild(fig); };
      var source = video.querySelector("source");
      if (source) source.addEventListener("error", swap);
      video.addEventListener("error", swap);
      if (video.networkState === 3) swap();
    });
    root.querySelectorAll("[data-quiz]").forEach(function (quiz) {
      var qs = quiz.querySelectorAll(".q"), done = 0, right = 0, score = quiz.querySelector("[data-score]");
      qs.forEach(function (q) {
        var ans = parseInt(q.getAttribute("data-answer"), 10);
        q.querySelectorAll(".q-opt").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var pick = parseInt(btn.getAttribute("data-i"), 10);
            q.querySelectorAll(".q-opt").forEach(function (b2) {
              b2.disabled = true;
              if (parseInt(b2.getAttribute("data-i"), 10) === ans) b2.classList.add("correct");
            });
            if (pick !== ans) btn.classList.add("wrong"); else right++;
            done++;
            q.querySelector(".q-explain").hidden = false;
            score.textContent = done === qs.length ? "You got " + right + " of " + qs.length + " right" + (right === qs.length ? ". Perfect!" : "") : done + " of " + qs.length + " answered";
          });
        });
      });
    });
    root.querySelectorAll("[data-zoom]").forEach(function (img) {
      img.addEventListener("click", function () {
        var box = document.createElement("div");
        box.className = "lightbox"; box.innerHTML = '<img src="' + img.getAttribute("src") + '" alt="' + esc(img.alt) + '">';
        box.addEventListener("click", function () { box.remove(); });
        document.body.appendChild(box);
      });
    });
  }

  /* ---------- shared ---------- */
  var SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var TONES = ["sky", "sand", "green", "red"];
  function counts() {
    var c = {};
    posts().forEach(function (p) { (p.categories || []).forEach(function (x) { c[x] = (c[x] || 0) + 1; }); });
    return c;
  }
  function topics() { var c = counts(); return (state.data.categories || []).filter(function (x) { return c[x] > 0; }); }
  function lastUpdated() { var p = posts().slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0]; return p ? formatDate(p.date) : ""; }
  function schoolLine() { var s = state.data.site || {}; return s.school ? s.school + (s.city ? ", " + s.city : "") : ""; }
  function pageHead(kicker, title, sub, accent) {
    return '<header class="page-head container"><div class="eyebrow">' + esc(kicker) + '</div><h1>' + esc(title) + (accent ? ' <span class="accent">' + esc(accent) + "</span>" : "") + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</header>";
  }
  function stat(n, label) { return '<div class="stat"><div class="num">' + n + '</div><div class="lbl">' + esc(label) + "</div></div>"; }

  /* ---------- home ---------- */
  function renderHome() {
    var d = state.data, site = d.site || {}, all = posts(), c = counts();
    var latest = all.slice(0, 3);
    var mo = d.makingOf;
    var h = '<div class="hero-wrap"><canvas class="hero-field" id="hero-field" aria-hidden="true"></canvas><section class="home-hero container">' +
      '<div class="home-hero-text"><div class="hero-kicker">' + esc("School year " + (site.schoolYear || "")) + "</div>" +
      "<h1><span class=\"hero-word\" aria-label=\"Economics.\">" + "Economics.".split("").map(function (ch) { return '<span class="ch" aria-hidden="true">' + ch + "</span>"; }).join("") + "</span><span class=\"hero-name\">" + esc(site.author ? "with " + site.author + "." : "") + "</span></h1>" +
      '<p class="hero-sub">Assignments, videos, interviews and excursions from my Economics class.</p>' +
      '<p class="hero-note"><span class="live-dot" aria-hidden="true"></span>New content every week' + (lastUpdated() ? '<span class="hero-note-sep" aria-hidden="true">·</span><span class="hero-note-date">Last updated ' + esc(lastUpdated()) + "</span>" : "") + "</p>" +
      '<div class="hero-actions"><a class="btn" href="#posts">View all assignments</a>' +
      (all[0] ? '<a class="link" href="#post-' + esc(all[0].id) + '">Read the latest</a>' : "") + "</div></div>" +
      '<aside class="glance" aria-label="At a glance"><div class="glance-title"><span>At a glance</span><span class="glance-clock"><span class="live-dot" aria-hidden="true"></span>Vienna <span id="vienna-time">' + viennaTime() + "</span></span></div>" +
      '<div class="glance-stats">' + stat(all.length, "Assignments") + stat(c["Excursions & Events"] || 0, "Excursions") + stat(all.filter(hasVideo).length, "Videos") + stat((d.glossary || []).length, "Key terms") + "</div>" +
      '<dl class="facts">' + (schoolLine() ? "<div><dt>School</dt><dd>" + esc(schoolLine()) + "</dd></div>" : "") +
      (site.schoolYear ? "<div><dt>School year</dt><dd>" + esc(site.schoolYear) + "</dd></div>" : "") +
      "<div><dt>Subject</dt><dd>" + esc(site.subject || "Economics") + "</dd></div></dl></aside></section></div>" + ticker();

    h += '<section class="home-block container"><div class="block-head"><h2>Latest <span class="accent">assignments.</span></h2><a class="link" href="#posts">See all ' + all.length + "</a></div>" +
      '<div class="tiles three">' + latest.map(tile).join("") + "</div>" +
      '<nav class="topic-row" aria-label="Topics"><span class="topic-row-label">Browse by topic</span>' + topics().map(function (cat) {
        return '<a href="#topic-' + slug(cat) + '">' + esc(cat) + '<span>' + (c[cat] || 0) + "</span></a>";
      }).join("") + "</nav></section>";

    h += '<section class="home-block container"><div class="block-head"><h2>More to <span class="accent">explore.</span></h2></div><div class="trio">' +
      (d.challenge ? '<a class="promo dark" href="#quiz"><div class="eyebrow">Quiz</div><h3>Bored? Test yourself in ' + (d.challenge.rounds || 10) + ' quick questions.</h3><span class="link">Play the challenge</span></a>' : "") +
      '<a class="promo term-promo" href="#glossary"><div class="eyebrow">Key term <span class="term-count" id="term-count"></span></div><div class="term-rot" id="term-rot" aria-live="off"><h3>' + (d.glossary || []).length + ' key terms, explained in one sentence.</h3></div><span class="link">See all ' + (d.glossary || []).length + " key terms</span></a>" +
      (mo && mo.prompts ? '<a class="promo" href="#making-of"><div class="eyebrow">How it was made</div><h3>Built with ' + mo.prompts.length + ' prompts, not code.</h3><span class="link">See the prompts</span></a>' : "") +
      "</div></section>";
    app.innerHTML = h;
    countUp();
    startHomeFx();
  }

  /* ---------- home: moving extras ---------- */
  var fx = [];
  function stopHomeFx() { fx.forEach(function (f) { f(); }); fx = []; }
  function viennaTime() {
    try { return new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }
  function ticker() {
    var d = state.data, items = [];
    posts().forEach(function (p) { if (p.coverArt) items.push('<a href="#post-' + esc(p.id) + '"><b>' + esc(p.coverArt.big) + "</b> " + esc(p.coverArt.small) + "</a>"); });
    (d.glossary || []).slice(0, 10).forEach(function (g) { items.push('<a href="#glossary"><b>' + esc(g.term) + "</b></a>"); });
    if (!items.length) return "";
    var row = items.join('<span class="tk-sep" aria-hidden="true">✦</span>') + '<span class="tk-sep" aria-hidden="true">✦</span>';
    return '<div class="ticker" aria-label="Highlights"><div class="ticker-track"><div class="tk-set">' + row + '</div><div class="tk-set" aria-hidden="true">' + row.replace(/<a /g, '<a tabindex="-1" ') + "</div></div></div>";
  }
  function startHomeFx() {
    stopHomeFx();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // clock
    var clock = document.getElementById("vienna-time");
    if (clock) { var ci = setInterval(function () { clock.textContent = viennaTime(); }, 10000); fx.push(function () { clearInterval(ci); }); }

    // rotating key term
    var g = (state.data.glossary || []).slice(), rot = document.getElementById("term-rot"), cnt = document.getElementById("term-count");
    if (rot && g.length) {
      var order = g.map(function (_, i) { return i; }).sort(function () { return Math.random() - .5; }), gi = 0;
      var show = function () {
        var t = g[order[gi % order.length]]; gi++;
        rot.classList.remove("in"); void rot.offsetWidth;
        rot.innerHTML = "<h3>" + esc(t.term) + "</h3><p>" + esc(t.definition) + "</p>";
        rot.classList.add("in");
        if (cnt) cnt.textContent = "· " + (((gi - 1) % order.length) + 1) + " of " + order.length;
      };
      show();
      var paused = false, promo = rot.closest(".promo");
      promo.addEventListener("pointerenter", function () { paused = true; });
      promo.addEventListener("pointerleave", function () { paused = false; });
      var ti = setInterval(function () { if (!paused && !document.hidden) show(); }, 6000);
      fx.push(function () { clearInterval(ti); });
    }

    if (reduce) return;

    // hero letters react to the mouse
    var word = document.querySelector(".hero-word"), chars = word ? [].slice.call(word.querySelectorAll(".ch")) : [];
    var hero = document.querySelector(".hero-wrap");
    if (fine && hero && chars.length) {
      var lraf = 0, mx = -9999, my = -9999;
      var apply = function () {
        lraf = 0;
        var wr = word.getBoundingClientRect();
        chars.forEach(function (c) {
          var dx = mx - (wr.left + c.offsetLeft + c.offsetWidth / 2), dy = my - (wr.top + c.offsetTop + c.offsetHeight / 2);
          var k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 180);
          c.style.transform = k ? "translateY(" + (-k * 10).toFixed(1) + "px)" : "";
          c.style.color = k > .45 ? "var(--accent)" : "";
        });
      };
      var lm = function (e) { mx = e.clientX; my = e.clientY; if (!lraf) lraf = requestAnimationFrame(apply); };
      var ll = function () { mx = my = -9999; if (!lraf) lraf = requestAnimationFrame(apply); };
      hero.addEventListener("pointermove", lm); hero.addEventListener("pointerleave", ll);
      fx.push(function () { hero.removeEventListener("pointermove", lm); hero.removeEventListener("pointerleave", ll); cancelAnimationFrame(lraf); });
    }

    // magnetic main button
    var mb = document.querySelector(".home-hero .btn");
    if (fine && mb) {
      var bm = function (e) { var r = mb.getBoundingClientRect(); mb.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px)"; };
      var bl = function () { mb.style.transform = ""; };
      mb.addEventListener("pointermove", bm); mb.addEventListener("pointerleave", bl);
    }

    // living market lines in the hero background
    var cv = document.getElementById("hero-field");
    if (cv && cv.getContext) {
      var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), raf = 0, visible = true, t = 0;
      var px = -9999, py = -9999, ripples = [], over = false, sp = 0, last = 0;
      var lines = [0, 1, 2].map(function (i) { return { y: .32 + i * .2, amp: 18 + i * 8, sp: .00018 + i * .00007, ph: Math.random() * 10, f: .0042 - i * .0008, a: .16 - i * .035 }; });
      var size = function () { var r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      var color = function () { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f4b99"; };
      var col = color();
      var draw = function (now) {
        raf = 0; if (!visible || document.hidden) { last = 0; return; }
        var dt = last ? Math.min(50, now - last) : 16; last = now;
        sp += ((over ? 1 : 0) - sp) * Math.min(1, dt / 260);
        t += dt * sp; ctx.clearRect(0, 0, W, H);
        ripples = ripples.filter(function (r) { return now - r.t < 1400; });
        lines.forEach(function (L) {
          ctx.beginPath();
          for (var x = 0; x <= W; x += 6) {
            var y = H * L.y + Math.sin(x * L.f + t * L.sp * 6 + L.ph) * L.amp + Math.sin(x * L.f * 2.7 + t * L.sp * 9) * L.amp * .35;
            var dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
            y += -36 * sp * Math.exp(-d2 / 9000) * (dy < 0 ? -1 : 1);
            ripples.forEach(function (r) { var dd = Math.sqrt((x - r.x) * (x - r.x) + (y - r.y) * (y - r.y)), age = (now - r.t) / 1400, front = age * 420; y += Math.sin((dd - front) / 18) * 14 * (1 - age) * Math.exp(-Math.pow(dd - front, 2) / 2400); });
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = col; ctx.globalAlpha = L.a; ctx.lineWidth = 1.6; ctx.stroke();
        });
        ctx.globalAlpha = 1;
        if (over || sp > .002 || ripples.length) raf = requestAnimationFrame(draw); else { sp = 0; last = 0; }
      };
      var kick = function () { if (!raf && visible) raf = requestAnimationFrame(draw); };
      var ro = new ResizeObserver(function () { size(); kick(); }); ro.observe(cv);
      var io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }); io.observe(cv);
      var mo = new MutationObserver(function () { col = color(); kick(); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      var mq = window.matchMedia("(prefers-color-scheme: dark)"), mqf = function () { col = color(); kick(); }; if (mq.addEventListener) mq.addEventListener("change", mqf);
      var pm = function (e) { over = true; kick(); var r = cv.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; };
      var pl = function () { over = false; kick(); };
      var pd = function (e) { if (e.target.closest("a,button")) return; var r = cv.getBoundingClientRect(); ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }); kick(); };
      var vis = function () { kick(); };
      hero.addEventListener("pointermove", pm); hero.addEventListener("pointerleave", pl); hero.addEventListener("pointerdown", pd); document.addEventListener("visibilitychange", vis);
      kick();
      fx.push(function () { cancelAnimationFrame(raf); raf = 0; visible = false; ro.disconnect(); io.disconnect(); mo.disconnect(); if (mq.removeEventListener) mq.removeEventListener("change", mqf); hero.removeEventListener("pointermove", pm); hero.removeEventListener("pointerleave", pl); hero.removeEventListener("pointerdown", pd); document.removeEventListener("visibilitychange", vis); });
    }
  }

  function countUp() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    app.querySelectorAll(".glance .num").forEach(function (el) {
      var target = parseInt(el.textContent, 10), t0 = performance.now() + 250;
      if (!target) return;
      el.textContent = "0";
      (function step(now) {
        var k = Math.max(0, Math.min(1, (now - t0) / 1200));
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* ---------- assignments ---------- */
  function renderAssignments() {
    var d = state.data, c = counts(), all = posts();
    document.title = "Assignments · " + (d.site.title || "Economics");
    app.innerHTML = pageHead("School year " + (d.site.schoolYear || ""), "All", "Every assignment of the school year, newest first.", "assignments.") +
      '<div class="layout container"><aside class="sidebar">' +
      '<label class="search-wrap"><span class="sr-only">Search assignments</span>' + SEARCH_ICON + '<input id="search" class="search" type="search" placeholder="Search assignments" value="' + esc(state.query) + '"></label>' +
      '<nav class="side-nav" aria-label="Filter by topic">' +
      '<button type="button" class="all-btn" data-filter="all" aria-pressed="' + (state.filter === "all") + '"><span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="1" y="8" width="5" height="5" rx="1.2" fill="currentColor"/><rect x="8" y="8" width="5" height="5" rx="1.2" fill="currentColor"/></svg>All assignments</span><span class="n">' + all.length + "</span></button>" +
      '<div class="side-label">Topics</div>' +
      topics().map(function (cat) {
        return '<button type="button" data-filter="' + slug(cat) + '" aria-pressed="' + (state.filter === slug(cat)) + '"><span>' + esc(cat) + '</span><span class="n">' + (c[cat] || 0) + "</span></button>";
      }).join("") + "</nav></aside>" +
      '<div class="main-col"><div class="result-line" id="result-line"></div><div id="post-list"></div></div></div>';
    renderList();
    document.getElementById("result-line").addEventListener("click", function (e) {
      var vb = e.target.closest && e.target.closest("[data-view]");
      if (vb) { state.view = vb.getAttribute("data-view"); try { localStorage.setItem("view", state.view); } catch (err) {} renderList(); return; }
      var clr = e.target.closest && e.target.closest("[data-clear]");
      if (clr) { var a = app.querySelector('[data-filter="all"]'); if (a) a.click(); }
    });
    app.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        try { history.replaceState(null, "", state.filter === "all" ? "#posts" : "#topic-" + state.filter); } catch (e) {}
        app.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        renderList();
      });
    });
    document.getElementById("search").addEventListener("input", function (e) { state.query = e.target.value; renderList(); });
  }

  /* Full-text search: title, summary, topics and everything written in the post */
  function searchText(p) {
    if (p._hay) return p._hay;
    var parts = [p.title, p.excerpt, (p.categories || []).join(" "), p.coverArt ? p.coverArt.big + " " + p.coverArt.small : ""];
    (p.blocks || []).forEach(function (b) {
      parts.push(b.text, b.title, b.label, b.caption, b.author, toText(b.content));
      (b.questions || []).forEach(function (q) { parts.push(q.q, (q.options || []).join(" "), q.explain); });
      (b.images || []).forEach(function (im) { parts.push(im.caption); });
    });
    p._hay = parts.filter(Boolean).join(" ").replace(/[*_>#`]/g, " ").replace(/\s+/g, " ").toLowerCase();
    return p._hay;
  }

  function renderList() {
    var list = document.getElementById("post-list");
    if (!list) return;
    var q = state.query.trim().toLowerCase();
    var cats = state.data.categories || [];
    var res = posts().filter(function (p) {
      var inCat = state.filter === "all" || (p.categories || []).some(function (c) { return slug(c) === state.filter; });
      var hay = searchText(p);
      return inCat && (!q || hay.indexOf(q) > -1);
    });
    var catName = state.filter === "all" ? "All topics" : (cats.filter(function (c) { return slug(c) === state.filter; })[0] || "");
    var rl = document.getElementById("result-line");
    if (rl) rl.innerHTML = "<span>" + esc(catName) + " · " + res.length + (res.length === 1 ? " assignment" : " assignments") + (q ? " matching “" + esc(state.query) + "”" : "") + "</span>" +
      (state.filter !== "all" ? '<button type="button" class="clear-chip" data-clear>Show all assignments <span aria-hidden="true">×</span></button>' : "") +
      '<span class="view-toggle" role="group" aria-label="View"><button type="button" data-view="list" aria-pressed="' + (state.view !== "cards") + '">List</button><button type="button" data-view="cards" aria-pressed="' + (state.view === "cards") + '">Cards</button></span>';
    if (!res.length) {
      list.innerHTML = '<div class="empty"><strong>No assignments here yet</strong>' + (q ? "Nothing matches “" + esc(state.query) + "”." : "Posts for this topic will appear here.") + "</div>";
      return;
    }
    var groups = [], seen = {};
    res.forEach(function (p) {
      var key = String(p.date).slice(0, 7);
      if (!seen[key]) { seen[key] = { key: key, posts: [] }; groups.push(seen[key]); }
      seen[key].posts.push(p);
    });
    var asList = state.view !== "cards";
    list.innerHTML = groups.map(function (g) {
      return '<div class="month"><div class="month-label">' + formatDate(g.key) + "<span>" + g.posts.length + (g.posts.length === 1 ? " post" : " posts") + "</span></div>" +
        (asList ? '<div class="rows">' + g.posts.map(row).join("") + "</div>" : '<div class="tiles">' + g.posts.map(tile).join("") + "</div>") + "</div>";
    }).join("");
  }

  function row(p) {
    return '<a class="row" href="#post-' + esc(p.id) + '"><span class="row-date">' + formatDate(p.date, true) + '</span>' +
      '<span class="row-main"><span class="row-title">' + esc(p.title) + '</span><span class="row-sub">' + esc((p.categories || []).join(" · ")) + (p.excerpt ? " · " + esc(p.excerpt) : "") + "</span></span>" +
      '<span class="row-kind">' + formatLabel(p) + '</span><span class="row-arrow" aria-hidden="true">→</span></a>';
  }
  function tile(p) {
    return '<a class="tile" href="#post-' + esc(p.id) + '">' + cover(p) +
      '<div class="tile-body"><div class="tile-topics">' + esc((p.categories || []).join(" · ")) + "</div><h3>" + esc(p.title) + "</h3><p>" + esc(p.excerpt || "") + "</p>" +
      '<div class="tile-meta"><span>' + formatDate(p.date) + "</span><span>" + formatLabel(p) + "</span></div></div></a>";
  }

  /* ---------- glossary ---------- */
  function renderGlossaryPage() {
    var d = state.data;
    document.title = "Key terms · " + (d.site.title || "Economics");
    var letters = {};
    (d.glossary || []).forEach(function (t) { letters[t.term.charAt(0).toUpperCase()] = 1; });
    app.innerHTML = pageHead("Key terms", "Key terms,", "Every important word from my assignments, explained in one sentence.", "simply explained.") +
      '<div class="container"><div class="glossary-tools"><label class="search-wrap"><span class="sr-only">Search the key terms</span>' + SEARCH_ICON +
      '<input id="glossary-search" class="search" type="search" placeholder="Search terms, e.g. GDP" value="' + esc(state.glossaryQuery) + '"></label>' +
      '<div class="az">' + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l) {
        return letters[l] ? '<button type="button" data-letter="' + l + '">' + l + "</button>" : '<span>' + l + "</span>";
      }).join("") + '</div><span class="glossary-count" id="glossary-count"></span></div>' +
      '<dl class="glossary" id="glossary-list"></dl></div>';
    renderGlossary();
    document.getElementById("glossary-search").addEventListener("input", function (e) { state.glossaryQuery = e.target.value; renderGlossary(); });
    app.querySelectorAll("[data-letter]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.glossaryQuery = ""; document.getElementById("glossary-search").value = ""; renderGlossary();
        var el = document.getElementById("term-" + b.getAttribute("data-letter"));
        if (el) el.scrollIntoView({ block: "center" });
      });
    });
  }

  function renderGlossary() {
    var el = document.getElementById("glossary-list");
    if (!el) return;
    var q = state.glossaryQuery.trim().toLowerCase(), firstSeen = {};
    var terms = (state.data.glossary || []).slice().sort(function (a, b) { return a.term.localeCompare(b.term); }).filter(function (t) {
      return !q || (t.term + " " + t.definition).toLowerCase().indexOf(q) > -1;
    });
    document.getElementById("glossary-count").textContent = terms.length + (terms.length === 1 ? " term" : " terms");
    el.innerHTML = terms.length ? terms.map(function (t) {
      var p = t.post && postById(t.post), L = t.term.charAt(0).toUpperCase(), idAttr = "";
      if (!firstSeen[L]) { firstSeen[L] = 1; idAttr = ' id="term-' + L + '"'; }
      return '<div class="term"' + idAttr + "><dt>" + esc(t.term) + "</dt><dd>" + esc(t.definition) + "</dd>" + (p ? '<a href="#post-' + esc(p.id) + '">From: ' + esc(p.title) + "</a>" : "") + "</div>";
    }).join("") : '<div class="term" style="grid-column:1/-1"><dt>No matching term</dt><dd>Try another word.</dd></div>';
  }

  /* ---------- about ---------- */
  function renderAbout() {
    var d = state.data, site = d.site || {};
    document.title = "About · " + (site.title || "Economics");
    app.innerHTML = pageHead("About", "About this", "", "portfolio.") +
      '<div class="container about"><div class="prose">' + markdown(site.about || "") + "</div>" +
      '<dl class="facts">' +
      (site.author ? "<div><dt>Student</dt><dd>" + esc(site.author) + "</dd></div>" : "") +
      (schoolLine() ? "<div><dt>School</dt><dd>" + esc(schoolLine()) + "</dd></div>" : "") +
      (site.schoolYear ? "<div><dt>School year</dt><dd>" + esc(site.schoolYear) + "</dd></div>" : "") +
      "<div><dt>Subject</dt><dd>" + esc(site.subject || "Economics") + "</dd></div>" +
      "<div><dt>Assignments</dt><dd>" + posts().length + "</dd></div>" +
      '<div><dt>How it was made</dt><dd><a class="link" href="#making-of">See all the prompts</a></dd></div>' +
      '<div><dt>Feedback</dt><dd><a class="link" href="#feedback">Report a bug or idea</a></dd></div></dl></div>';
  }

  /* ---------- post ---------- */
  /* Glossary terms inside posts: first mention gets a hover/focus explanation */
  function linkGlossary(root) {
    var list = (state.data.glossary || []).slice().sort(function (a, b) { return b.term.length - a.term.length; });
    if (!list.length) return;
    function forms(t) {
      var e = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), f = [e + "s", e + "es", e];
      if (/y$/i.test(t)) f.unshift(e.slice(0, -1) + "ies");
      return f;
    }
    var used = {}, n = 0;
    var blocks = root.querySelectorAll(".article-body .prose");
    list.forEach(function (g) {
      var re = new RegExp("(^|[^\\w])(" + forms(g.term).join("|") + ")(?![\\w])", "i");
      for (var b = 0; b < blocks.length && !used[g.term]; b++) {
        var walker = document.createTreeWalker(blocks[b], NodeFilter.SHOW_TEXT, {
          acceptNode: function (node) {
            return node.parentElement.closest("a, h1, h2, h3, h4, code, .gloss, .quiz") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
        });
        var node;
        while ((node = walker.nextNode())) {
          var m = re.exec(node.nodeValue);
          if (!m) continue;
          var start = m.index + m[1].length, word = m[2];
          var after = node.splitText(start); after.nodeValue = after.nodeValue.slice(word.length);
          var id = "gloss-tip-" + (++n);
          var span = document.createElement("span");
          span.className = "gloss"; span.tabIndex = 0; span.setAttribute("aria-describedby", id);
          span.innerHTML = esc(word) + '<span class="gloss-tip" role="tooltip" id="' + id + '"><strong>' + esc(g.term) + "</strong>" + esc(g.definition) + "</span>";
          node.parentNode.insertBefore(span, after);
          used[g.term] = true;
          break;
        }
      }
    });
    root.querySelectorAll(".gloss").forEach(function (el) {
      var place = function () {
        var tip = el.querySelector(".gloss-tip"); tip.style.setProperty("--shift", "0px");
        var r = tip.getBoundingClientRect(), pad = 12, dx = 0;
        if (r.left < pad) dx = pad - r.left; else if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right;
        tip.style.setProperty("--shift", dx + "px");
        el.classList.toggle("below", r.top < 70);
      };
      el.addEventListener("mouseenter", place); el.addEventListener("focus", place);
    });
  }

  function renderPost(id) {
    var post = postById(id);
    if (!post) { app.innerHTML = '<div class="container"><div class="empty" style="margin-block:96px"><strong>Post not found</strong><a class="link" href="#">Back to the start page</a></div></div>'; return; }
    document.title = post.title + " · " + (state.data.site.title || "Economics");
    quizCount = 0;
    var all = posts(), i = all.indexOf(post), newer = all[i - 1], older = all[i + 1];
    var showCover = post.coverArt || (post.cover && !hasVideo(post));
    app.innerHTML = '<article><header class="article-head container"><a class="back" href="#posts">All assignments</a>' +
      '<div class="tile-topics">' + esc((post.categories || []).join(" · ")) + "</div><h1>" + esc(post.title) + "</h1>" +
      (post.excerpt ? '<p class="lead">' + esc(post.excerpt) + "</p>" : "") +
      '<div class="meta">' + formatDate(post.date) + " · " + readingTime(post) + " min read" + (state.data.site.schoolYear ? " · School year " + esc(state.data.site.schoolYear) : "") + "</div></header>" +
      (showCover ? '<div class="article-cover container">' + cover(post) + "</div>" : "") +
      '<div class="article-body container">' + (post.blocks || []).map(renderBlock).join("") + "</div></article>" +
      '<nav class="post-nav container" aria-label="More assignments">' +
      (older ? '<a href="#post-' + esc(older.id) + '"><span>‹ Older</span><h4>' + esc(older.title) + "</h4></a>" : "<div></div>") +
      (newer ? '<a class="next" href="#post-' + esc(newer.id) + '"><span>Newer ›</span><h4>' + esc(newer.title) + "</h4></a>" : "<div></div>") + "</nav>";
    wireBlocks(app);
    linkGlossary(app);
    window.scrollTo(0, 0);
  }

  function renderMakingOf() {
    var m = state.data.makingOf || { prompts: [] };
    document.title = "How it was made · " + ((state.data.site || {}).title || "Economics");
    app.innerHTML = '<header class="article-head container"><a class="back" href="#">Start page</a>' +
      '<div class="tile-topics">How it was made</div><h1>How this website was made.</h1>' +
      (m.intro ? '<p class="lead">' + esc(m.intro) + "</p>" : "") +
      '<div class="meta">' + m.prompts.length + " prompts · built with Claude</div></header>" +
      '<ol class="prompts container">' + m.prompts.map(function (pr, i) {
        return '<li class="prompt' + (i === 0 ? " first" : "") + '"><div class="prompt-meta"><span class="prompt-num">' + (i + 1) + "</span>" + esc(pr.label || "Prompt") + "</div>" +
          '<div class="prompt-bubble">' + esc(pr.text) + "</div></li>";
      }).join("") + "</ol>";
    window.scrollTo(0, 0);
  }

  /* ---------- interactions ---------- */
  var revealIO = null;
  document.addEventListener("pointermove", function (e) {
    var g = e.target && e.target.closest && e.target.closest(".glance");
    if (!g || e.pointerType !== "mouse") return;
    var r = g.getBoundingClientRect();
    g.style.setProperty("--mx", (e.clientX - r.left) + "px");
    g.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  function setupReveal() {
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var vh = window.innerHeight;
    var els = app.querySelectorAll(".home-block, .article-body > *, .post-nav, .month, .prompt, .about > *, .term");
    var pending = [];
    els.forEach(function (el) { if (el.getBoundingClientRect().top > vh * 0.92) { el.classList.add("will-reveal"); pending.push(el); } });
    if (!pending.length) return;
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        revealIO.unobserve(e.target);
        e.target.classList.add("is-in");
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    pending.forEach(function (el) { revealIO.observe(el); });
  }
  function setupReveal_unused() {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var vh = window.innerHeight;

    // Count-up numbers
    var nums = app.querySelectorAll("[data-count]");
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io2.unobserve(e.target);
        var target = parseInt(e.target.getAttribute("data-count"), 10), start = performance.now();
        (function step(now) {
          var k = Math.min(1, (now - start) / 900);
          e.target.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        })(start);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { if (n.getBoundingClientRect().top > vh) io2.observe(n); });
  }

  function setupChrome() {
    var site = state.data.site || {};
    var t = site.title || "Economics";
    document.getElementById("site-title").textContent = t;
    document.getElementById("footer-title").textContent = t;
    document.querySelectorAll('a[href="#home"]').forEach(function (a) {
      a.addEventListener("click", function () { var h = location.hash; if (!h || h === "#home") window.scrollTo({ top: 0, behavior: "smooth" }); });
    });
    document.getElementById("footer-meta").textContent = [site.school && site.school + (site.city ? ", " + site.city : ""), site.schoolYear && "School year " + site.schoolYear].filter(Boolean).join(" · ");
    document.getElementById("footer-topics").innerHTML = topics().map(function (c) { return '<a href="#topic-' + slug(c) + '">' + esc(c) + "</a>"; }).join("");

    var mb = document.getElementById("menu-btn"), mm = document.getElementById("mobile-menu");
    mb.addEventListener("click", function () { mm.hidden = !mm.hidden; mb.setAttribute("aria-expanded", String(!mm.hidden)); });
    mm.addEventListener("click", function (e) { if (e.target.closest("a")) { mm.hidden = true; mb.setAttribute("aria-expanded", "false"); } });

    var root = document.documentElement, saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    if (saved) root.setAttribute("data-theme", saved);
    document.getElementById("theme-btn").addEventListener("click", function () {
      var cur = root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });

    var bar = document.getElementById("progress"), navEl = document.querySelector(".nav");
    window.addEventListener("scroll", function () {
      if (navEl) navEl.classList.toggle("scrolled", window.scrollY > 8);
      if (!/^#post-/.test(location.hash)) { bar.style.transform = "scaleX(0)"; return; }
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    }, { passive: true });
  }


  /* ---------- Economics Challenge (quiz game) ---------- */
  var game = null;
  function stopChallengeTimer() { if (game && game.timer) { cancelAnimationFrame(game.timer); game.timer = null; } }
  function bestScore() { try { return parseInt(localStorage.getItem("challenge-best") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(n) { try { if (n > bestScore()) localStorage.setItem("challenge-best", String(n)); } catch (e) {} }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var LETTERS = ["A", "B", "C", "D"];
  function gameIntoView() {
    var box = document.getElementById("game"); if (!box) return;
    var top = box.getBoundingClientRect().top;
    if (top < 70 || top > window.innerHeight * 0.4) window.scrollTo({ top: window.scrollY + top - 84, behavior: "smooth" });
  }

  function renderChallenge() {
    var c = state.data.challenge || { questions: [] };
    document.title = "Quiz · " + (state.data.site.title || "Economics");
    var best = bestScore();
    app.innerHTML = pageHead("Quiz", "Economics", c.intro || "", "Challenge.") +
      '<div class="container"><div class="game" id="game"><div class="game-intro">' +
      '<div class="game-rules"><div><strong>' + (c.rounds || 10) + '</strong><span>questions</span></div><div><strong>' + (c.seconds || 20) + ' s</strong><span>per question</span></div><div><strong>1,000</strong><span>points max each</span></div><div><strong>' + (best ? best.toLocaleString("en") : "–") + '</strong><span>your best</span></div></div>' +
      '<p class="game-hint">Faster answers score more points, and a streak of correct answers earns a bonus. You can also answer with the keys 1 to 4.</p>' +
      '<button type="button" class="btn game-start" id="game-start">Start the challenge</button></div></div></div>';
    document.getElementById("game-start").addEventListener("click", startGame);
  }

  function startGame() {
    var c = state.data.challenge;
    var pool = shuffle(c.questions).slice(0, c.rounds || 10).map(function (q) {
      var order = shuffle(q.options.map(function (_, i) { return i; }));
      return { q: q.q, options: order.map(function (i) { return q.options[i]; }), answer: order.indexOf(q.answer), explain: q.explain, post: q.post };
    });
    game = { qs: pool, i: 0, score: 0, streak: 0, right: 0, missed: [], secs: c.seconds || 20, timer: null, locked: false, left: 1 };
    showQuestion();
  }

  function showQuestion() {
    var g = game, q = g.qs[g.i], box = document.getElementById("game");
    if (!box) return;
    g.locked = false; g.left = 1;
    box.innerHTML = '<div class="game-top"><span>Question ' + (g.i + 1) + " of " + g.qs.length + '</span><span class="game-streak" id="game-streak">' + (g.streak >= 2 ? g.streak + " in a row" : "") + '</span><span class="game-score">' + g.score.toLocaleString("en") + " pts</span></div>" +
      '<div class="game-timer"><div class="game-timer-track"><div class="game-timer-bar" id="game-bar"></div></div><span id="game-secs">' + g.secs + "</span></div>" +
      '<h2 class="game-q">' + esc(q.q) + "</h2>" +
      '<div class="game-answers">' + q.options.map(function (o, k) {
        return '<button type="button" class="game-a a' + k + '" data-k="' + k + '"><span class="game-letter">' + LETTERS[k] + "</span><span>" + esc(o) + "</span></button>";
      }).join("") + "</div>" +
      '<div class="game-after" id="game-after" hidden></div>';
    box.querySelectorAll(".game-a").forEach(function (b) { b.addEventListener("click", function () { answer(parseInt(b.getAttribute("data-k"), 10)); }); });
    gameIntoView();
    var t0 = performance.now(), total = g.secs * 1000, bar = document.getElementById("game-bar"), sec = document.getElementById("game-secs");
    (function tick(now) {
      if (game !== g || g.locked) return;
      var left = Math.max(0, total - (now - t0));
      g.left = left / total;
      bar.style.transform = "scaleX(" + g.left + ")";
      bar.classList.toggle("low", left < 5000);
      sec.textContent = Math.ceil(left / 1000);
      if (left <= 0) { answer(-1); return; }
      g.timer = requestAnimationFrame(tick);
    })(t0);
  }

  function answer(k) {
    var g = game; if (!g || g.locked) return;
    g.locked = true; stopChallengeTimer();
    var q = g.qs[g.i], ok = k === q.answer, pts = 0;
    if (ok) {
      g.streak++; g.right++;
      pts = Math.round(500 + 500 * g.left) + (g.streak >= 2 ? Math.min(300, (g.streak - 1) * 100) : 0);
      g.score += pts;
    } else { g.streak = 0; g.missed.push(q); }
    var box = document.getElementById("game");
    box.querySelectorAll(".game-a").forEach(function (b) {
      var kk = parseInt(b.getAttribute("data-k"), 10); b.disabled = true;
      if (kk === q.answer) b.classList.add("is-right"); else if (kk === k) b.classList.add("is-wrong"); else b.classList.add("is-dim");
    });
    var post = q.post && postById(q.post);
    var after = document.getElementById("game-after");
    after.hidden = false;
    after.innerHTML = '<div class="game-verdict ' + (ok ? "ok" : "no") + '">' + (ok ? "Correct! +" + pts.toLocaleString("en") : (k === -1 ? "Time's up" : "Not quite")) + "</div>" +
      "<p>" + esc(q.explain || "") + (post ? ' <a class="link" href="#post-' + esc(post.id) + '" target="_blank" rel="noopener">From: ' + esc(post.title) + "</a>" : "") + "</p>" +
      '<button type="button" class="btn" id="game-next">' + (g.i + 1 < g.qs.length ? "Next question" : "See my result") + "</button>";
    var top = box.querySelector(".game-score"); if (top) top.textContent = g.score.toLocaleString("en") + " pts";
    var st = document.getElementById("game-streak"); if (st) st.textContent = g.streak >= 2 ? g.streak + " in a row" : "";
    var next = document.getElementById("game-next"); next.focus({ preventScroll: true });
    next.addEventListener("click", function () { g.i++; if (g.i < g.qs.length) showQuestion(); else showResult(); });
  }

  function showResult() {
    var g = game, box = document.getElementById("game"), n = g.qs.length, ratio = g.right / n;
    var prev = bestScore(); saveBest(g.score);
    var rank = ratio >= 0.9 ? "Chief Economist" : ratio >= 0.7 ? "Economist" : ratio >= 0.5 ? "Analyst" : ratio >= 0.3 ? "Intern" : "Rookie";
    box.innerHTML = '<div class="game-result"><div class="eyebrow">Your result</div><div class="game-final">' + g.score.toLocaleString("en") + "<span>points</span></div>" +
      '<div class="game-rank">' + rank + " · " + g.right + " of " + n + " correct</div>" +
      (g.score > prev ? '<div class="game-best">New personal best!</div>' : prev ? '<div class="game-best muted">Your best: ' + prev.toLocaleString("en") + "</div>" : "") +
      (g.missed.length ? '<div class="game-review"><div class="side-label">Worth another look</div><ul>' + g.missed.map(function (q) {
        return "<li><strong>" + esc(q.q) + "</strong><span>" + esc(q.options[q.answer]) + "</span></li>";
      }).join("") + "</ul></div>" : "") +
      '<div class="game-actions"><button type="button" class="btn" id="game-again">Play again</button><a class="link" href="#posts">Browse the assignments</a></div></div>';
    game = null;
    gameIntoView();
    document.getElementById("game-again").addEventListener("click", startGame);
  }
  document.addEventListener("keydown", function (e) {
    if (!game || game.locked || /input|textarea|select/i.test((e.target && e.target.tagName) || "")) return;
    var k = "1234".indexOf(e.key); if (k > -1 && k < game.qs[game.i].options.length) answer(k);
  });

  /* ---------- feedback ---------- */
  function renderFeedback() {
    var site = state.data.site || {};
    document.title = "Feedback · " + (site.title || "Economics");
    var types = ["Bug", "Slow or laggy", "Idea", "Other"];
    app.innerHTML = pageHead("Feedback", "Found a bug", "Something not working, loading slowly, or a suggestion to make the site better? Send it here and it goes straight to me.", "or an idea?") +
      '<div class="container"><form class="feedback" id="feedback-form" novalidate>' +
      '<fieldset class="fb-types"><legend>What is it about?</legend>' + types.map(function (t, i) {
        return '<label class="fb-chip"><input type="radio" name="type" value="' + esc(t) + '"' + (i === 0 ? " checked" : "") + "><span>" + esc(t) + "</span></label>";
      }).join("") + "</fieldset>" +
      '<label class="fb-field"><span>Your message <em>required</em></span><textarea name="message" rows="6" required maxlength="3000" placeholder="What happened, and on which page?"></textarea></label>' +
      '<div class="fb-row"><label class="fb-field"><span>Name <em>optional</em></span><input name="name" type="text" maxlength="80" autocomplete="name"></label>' +
      '<label class="fb-field"><span>Email for a reply <em>optional</em></span><input name="email" type="email" maxlength="120" autocomplete="email"></label></div>' +
      '<input type="text" name="_honey" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="fb-actions"><button type="submit" class="btn" id="fb-send">Send feedback</button><span class="fb-status" id="fb-status" role="status"></span></div>' +
      "</form></div>";
    var form = document.getElementById("feedback-form"), status = document.getElementById("fb-status"), btn = document.getElementById("fb-send");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form), msg = String(fd.get("message") || "").trim(), mail = String(fd.get("email") || "").trim();
      status.className = "fb-status";
      if (!msg) { status.textContent = "Please write a short message first."; status.classList.add("err"); form.elements.message.focus(); return; }
      if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { status.textContent = "That email address doesn't look right."; status.classList.add("err"); form.elements.email.focus(); return; }
      if (fd.get("_honey")) return;
      if (!site.feedbackEndpoint) { status.textContent = "Feedback is not set up yet."; status.classList.add("err"); return; }
      btn.disabled = true; status.textContent = "Sending…";
      var body = { _subject: "Website feedback: " + fd.get("type"), _template: "table", _captcha: "false", type: fd.get("type"), message: msg, name: String(fd.get("name") || "").trim() || "(not given)", page: location.href };
      if (mail) { body.email = mail; body._replyto = mail; }
      fetch(site.feedbackEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          if (res && (res.success === false || res.success === "false")) throw new Error(res.message || "failed");
          form.innerHTML = '<div class="fb-done"><div class="game-verdict ok">Thank you!</div><p>Your feedback was sent. I read every message.</p><a class="link" href="#home">Back to the home page</a></div>';
        })
        .catch(function () { btn.disabled = false; status.textContent = "Sending didn't work. Please try again in a moment."; status.classList.add("err"); });
    });
  }

  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    var page = "home";
    stopChallengeTimer(); game = null; stopHomeFx();
    document.title = (state.data.site && state.data.site.title) || "Economics";
    if (h.indexOf("post-") === 0) { page = "posts"; renderPost(h.slice(5)); }
    else if (h === "making-of") { page = "making-of"; renderMakingOf(); }
    else if (h === "glossary") { page = "glossary"; renderGlossaryPage(); }
    else if (h === "about") { page = "about"; renderAbout(); }
    else if (h === "quiz") { page = "quiz"; renderChallenge(); }
    else if (h === "feedback") { page = "feedback"; renderFeedback(); }
    else if (h === "posts" || h === "topics" || h.indexOf("topic-") === 0) {
      page = "posts";
      if (h.indexOf("topic-") === 0) {
        var want = h.slice(6);
        var known = topics().some(function (c) { return slug(c) === want; });
        state.filter = known ? want : "all";
        if (!known) { try { history.replaceState(null, "", "#posts"); } catch (e) {} }
      } else { state.filter = "all"; state.query = ""; }
      renderAssignments();
    } else renderHome();
    document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(function (a) {
      if (a.getAttribute("href") === "#" + page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setupReveal();
    document.getElementById("progress").style.transform = "scaleX(0)";
  }

  function start(data) {
    state.data = data;
    setupChrome();
    route();
    window.addEventListener("hashchange", route);
  }

  fetch("posts.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function (err) {
      app.innerHTML = '<div class="container"><div class="empty" style="margin-block:96px"><strong>The posts could not be loaded</strong>' +
        "Open the site through a local server (double-click start-preview) instead of opening index.html directly.</div></div>";
      console.error(err);
    });
})();
