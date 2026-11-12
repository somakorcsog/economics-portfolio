/* Economics Portfolio: renders everything from posts.json.
   You never need to edit this file to add a post. */
(function () {
  "use strict";

  var TOPIC_COLORS = {
    "introduction": "--t-intro",
    "markets": "--t-markets",
    "money": "--t-money",
    "business-cycles": "--t-cycles",
    "sustainability": "--t-sustain",
    "europe": "--t-europe",
    "international": "--t-international",
    "excursions-events": "--t-events"
  };

  var ICONS = {
    text: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    video: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg>',
    audio: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10V7m3 5V4m3 7V5m3 4V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    slides: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11v2.5M5.5 13.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m3.5 11.5 3-3 2 2 1.5-1.5 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
  };
  var FORMAT_NAMES = { text: "Article", video: "Video", audio: "Audio / Podcast", slides: "Presentation", image: "Images" };

  var state = { data: null, filter: "all", query: "" };
  var app = document.getElementById("app");

  /* ---------- helpers ---------- */
  function slug(s) {
    return String(s).toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function topicVar(cat) { return "var(" + (TOPIC_COLORS[slug(cat)] || "--muted") + ")"; }
  function toText(c) { return Array.isArray(c) ? c.join("\n") : String(c || ""); }

  function formatDate(d) {
    if (!d) return "";
    var parts = String(d).split("-");
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var y = parts[0], m = parseInt(parts[1], 10), day = parseInt(parts[2], 10);
    if (!m) return y;
    return (day ? day + " " : "") + months[m - 1] + " " + y;
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

  /* Small Markdown renderer: headings, lists, quotes, paragraphs, bold, italic, links. */
  function markdown(src) {
    var lines = toText(src).replace(/\r/g, "").split("\n");
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<" + list.tag + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flushPara(); flushList();
        var lvl = Math.min(m[1].length + 1, 3);
        out.push("<h" + lvl + ">" + inline(m[2]) + "</h" + lvl + ">");
      } else if ((m = line.match(/^[-*•]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); flushList();
        out.push("<blockquote>" + inline(m[1]) + "</blockquote>");
      } else {
        flushList(); para.push(line);
      }
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

  function postFormats(post) {
    var f = {};
    (post.blocks || []).forEach(function (b) {
      var t = b.type;
      if (t === "video" || t === "youtube") f.video = 1;
      else if (t === "audio" || t === "podcast") f.audio = 1;
      else if (t === "pdf" || t === "slides" || t === "presentation") f.slides = 1;
      else if (t === "image") f.image = 1;
      else f.text = 1;
    });
    return Object.keys(f);
  }

  function readingTime(post) {
    var words = 0;
    (post.blocks || []).forEach(function (b) { if (b.content) words += toText(b.content).split(/\s+/).length; });
    return Math.max(1, Math.round(words / 200));
  }

  function tags(cats, linked) {
    return (cats || []).map(function (c) {
      var inner = '<span class="dot" style="--topic:' + topicVar(c) + '"></span>' + esc(c);
      return linked
        ? '<a class="tag" style="--topic:' + topicVar(c) + '" href="#topic-' + slug(c) + '">' + inner + "</a>"
        : '<span class="tag" style="--topic:' + topicVar(c) + '">' + inner + "</span>";
    }).join("");
  }

  function formatIcons(post) {
    return '<span class="formats">' + postFormats(post).map(function (f) {
      return '<span class="format-icon" title="' + FORMAT_NAMES[f] + '" aria-label="' + FORMAT_NAMES[f] + '">' + ICONS[f] + "</span>";
    }).join("") + "</span>";
  }

  function sortedPosts() {
    return (state.data.posts || []).filter(function (p) { return !p.draft; }).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
  }

  /* ---------- media blocks ---------- */
  function placeholder(title, file, note) {
    return '<div class="placeholder"><div class="frame-art"></div>' +
      '<div class="play-circle"><svg width="26" height="26" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" fill="currentColor"/></svg></div>' +
      "<strong>" + esc(title) + "</strong>" +
      (file ? "<code>" + esc(file) + "</code>" : "") +
      (note ? "<span>" + esc(note) + "</span>" : "") + "</div>";
  }

  function caption(b) { return b.caption ? "<figcaption>" + inline(b.caption) + "</figcaption>" : ""; }

  function renderBlock(b) {
    var t = (b.type || "text").toLowerCase();
    switch (t) {
      case "heading":
        return '<h2 class="section-heading" id="' + slug(b.text) + '">' + esc(b.text) + "</h2>";

      case "text":
        return '<div class="prose">' + markdown(b.content) + "</div>";

      case "notes":
        return '<div class="notes">' + (b.label ? '<span class="eyebrow">' + esc(b.label) + "</span>" : "") +
          '<div class="prose">' + markdown(b.content) + "</div></div>";

      case "quote":
        return '<div class="prose"><blockquote>' + inline(toText(b.content)) + (b.author ? "<br>— " + esc(b.author) : "") + "</blockquote></div>";

      case "video":
        if (!b.src) {
          return '<figure class="media"><div class="media-frame">' + placeholder(b.title || "Video coming soon", "", "Video will be added soon.") + "</div>" + caption(b) + "</figure>";
        }
        return '<figure class="media"><div class="media-frame" data-video>' +
          '<video controls playsinline preload="metadata"' + (b.poster ? ' poster="' + esc(b.poster) + '"' : "") + ">" +
          '<source src="' + esc(b.src) + '" type="' + (/\.webm$/i.test(b.src) ? "video/webm" : /\.mov$/i.test(b.src) ? "video/quicktime" : "video/mp4") + '">' +
          "</video>" +
          '<template>' + placeholder(b.title || "Video coming soon", b.src, "Put the video file at this path to show it here.") + "</template>" +
          "</div>" + caption(b) + "</figure>";

      case "youtube":
        var id = youtubeId(b.url || b.src);
        if (!id) return "";
        return '<figure class="media"><div class="media-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + id +
          '" title="' + esc(b.title || "YouTube video") + '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>' +
          caption(b) + "</figure>";

      case "audio":
      case "podcast":
        return '<figure class="audio-card"><div class="audio-head"><span class="audio-icon">' + ICONS.audio.replace(/14/g, "20") + "</span>" +
          "<div><div class=\"display\" style=\"font-weight:700;font-size:1.05rem\">" + esc(b.title || "Podcast episode") + "</div>" +
          (b.caption ? '<div class="muted" style="font-size:.86rem">' + inline(b.caption) + "</div>" : "") + "</div></div>" +
          '<audio controls preload="metadata" src="' + esc(b.src) + '"></audio></figure>';

      case "pdf":
        return '<figure class="media"><div class="doc-bar"><div><div class="eyebrow">PDF</div><div class="display" style="font-weight:700;font-size:1.1rem">' + esc(b.title || "Document") + "</div></div>" +
          '<a class="btn secondary" href="' + esc(b.src) + '" target="_blank" rel="noopener">Open PDF</a></div>' +
          '<div class="media-frame tall"><iframe src="' + esc(b.src) + '#view=FitH" title="' + esc(b.title || "PDF") + '" loading="lazy"></iframe></div>' + caption(b) + "</figure>";

      case "slides":
      case "presentation":
        var url = slidesEmbed(b.url || b.src);
        return '<figure class="media"><div class="doc-bar"><div><div class="eyebrow">Presentation</div><div class="display" style="font-weight:700;font-size:1.1rem">' + esc(b.title || "Slides") + "</div></div>" +
          '<a class="btn secondary" href="' + esc(b.url || b.src) + '" target="_blank" rel="noopener">Open slides</a></div>' +
          '<div class="media-frame"><iframe src="' + esc(url) + '" title="' + esc(b.title || "Slides") + '" allowfullscreen loading="lazy"></iframe></div>' + caption(b) + "</figure>";

      case "image":
        return '<figure class="media"><img src="' + esc(b.src) + '" alt="' + esc(b.alt || b.caption || "") + '" loading="lazy">' + caption(b) + "</figure>";

      case "link":
        return '<p><a class="btn" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.text || b.url) + " →</a></p>";

      default:
        return b.content ? '<div class="prose">' + markdown(b.content) + "</div>" : "";
    }
  }

  /* When a video file is missing, swap in the placeholder. */
  function wireVideos(root) {
    root.querySelectorAll("[data-video]").forEach(function (frame) {
      var video = frame.querySelector("video"), tpl = frame.querySelector("template");
      if (!video || !tpl) return;
      var swap = function () { if (frame.contains(video)) { frame.innerHTML = tpl.innerHTML; } };
      var source = video.querySelector("source");
      if (source) source.addEventListener("error", swap);
      video.addEventListener("error", swap);
    });
  }

  /* ---------- views ---------- */
  var HERO_CHART =
    '<svg class="hero-chart" viewBox="0 0 320 240" role="img" aria-label="Supply and demand diagram with equilibrium point">' +
    '<line class="grid" x1="40" y1="60" x2="300" y2="60"/><line class="grid" x1="40" y1="110" x2="300" y2="110"/><line class="grid" x1="40" y1="160" x2="300" y2="160"/>' +
    '<path class="axis" d="M40 16 V200 H304"/>' +
    '<path class="d" d="M58 36 C 120 80, 200 150, 286 188"/>' +
    '<path class="s" d="M58 186 C 130 150, 210 80, 286 34"/>' +
    '<path class="guide" d="M40 110.5 H170.5 V200"/>' +
    '<circle class="eq" cx="170.5" cy="110.5" r="5"/>' +
    '<text x="28" y="22" text-anchor="end">P</text><text x="304" y="216" text-anchor="end">Q</text>' +
    '<text x="34" y="114" text-anchor="end">P*</text><text x="170" y="216" text-anchor="middle">Q*</text>' +
    '<text x="290" y="180" text-anchor="end">D</text><text x="290" y="48" text-anchor="end">S</text>' +
    "</svg>";

  function renderHome() {
    var d = state.data, site = d.site || {};
    var posts = sortedPosts();
    var featured = posts.filter(function (p) { return p.featured; })[0] || posts[0];
    var counts = {};
    posts.forEach(function (p) { (p.categories || []).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });

    var title = site.title || "Economics Portfolio";
    var titleHtml = esc(title).replace(/^(Economics)/, "<em>$1</em>");

    var html = '<section class="hero"><div class="flex flex-col gap-5">' +
      '<span class="eyebrow">' + esc(site.school ? site.school + " · " : "") + "Economics · School Portfolio</span>" +
      "<h1>" + titleHtml + "</h1><p>" + esc(site.intro || "") + "</p>" +
      '<div class="flex flex-wrap gap-3"><a class="btn" href="#posts">Browse assignments</a>' +
      (featured ? '<a class="btn secondary" href="#post-' + esc(featured.id) + '">Latest post</a>' : "") + "</div>" +
      "</div>" + HERO_CHART + "</section>";

    if (featured) {
      var hasVideo = postFormats(featured).indexOf("video") > -1;
      html += '<a class="featured" href="#post-' + esc(featured.id) + '">' +
        '<div class="featured-media">' + (featured.cover ? '<img src="' + esc(featured.cover) + '" alt="">' :
          '<div class="frame-art"></div><div class="play-circle">' + (hasVideo ? ICONS.video.replace(/14/g, "26") : ICONS.text.replace(/14/g, "26")) + "</div>") + "</div>" +
        '<div class="featured-body"><span class="badge-featured">Featured assignment</span>' +
        '<div class="flex flex-wrap gap-2">' + tags(featured.categories) + "</div>" +
        "<h2>" + esc(featured.title) + "</h2>" +
        '<p class="muted">' + esc(featured.excerpt || "") + "</p>" +
        '<div class="card-meta"><span class="mono">' + formatDate(featured.date) + "</span>" + formatIcons(featured) + "</div>" +
        "</div></a>";
    }

    html += '<section id="posts" class="flex flex-col gap-5 pt-14" style="scroll-margin-top:90px">' +
      '<div class="flex flex-col md:flex-row md:items-end justify-between gap-4">' +
      '<div><span class="eyebrow">Topics</span><h2 class="display" style="font-size:1.9rem;font-weight:800;line-height:1.1;margin-top:4px">All assignments</h2></div>' +
      '<label class="relative block w-full md:w-72"><span class="sr-only">Search posts</span>' +
      '<svg class="absolute left-3.5 top-1/2 -translate-y-1/2 muted" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.5 10.5 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '<input id="search" class="search" type="search" placeholder="Search assignments" value="' + esc(state.query) + '"></label></div>' +
      '<div class="filters" role="group" aria-label="Filter by topic">' +
      '<button type="button" class="chip" data-filter="all" aria-pressed="' + (state.filter === "all") + '">All Posts <span class="count">' + posts.length + "</span></button>" +
      (d.categories || []).map(function (c) {
        return '<button type="button" class="chip" data-filter="' + slug(c) + '" aria-pressed="' + (state.filter === slug(c)) + '"><span class="dot" style="--topic:' + topicVar(c) + '"></span>' + esc(c) + ' <span class="count">' + (counts[c] || 0) + "</span></button>";
      }).join("") + "</div>" +
      '<div id="post-list"></div></section>';

    app.innerHTML = html;
    renderList();

    app.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.getAttribute("data-filter");
        try { history.replaceState(null, "", f === "all" ? location.pathname + location.search : "#topic-" + f); } catch (e) {}
        state.filter = f;
        app.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        renderList();
      });
    });
    document.getElementById("search").addEventListener("input", function (e) { state.query = e.target.value; renderList(); });
  }

  function renderList() {
    var list = document.getElementById("post-list");
    if (!list) return;
    var q = state.query.trim().toLowerCase();
    var posts = sortedPosts().filter(function (p) {
      var inCat = state.filter === "all" || (p.categories || []).some(function (c) { return slug(c) === state.filter; });
      var hay = (p.title + " " + (p.excerpt || "") + " " + (p.categories || []).join(" ")).toLowerCase();
      return inCat && (!q || hay.indexOf(q) > -1);
    });
    if (!posts.length) {
      var cat = (state.data.categories || []).filter(function (c) { return slug(c) === state.filter; })[0];
      list.innerHTML = '<div class="empty"><div class="display" style="font-size:1.2rem;font-weight:700;color:var(--ink)">No assignments here yet</div>' +
        "<p>" + (q ? "Nothing matches “" + esc(state.query) + "”." : "Posts about " + esc(cat || "this topic") + " will appear here.") + "</p></div>";
      return;
    }
    list.innerHTML = '<div class="grid-posts">' + posts.map(function (p) {
      return '<a class="card" href="#post-' + esc(p.id) + '"><div class="flex flex-wrap gap-2">' + tags(p.categories) + "</div>" +
        "<h3>" + esc(p.title) + "</h3><p>" + esc(p.excerpt || "") + "</p>" +
        '<div class="card-meta"><span class="mono">' + formatDate(p.date) + "</span><span style=\"flex:1\"></span>" + formatIcons(p) + "</div></a>";
    }).join("") + "</div>";
  }

  function renderPost(id) {
    var post = (state.data.posts || []).filter(function (p) { return p.id === id; })[0];
    if (!post) { renderNotFound(); return; }
    document.title = post.title + " · " + (state.data.site.title || "Economics Portfolio");
    app.innerHTML = '<article class="article">' +
      '<a class="back-link" href="#posts"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>All assignments</a>' +
      '<div class="flex flex-wrap gap-2 mt-8">' + tags(post.categories, true) + "</div>" +
      "<h1>" + esc(post.title) + "</h1>" +
      (post.excerpt ? '<p class="article-lead">' + esc(post.excerpt) + "</p>" : "") +
      '<div class="flex flex-wrap items-center gap-3 mt-5 muted"><span class="mono">' + formatDate(post.date) + '</span><span class="mono">·</span><span class="mono">' + readingTime(post) + " min read</span>" + formatIcons(post) + "</div>" +
      '<div class="article-body">' + (post.blocks || []).map(renderBlock).join("") + "</div></article>";
    wireVideos(app);
    window.scrollTo(0, 0);
  }

  function renderAbout() {
    var site = state.data.site || {};
    app.innerHTML = '<section class="about"><span class="eyebrow">About</span>' +
      '<h1 class="display" style="font-size:clamp(2rem,4.4vw,2.8rem);font-weight:800;line-height:1.05;margin-block:10px 18px">About this portfolio</h1>' +
      '<div class="prose">' + markdown(site.about || [
        "This website collects my assignments for **Economics** class: articles, filmed interviews, podcasts and presentations.",
        "",
        "Posts are sorted by topic, from how markets and money work to business cycles, sustainability, Europe and the global economy. Excursions and events get their own category."
      ]) + "</div></section>";
    window.scrollTo(0, 0);
  }

  function renderNotFound() {
    app.innerHTML = '<div class="empty" style="margin-block:64px"><div class="display" style="font-size:1.4rem;font-weight:700;color:var(--ink)">Post not found</div><p><a href="#" style="color:var(--accent)">Back to all assignments</a></p></div>';
  }

  /* ---------- navigation ---------- */
  function buildMenus() {
    var cats = state.data.categories || [];
    var items = cats.map(function (c) {
      return '<a href="#topic-' + slug(c) + '"><span class="flex items-center gap-2"><span class="dot" style="--topic:' + topicVar(c) + '"></span>' + esc(c) + "</span></a>";
    }).join("");
    document.getElementById("topics-dropdown").innerHTML = '<a href="#topic-all"><span>All Posts</span></a>' + items;
    document.querySelector("#mobile-menu .wrap").innerHTML =
      '<a href="#">Posts</a><a href="#about">About</a><div class="eyebrow group-label">Topics</div><a href="#topic-all">All Posts</a>' + items;

    var btn = document.getElementById("topics-btn"), dd = document.getElementById("topics-dropdown");
    btn.addEventListener("click", function (e) { e.stopPropagation(); dd.hidden = !dd.hidden; btn.setAttribute("aria-expanded", String(!dd.hidden)); });
    document.addEventListener("click", function () { dd.hidden = true; btn.setAttribute("aria-expanded", "false"); });

    var mb = document.getElementById("menu-btn"), mm = document.getElementById("mobile-menu");
    mb.addEventListener("click", function () { mm.hidden = !mm.hidden; mb.setAttribute("aria-expanded", String(!mm.hidden)); });
    mm.addEventListener("click", function (e) { if (e.target.closest("a")) { mm.hidden = true; mb.setAttribute("aria-expanded", "false"); } });
  }

  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    document.title = (state.data.site && state.data.site.title) || "Economics Portfolio";
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.removeAttribute("aria-current"); });
    if (h.indexOf("post-") === 0) { renderPost(h.slice(5)); return; }
    if (h === "about") { document.querySelector('[data-nav="about"]').setAttribute("aria-current", "page"); renderAbout(); return; }
    document.querySelector('[data-nav="home"]').setAttribute("aria-current", "page");
    var scrollToPosts = h === "posts" || h.indexOf("topic-") === 0;
    if (h.indexOf("topic-") === 0) state.filter = h.slice(6) || "all";
    renderHome();
    if (scrollToPosts) {
      var el = document.getElementById("posts");
      if (el) el.scrollIntoView();
    } else { window.scrollTo(0, 0); }
  }

  function start(data) {
    state.data = data;
    var t = (data.site && data.site.title) || "Economics Portfolio";
    document.getElementById("site-title").textContent = t;
    document.getElementById("footer-title").textContent = t + (data.site && data.site.author ? " · " + data.site.author : "");
    document.getElementById("year").textContent = new Date().getFullYear();
    buildMenus();
    route();
    window.addEventListener("hashchange", route);
  }

  fetch("posts.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function (err) {
      app.innerHTML = '<div class="empty" style="margin-block:64px"><div class="display" style="font-size:1.3rem;font-weight:700;color:var(--ink)">The posts could not be loaded</div>' +
        "<p>Open the site through a local server (double-click <code>start-preview</code>) instead of opening index.html directly. If you just edited posts.json, check it for a missing comma or quote.</p></div>";
      console.error(err);
    });
})();
