(function(app) {
  const $ = s => document.querySelector(s);
  const stage = $('#stage');
  const nodesLayer = $('#nodes');
  const preview = $('#preview');
  const previewFrame = preview.querySelector('iframe');
  const logEl = $('#log');
  const progressBar = $('#progress-bar');
  const progressFill = progressBar.querySelector('.fill');

  let currentSessionId = null;
  let pollTimer = null;
  let graphNodes = [];
  let graphLinks = [];

  function log(msg) {
    const line = document.createElement('div');
    line.textContent = '> ' + msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function beep(freq, dur) {
    freq = freq || 1200;
    dur = dur || 0.04;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur + 0.01);
    } catch (e) {}
  }

  function positionPreview(e) {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + 360 > window.innerWidth) x = e.clientX - 360 - pad;
    if (y + 270 > window.innerHeight) y = e.clientY - 270 - pad;
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
  }

  function createNodeElement(n) {
    const el = document.createElement('div');
    el.className = 'node' + (n.center ? ' center' : '') + (n.cursed ? ' cursed' : '');
    el.dataset.url = n.url;
    el.dataset.nodeId = n.id;

    const img = document.createElement('img');
    img.src = window.KRUX.renderer.makeBadge(n.label || n.url, n.center);
    img.alt = n.label;
    el.appendChild(img);

    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = n.label || n.url;
    el.appendChild(lab);

    nodesLayer.appendChild(el);
    n.el = el;

    el.addEventListener('mouseenter', function(e) {
      beep(1400, 0.03);
      preview.style.display = 'block';
      previewFrame.src = '/api/proxy?url=' + encodeURIComponent(n.url);
      positionPreview(e);
    });

    el.addEventListener('mousemove', positionPreview);

    el.addEventListener('mouseleave', function() {
      preview.style.display = 'none';
      previewFrame.src = 'about:blank';
    });

    el.addEventListener('click', function(e) {
      if (e.detail === 1) {
        beep(800, 0.05);
        window.open(n.url, '_blank');
      }
    });

    el.addEventListener('dblclick', function() {
      if (n.center) return;
      expandNode(n);
    });

    return el;
  }

  async function expandNode(n) {
    if (n.center) return;
    if (n.expanded) {
      log('already expanded: ' + n.url);
      return;
    }
    if (!currentSessionId) return;

    log('expanding: ' + n.url);
    n.expanded = true;

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, node_url: n.url }),
      });
      const data = await res.json();
      if (data.expanded) {
        log('expansion queued for: ' + n.url);
        setTimeout(() => fetchGraph(currentSessionId), 1500);
      }
    } catch (e) {
      log('expand failed: ' + e.message);
    }
  }

  function clearGraph() {
    window.KRUX.graph.stop();
    nodesLayer.innerHTML = '';
    const svgEl = document.querySelector('svg.links');
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    window.KRUX.graph.init(svgEl, w, h);
    graphNodes = [];
    graphLinks = [];
  }

  function renderGraph(apiNodes, apiLinks) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;

    nodesLayer.innerHTML = '';

    graphNodes = apiNodes.map(function(n, i) {
      return { ...n, id: n.id || String(i), center: i === 0 };
    });

    graphLinks = apiLinks.map(function(l) {
      return { source: l.source, target: l.target };
    });

    const svgEl = document.querySelector('svg.links');
    window.KRUX.graph.init(svgEl, w, h);

    graphNodes.forEach(function(n) { createNodeElement(n); });
    window.KRUX.graph.setGraph(graphNodes, graphLinks);
    window.KRUX.graph.render(w, h);

    if (graphNodes[0] && graphNodes[0].el) {
      graphNodes[0].el.classList.add('center');
    }

    $('#count').textContent = (graphNodes.length - 1) + ' links';
    log('rendered ' + graphNodes.length + ' nodes, ' + graphLinks.length + ' links');
  }

  function updateProgress(pct) {
    progressFill.style.width = Math.min(pct, 100) + '%';
  }

  async function fetchGraph(sessionId) {
    try {
      const res = await fetch('/api/graph/' + sessionId);
      const data = await res.json();
      if (data.nodes) {
        window.KRUX.graph.stop();
        renderGraph(data.nodes, data.links || []);
      }
    } catch (e) {
      log('fetch graph failed: ' + e.message);
    }
  }

  async function pollStatus(sessionId) {
    try {
      const res = await fetch('/api/status/' + sessionId);
      const data = await res.json();
      if (data.error) {
        log('session error: ' + data.error);
        stopScan();
        return;
      }

      log('status: ' + data.status + ' (' + data.node_count + ' nodes, ' + data.link_count + ' links)');

      if (data.total > 0) {
        updateProgress((data.progress / data.total) * 100);
      } else {
        updateProgress(50);
      }

      if (data.status === 'complete' || data.status === 'error') {
        stopScan();
        if (data.node_count > 0) {
          fetchGraph(sessionId);
        }
        updateProgress(100);
        log('scan ' + data.status);
        return;
      }

      pollTimer = setTimeout(function() { pollStatus(sessionId); }, 800);
    } catch (e) {
      log('poll failed: ' + e.message);
      pollTimer = setTimeout(function() { pollStatus(sessionId); }, 1500);
    }
  }

  function stopScan() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    $('#summon').disabled = false;
    $('#summon').textContent = 'SCAN';
    progressBar.style.display = 'none';
  }

  async function startScan() {
    const raw = $('#url').value.trim();
    if (!raw) return;

    let url = raw.startsWith('http') ? raw : 'https://' + raw;
    try { new URL(url); } catch (e) { alert('INVALID URL'); return; }

    const depth = parseInt($('#depth').value) || 1;

    $('#summon').disabled = true;
    $('#summon').textContent = 'SCANNING...';
    logEl.style.display = 'block';
    logEl.innerHTML = '';
    progressBar.style.display = 'block';
    updateProgress(5);

    log('init scan: ' + url + ' (depth: ' + depth + ')');
    clearGraph();
    currentSessionId = null;

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, depth: depth, max_links: 100 }),
      });
      const data = await res.json();
      currentSessionId = data.session_id;
      log('session: ' + currentSessionId);
      updateProgress(10);
      pollStatus(currentSessionId);
    } catch (e) {
      log('scan failed: ' + e.message);
      stopScan();
    }
  }

  function exportDot() {
    beep(600, 0.06);
    let dot = 'digraph KRUX {\n  graph [bgcolor=black, color="#ff3333", fontcolor="#ff3333", fontname="Share Tech Mono"];\n  node [shape=box, style=filled, fillcolor=black, color="#ff3333", fontcolor="#ff3333", fontname="Share Tech Mono", fontsize=10];\n  edge [color="#3f0f0f"];\n';
    graphNodes.forEach(function(n) {
      dot += '  "' + n.id + '" [label="' + (n.label || n.url).replace(/"/g, '') + '"];\n';
    });
    graphLinks.forEach(function(l) {
      var src = l.source.id || l.source;
      var tgt = l.target.id || l.target;
      dot += '  "' + src + '" -> "' + tgt + '";\n';
    });
    dot += '}\n';

    var blob = new Blob([dot], { type: 'text/vnd.graphviz' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'krux-terminal.dot';
    a.click();
    log('exported .dot');

    var canvas = document.querySelector('#spell canvas');
    window.KRUX.renderer.renderSpell(canvas, graphNodes, graphLinks);
    $('#spell').style.display = 'flex';
  }

  function fitDevice() {
    // window is sized to the scaled device (870*BASE x 1074*BASE), so the
    // casing fills it exactly. derive --s from the real window width.
    const s = window.innerWidth / 870;
    document.getElementById('device').style.setProperty('--s', s.toFixed(4));
  }

  function init() {
    fitDevice();
    window.addEventListener('resize', fitDevice);

    // --- frameless casing: drag via the titlebar, resize via the corner grip ---
    const api = window.pywebview && window.pywebview.api;
    const titlebar = $('#titlebar');
    const grip = $('#resize');

    let dragMoved = false;
    if (titlebar && api && api.drag_by) {
      titlebar.addEventListener('pointerdown', function(e) {
        if (e.target !== titlebar) return;
        dragMoved = false;
        const startX = e.clientX, startY = e.clientY;
        function move(ev) {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
          api.drag_by(dx, dy);
        }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
      titlebar.addEventListener('click', e => { if (dragMoved) e.stopPropagation(); });
    }
    if (grip && api && api.resize_by) {
      grip.addEventListener('pointerdown', function(e) {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        function move(ev) {
          api.resize_by(ev.clientX - startX, ev.clientY - startY);
        }
        function up() {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
        }
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });
    }

    // --- close / minimize live on the casing bezel (no OS toolbar) ---
    const winClose = $('#winClose');
    const winMin = $('#winMin');
    if (winClose && api && api.close) winClose.addEventListener('click', () => api.close());
    if (winMin && api && api.minimize) winMin.addEventListener('click', () => api.minimize());

    $('#summon').onclick = startScan;
    $('#url').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') startScan();
    });
    $('#export').onclick = exportDot;
    $('#toggleLog').onclick = function() {
      logEl.style.display = logEl.style.display === 'block' ? 'none' : 'block';
    };
    $('#closeSpell').onclick = function() {
      $('#spell').style.display = 'none';
    };
    $('#zoomIn').onclick = function() { window.KRUX.graph.zoomIn(); };
    $('#zoomOut').onclick = function() { window.KRUX.graph.zoomOut(); };
    $('#zoomReset').onclick = function() { window.KRUX.graph.resetZoom(); };

    var w = stage.clientWidth;
    var h = stage.clientHeight;
    window.KRUX.graph.init(document.querySelector('svg.links'), w, h);

    window.addEventListener('resize', function() {
      var w2 = stage.clientWidth;
      var h2 = stage.clientHeight;
      document.querySelector('svg.links').setAttribute('viewBox', '0 0 ' + w2 + ' ' + h2);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})((window.KRUX = window.KRUX || {}).app = {});
