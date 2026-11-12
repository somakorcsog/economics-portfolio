/* Economics with Soma Korcsog: renders everything from posts.json.
   You never need to edit this file to add a post. */
(function () {
  "use strict";

  var state = { data: null, filter: "all", query: "", glossaryQuery: "" };
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
      var swap = function () { if (frame.contains(video)) { frame.classList.remove("portrait"); frame.innerHTML = tpl.innerHTML; } };
      var source = video.querySelector("source");
      if (source) source.addEventListener("error", swap);
      video.addEventListener("error", swap);
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

  /* ---------- home ---------- */
  function renderHome() {
    var d = state.data, site = d.site || {}, all = posts();
    var featured = all.filter(function (p) { return p.featured; })[0] || all[0];
    var counts = {};
    all.forEach(function (p) { (p.categories || []).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    var schoolLine = site.school ? site.school + (site.city ? ", " + site.city : "") : "";
    var reelImgs = [];
    all.forEach(function (p) { (p.blocks || []).forEach(function (b) { if (b.type === "gallery") (b.images || []).forEach(function (im) { reelImgs.push({ src: im.src, caption: im.caption, id: p.id }); }); }); });

    var h = "";
    // Hero
    h += '<section class="hero container"><div class="hero-kicker">' + esc(["School year " + (site.schoolYear || ""), schoolLine].filter(Boolean).join(" · ")) + "</div>" +
      "<h1>Economics.<span>" + esc(site.author ? "with " + site.author + "." : "") + "</span></h1>" +
      '<p class="hero-sub">Assignments, videos, interviews and excursions from my Economics class.</p>' +
      '<div class="hero-actions"><a class="btn" href="#posts">View assignments</a>' +
      (featured ? '<a class="link" href="#post-' + esc(featured.id) + '">Read the latest</a>' : "") + "</div>" +
      (reelImgs.length ? '<div class="reel" aria-label="Stills from our explainer video">' + reelImgs.map(function (im) {
        return '<figure><a href="#post-' + esc(im.id) + '"><img src="' + esc(im.src) + '" alt="' + esc(im.caption || "") + '"></a>' + (im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "") + "</figure>";
      }).join("") + "</div>" : "") + "</section>";

    // Featured band
    if (featured) {
      h += '<section class="section band" style="margin-top:72px"><div class="container featured reveal">' +
        '<div><div class="eyebrow">Featured · ' + esc((featured.categories || []).join(", ")) + "</div><h2>" + esc(featured.title) + "</h2>" +
        "<p>" + esc(featured.excerpt || "") + '</p><div class="meta">' + formatDate(featured.date) + " · " + formatLabel(featured) + "</div>" +
        '<a class="link" href="#post-' + esc(featured.id) + '">Read the full post</a></div>' +
        '<a href="#post-' + esc(featured.id) + '" aria-label="' + esc(featured.title) + '">' + cover(featured, { chip: formatDate(featured.date) }) + "</a></div></section>";
    }

    // Stats
    var videos = all.filter(hasVideo).length;
    var events = counts["Excursions & Events"] || 0;
    h += '<section class="section"><div class="container"><div class="stats reveal">' +
      stat(all.length, "Assignments") + stat(events, "Excursions & events") + stat(videos, "Videos") + stat((d.glossary || []).length, "Key terms") +
      "</div></div></section>";

    // Assignments
    h += '<section class="section alt" id="posts" style="scroll-margin-top:48px"><div class="container">' +
      '<div class="section-head"><div><h2 class="section-title">All assignments.</h2><p class="section-sub">Newest first. Filter by topic or search.</p></div></div>' +
      '<div class="toolbar"><div class="filters" role="group" aria-label="Filter by topic">' +
      '<button type="button" class="chip-btn" data-filter="all" aria-pressed="' + (state.filter === "all") + '">All</button>' +
      (d.categories || []).map(function (c) {
        return '<button type="button" class="chip-btn" data-filter="' + slug(c) + '" aria-pressed="' + (state.filter === slug(c)) + '">' + esc(c) + "</button>";
      }).join("") + "</div>" +
      '<label class="search-wrap"><span class="sr-only">Search assignments</span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '<input id="search" class="search" type="search" placeholder="Search" value="' + esc(state.query) + '"></label></div>' +
      '<div id="post-list"></div></div></section>';

    // Topics
    var desc = d.topicDescriptions || {}, imgs = d.topicImages || {};
    h += '<section class="section" id="topics" style="scroll-margin-top:48px"><div class="container">' +
      '<div class="section-head"><div><h2 class="section-title">Topics.</h2><p class="section-sub">The eight areas of our Economics curriculum.</p></div></div>' +
      '<div class="topic-rail">' + (d.categories || []).map(function (c) {
        var img = imgs[c];
        return '<a class="topic-card' + (img ? " has-img" : "") + '" href="#topic-' + slug(c) + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : "") +
          '<span class="count">' + (counts[c] || 0) + (counts[c] === 1 ? " post" : " posts") + "</span><h3>" + esc(c) + "</h3><p>" + esc(desc[c] || "") + "</p></a>";
      }).join("") + "</div></div></section>";

    // Glossary
    h += '<section class="section alt" id="glossary" style="scroll-margin-top:48px"><div class="container">' +
      '<div class="section-head"><div><h2 class="section-title">Glossary.</h2><p class="section-sub">Every key term from my assignments, explained in one sentence.</p></div></div>' +
      '<div class="glossary-tools"><label class="search-wrap"><span class="sr-only">Search the glossary</span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '<input id="glossary-search" class="search" type="search" placeholder="Search terms, e.g. GDP" value="' + esc(state.glossaryQuery) + '"></label><span class="glossary-count" id="glossary-count"></span></div>' +
      '<dl class="glossary" id="glossary-list"></dl></div></section>';

    // Timeline
    var tl = all.slice();
    h += '<section class="section" id="timeline" style="scroll-margin-top:48px"><div class="container">' +
      '<div class="section-head" style="justify-content:center;text-align:center"><div><h2 class="section-title">The school year so far.</h2><p class="section-sub" style="margin-inline:auto">' + esc("School year " + (site.schoolYear || "")) + "</p></div></div>" +
      '<div class="timeline">' + tl.map(function (p) {
        var parts = String(p.date).split("-"), day = parseInt(parts[2], 10), mon = MONTHS[parseInt(parts[1], 10) - 1] || "";
        return '<a class="tl-item" href="#post-' + esc(p.id) + '"><div class="tl-date"><b>' + (day || "") + "</b>" + mon.slice(0, 3) + " " + parts[0] + "</div>" +
          "<div><h3>" + esc(p.title) + "</h3><p>" + esc((p.categories || []).join(" · ")) + " · " + formatLabel(p) + "</p></div></a>";
      }).join("") + "</div></div></section>";

    // About
    h += '<section class="section alt" id="about" style="scroll-margin-top:48px"><div class="container about">' +
      '<div><h2 class="section-title">About.</h2><div class="prose" style="margin-top:24px">' + markdown(site.about || "") + "</div></div>" +
      '<dl class="facts">' +
      (site.author ? "<div><dt>Student</dt><dd>" + esc(site.author) + "</dd></div>" : "") +
      (schoolLine ? "<div><dt>School</dt><dd>" + esc(schoolLine) + "</dd></div>" : "") +
      (site.schoolYear ? "<div><dt>School year</dt><dd>" + esc(site.schoolYear) + "</dd></div>" : "") +
      "<div><dt>Subject</dt><dd>" + esc(site.subject || "Economics") + "</dd></div>" +
      "<div><dt>Assignments</dt><dd>" + all.length + "</dd></div></dl></div></section>";

    app.innerHTML = h;
    renderList();
    renderGlossary();

    app.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        app.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        renderList();
      });
    });
    document.getElementById("search").addEventListener("input", function (e) { state.query = e.target.value; renderList(); });
    document.getElementById("glossary-search").addEventListener("input", function (e) { state.glossaryQuery = e.target.value; renderGlossary(); });
    setupReveal();
  }

  function stat(n, label) { return '<div class="stat"><div class="num" data-count="' + n + '">' + n + '</div><div class="lbl">' + esc(label) + "</div></div>"; }

  function renderList() {
    var list = document.getElementById("post-list");
    if (!list) return;
    var q = state.query.trim().toLowerCase();
    var res = posts().filter(function (p) {
      var inCat = state.filter === "all" || (p.categories || []).some(function (c) { return slug(c) === state.filter; });
      var hay = (p.title + " " + (p.excerpt || "") + " " + (p.categories || []).join(" ")).toLowerCase();
      return inCat && (!q || hay.indexOf(q) > -1);
    });
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
    list.innerHTML = groups.map(function (g) {
      return '<div><div class="month-label">' + formatDate(g.key) + "<span>" + g.posts.length + (g.posts.length === 1 ? " post" : " posts") + "</span></div>" +
        '<div class="tiles">' + g.posts.map(tile).join("") + "</div></div>";
    }).join("");
  }

  function tile(p) {
    return '<a class="tile" href="#post-' + esc(p.id) + '">' + cover(p) +
      '<div class="tile-body"><div class="tile-topics">' + esc((p.categories || []).join(" · ")) + "</div><h3>" + esc(p.title) + "</h3><p>" + esc(p.excerpt || "") + "</p>" +
      '<div class="tile-meta"><span>' + formatDate(p.date) + "</span><span>" + formatLabel(p) + "</span></div></div></a>";
  }

  function renderGlossary() {
    var el = document.getElementById("glossary-list");
    if (!el) return;
    var q = state.glossaryQuery.trim().toLowerCase();
    var terms = (state.data.glossary || []).slice().sort(function (a, b) { return a.term.localeCompare(b.term); }).filter(function (t) {
      return !q || (t.term + " " + t.definition).toLowerCase().indexOf(q) > -1;
    });
    document.getElementById("glossary-count").textContent = terms.length + (terms.length === 1 ? " term" : " terms");
    el.innerHTML = terms.length ? terms.map(function (t) {
      var p = t.post && postById(t.post);
      return '<div class="term"><dt>' + esc(t.term) + "</dt><dd>" + esc(t.definition) + "</dd>" + (p ? '<a href="#post-' + esc(p.id) + '">From: ' + esc(p.title) + "</a>" : "") + "</div>";
    }).join("") : '<div class="term" style="grid-column:1/-1"><dt>No matching term</dt><dd>Try another word.</dd></div>';
  }

  /* ---------- post ---------- */
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
    window.scrollTo(0, 0);
  }

  /* ---------- interactions ---------- */
  function setupReveal() {
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
    document.getElementById("footer-meta").textContent = [site.school && site.school + (site.city ? ", " + site.city : ""), site.schoolYear && "School year " + site.schoolYear].filter(Boolean).join(" · ");
    document.getElementById("footer-topics").innerHTML = (state.data.categories || []).map(function (c) { return '<a href="#topic-' + slug(c) + '">' + esc(c) + "</a>"; }).join("");

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

    var bar = document.getElementById("progress");
    window.addEventListener("scroll", function () {
      if (!/^#post-/.test(location.hash)) { bar.style.transform = "scaleX(0)"; return; }
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    }, { passive: true });
  }

  var SECTIONS = ["posts", "topics", "glossary", "timeline", "about"];
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    document.title = (state.data.site && state.data.site.title) || "Economics";
    if (h.indexOf("post-") === 0) { renderPost(h.slice(5)); return; }
    var target = null;
    if (h.indexOf("topic-") === 0) { state.filter = h.slice(6) || "all"; if (state.filter === "all") state.filter = "all"; target = "posts"; }
    else if (SECTIONS.indexOf(h) > -1) target = h;
    if (!document.getElementById("posts")) renderHome();
    else {
      app.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === state.filter)); });
      renderList();
    }
    if (target) { var el = document.getElementById(target); if (el) el.scrollIntoView(); }
    else window.scrollTo(0, 0);
    document.getElementById("progress").style.transform = "scaleX(0)";
  }

  function start(data) {
    state.data = data;
    setupChrome();
    route();
    window.addEventListener("hashchange", function () {
      if (/^#post-/.test(location.hash) || !document.getElementById("posts")) app.innerHTML = "";
      route();
    });
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
