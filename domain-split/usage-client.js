/* Shared aggregate events. No visitor ID, account token, search or URL telemetry. */
(function (w, d) {
  'use strict';
  if (w.MBMUsage) return;
  var KEY = 'mbm_usage_choice_v1', config = null, rows = [], byRoute = new Map();
  var once = new Set(), pending = new Set(), summaries = new Map(), started = false;
  var labels = {lesson_open: 'lesson opens', download_request: 'download requests', game_launch: 'game launches'};
  var readyResolve, ready = new Promise(function (resolve) { readyResolve = resolve; });
  function choice() { try { return w.localStorage.getItem(KEY) || 'unset'; } catch (_) { return 'unset'; } }
  function signalOff() { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || w.doNotTrack === '1'; }
  function allowed() { return !!(config && config.enabled && choice() === 'allow' && !signalOff() && !navigator.webdriver && navigator.onLine !== false && config.allowed_origins.indexOf(location.origin) !== -1); }
  function pathKey(value, base) {
    try { var u = new URL(value, base || location.href); if (!/^https?:$/.test(u.protocol)) return null;
      var path = decodeURIComponent(u.pathname).replace(/index\.html$/i, '').replace(/\/+$/, '') || '/';
      return {origin:u.origin, path:path};
    } catch (_) { return null; }
  }
  function endpoint(name) { return config.service_origin + '/functions/v1/' + name; }
  function stateText() {
    if (!config) return 'Statistics service status is unavailable. No optional activity event will be sent.';
    if (!config.enabled) return 'Shared statistics collection is not active. Historic totals, if any, are not loaded in this release.';
    if (signalOff()) return 'Optional statistics are off because this browser sends a privacy signal.';
    return choice() === 'allow' ? 'Optional statistics are on for this website in this browser. You can turn them off at any time.' : 'Optional statistics are off. You can use every public resource without allowing them.';
  }
  function paintChoice() {
    d.querySelectorAll('[data-usage-choice-status]').forEach(function (el) { el.textContent = stateText(); });
    d.querySelectorAll('[data-usage-choice]').forEach(function (el) {
      el.setAttribute('aria-pressed', String(choice() === el.dataset.usageChoice));
      el.disabled = el.dataset.usageChoice === 'allow' && (!config || !config.enabled || signalOff());
    });
  }
  function setChoice(value) {
    if (value !== 'allow' && value !== 'deny') return;
    try { w.localStorage.setItem(KEY, value); } catch (_) { /* No storage means no retained opt-in. */ }
    if (value === 'deny') { pending.forEach(function (controller) { controller.abort(); }); pending.clear(); }
    paintChoice(); if (value === 'allow') recordCurrentLesson();
  }
  function resolveRoute(href) {
    var key = pathKey(href); if (!key) return null;
    var origin = key.origin;
    if (/^https:\/\/(www\.)?madebymatt\.uk$/.test(origin) || origin === location.origin && config.source === 'education') origin = 'education';
    if (/^https:\/\/(www\.)?madebymatt-play\.uk$/.test(origin) || origin === location.origin && config.source === 'play') origin = 'play';
    return byRoute.get(origin + '\n' + key.path) || null;
  }
  function emit(row, eventType) {
    if (!allowed() || !row || row.event_types.indexOf(eventType) === -1) return Promise.resolve(false);
    var eventKey = row.source + ':' + row.resource_id + ':' + eventType;
    if (once.has(eventKey) || !w.crypto || typeof w.crypto.randomUUID !== 'function') return Promise.resolve(false);
    once.add(eventKey); // one event per resource/type in this page; no cross-visit identifier
    var controller = new AbortController(); pending.add(controller);
    var timer = setTimeout(function () { controller.abort(); }, 4500);
    return fetch(endpoint('usage-ingest'), {method:'POST', mode:'cors', keepalive:true, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({source:row.source,resource_id:row.resource_id,event_type:eventType,event_nonce:w.crypto.randomUUID()})
    }).then(function (r) { return r.ok; }).catch(function () { return false; }).finally(function () { clearTimeout(timer); pending.delete(controller); });
  }
  function recordCurrentLesson() {
    if (!config || config.source !== 'education') return;
    var row = resolveRoute(location.pathname);
    if (row && row.event_types.indexOf('lesson_open') !== -1) emit(row, 'lesson_open');
  }
  function bindActivity() {
    if (started) return; started = true;
    d.addEventListener('click', function (event) {
      var el = event.target && event.target.closest && event.target.closest('a[href]');
      if (!el || event.defaultPrevented || event.button !== 0) return;
      var row = resolveRoute(el.getAttribute('href'));
      if (!row) return;
      if (row.event_types.indexOf('download_request') !== -1) emit(row, 'download_request');
      else if (row.event_types.indexOf('game_launch') !== -1) emit(row, 'game_launch');
      // Lesson events occur at the destination, never both here and there.
    }, {passive:true});
    recordCurrentLesson();
  }
  function safeCount(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
  function publicSummary(source, ids) {
    if (!config || !config.enabled || ['education','play'].indexOf(source) < 0) return Promise.resolve(null);
    var idList = (ids || []).filter(function (id) { return /^[a-f0-9]{64}$/.test(id); }).slice(0,50);
    var key = source + ':' + idList.join(',');
    if (summaries.has(key)) return summaries.get(key);
    var controller = new AbortController(), timer = setTimeout(function () {controller.abort();}, 6500);
    var promise = fetch(endpoint('usage-public')+'?source='+source+(idList.length?'&ids='+idList.join(','):''),
      {credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal})
      .then(function (r) {if (!r.ok) throw new Error('unavailable');return r.json();})
      .then(function (value) {if (!value || value.schema !== 1 || value.source !== source || !value.windows) throw new Error('unavailable');return value;})
      .finally(function () {clearTimeout(timer);});
    summaries.set(key, promise); return promise;
  }
  function paintRanks(root, summary, kind, period) {
    var mount = root.querySelector('[data-usage-list="'+kind+'"]'); if (!mount) return;
    mount.replaceChildren();
    var windowData = summary && summary.windows && summary.windows[period];
    var items = windowData && windowData.top && windowData.top[kind];
    if (!Array.isArray(items) || !items.length) {
      var p = d.createElement('p'); p.className = 'usage-empty';
      p.textContent = !config || !config.enabled ? 'Collection is not active. Verified shared rankings are unavailable in this release.' : !summary ? 'Shared totals are unavailable right now. All resources still open normally.' : !summary.enabled ? 'Collection is paused. No ranked activity is available for this period.' : 'No recorded activity for this period yet. This list fills as people choose to contribute.';
      mount.appendChild(p); return;
    }
    var list = d.createElement('ol'), metric = {lessons:'lesson_open',packs:'download_request',games:'game_launch'}[kind];
    items.slice(0,10).forEach(function (item) {
      var row = rows.find(function (entry) {return entry.source === summary.source && entry.resource_id === item.resource_id;});
      if (!row || (kind==='packs' && row.kind!=='pack') || row.event_types.indexOf(metric) < 0 || safeCount(item.count) === null || item.count === 0) return;
      var li = d.createElement('li'), a = d.createElement('a'), count = d.createElement('span');
      a.href = row.source === 'play' ? 'https://www.madebymatt-play.uk'+row.route : row.route; a.textContent = row.title;
      count.className = 'usage-count'; count.textContent = item.count.toLocaleString('en-GB')+' '+labels[metric];
      li.append(a,count);list.appendChild(li);
    });
    if (list.children.length) mount.appendChild(list);
    else { var p = d.createElement('p');p.className='usage-empty';p.textContent='No validated resource totals are available for this period.';mount.appendChild(p); }
  }
  function initPopularity() {
    d.querySelectorAll('[data-usage-popularity]').forEach(function (root) {
      var select = root.querySelector('[data-usage-period]');
      function refresh() {
        var period = select ? select.value : 'last30days';
        if (period !== 'alltime') period='last30days';
        Promise.allSettled([root.dataset.usagePopularity==='play'?Promise.resolve(null):publicSummary('education'),publicSummary('play')]).then(function (results) {
          var education = results[0].status==='fulfilled'?results[0].value:null, play=results[1].status==='fulfilled'?results[1].value:null;
          paintRanks(root, education, 'lessons', period);paintRanks(root, education, 'packs', period);paintRanks(root, play, 'games', period);
          var status=root.querySelector('[data-usage-measured-since]');
          if (status) {
            var begins=[education,play].filter(function (s) {return s && s.measured_since;}).map(function (s) {return (s.source==='play'?'Play':'Education')+': '+new Date(s.measured_since).toLocaleDateString('en-GB',{timeZone:'UTC'});});
            var paused=[education,play].filter(function (s) {return s && !s.enabled;}).map(function (s) {return (s.source==='play'?'Play':'Education')+' collection is paused.';});
            status.textContent=(!config || !config.enabled)?stateText():begins.length?'Recorded activity since — '+begins.join('; ')+'. '+paused.join(' ')+' Totals count events, not people.':(education||play)?'No collection start date is available yet. '+paused.join(' '):'Shared totals are unavailable right now. All resources still open normally.';
          }
        });
      }
      if (select) select.addEventListener('change',refresh);refresh();
    });
  }
  function initDownloadCounts() {
    var groups=new Map();
    d.querySelectorAll('a[href]').forEach(function (link) {
      var row=resolveRoute(link.getAttribute('href'));
      if (!row || row.event_types.indexOf('download_request')<0 || link.querySelector('.usage-resource-count')) return;
      var label=d.createElement('span');label.className='usage-resource-count';
      label.textContent=config.enabled?'Shared download requests: loading…':'Shared download requests: collection not active';
      link.appendChild(label); if (!groups.has(row.resource_id)) groups.set(row.resource_id,[]);groups.get(row.resource_id).push(label);
    });
    if (!config.enabled || !groups.size) return;
    var ids=Array.from(groups.keys());
    for (var i=0;i<ids.length;i+=50) (function (batch) {
      publicSummary('education',batch).then(function (summary) {
        var counts=new Map((summary && summary.resources || []).filter(function (r) {return r.event_type==='download_request';}).map(function (r) {return [r.resource_id,r];}));
        batch.forEach(function (id) {var row=counts.get(id),n=row&&safeCount(row.alltime);groups.get(id).forEach(function (label) {label.textContent=n!==null && n!==undefined?'Shared download requests: '+n.toLocaleString('en-GB')+' all time':'Shared download requests: no total available yet';});});
      }).catch(function () {batch.forEach(function (id) {groups.get(id).forEach(function (label) {label.textContent='Shared download requests unavailable';});});});
    })(ids.slice(i,i+50));
  }
  d.addEventListener('click',function (event) {var el=event.target&&event.target.closest&&event.target.closest('[data-usage-choice]');if (el) setChoice(el.dataset.usageChoice);});
  w.addEventListener('storage',function (event) {if (event.key===KEY) {paintChoice();if (choice()!=='allow') {pending.forEach(function (controller) {controller.abort();});pending.clear();}}});
  w.MBMUsage={ready:ready,choice:choice,setChoice:setChoice,publicSummary:publicSummary,paintRanks:paintRanks,
    get config(){return config;},get registry(){return rows.slice();}};
  fetch('/data/usage-config.json',{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}).then(function (r) {if(!r.ok)throw new Error('config');return r.json();})
    .then(function (value) {
      if (!value || value.schema!==1 || ['education','play'].indexOf(value.source)<0 || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value.service_origin) || !Array.isArray(value.allowed_origins)) throw new Error('config');
      config=value; config.enabled=value.enabled===true;
      // The registry contains public paths only; loading it records no activity.
      return fetch('/data/usage-registry.json',{credentials:'omit',referrerPolicy:'no-referrer'}).then(function (r) {if(!r.ok)throw new Error('registry');return r.json();});
    }).then(function (registry) {
      if (!Array.isArray(registry)) throw new Error('registry');
      rows=registry.filter(function (row) {return row && ['education','play'].indexOf(row.source)>=0 && /^[a-f0-9]{64}$/.test(row.resource_id) && typeof row.title==='string' && /^\/(?!\/)/.test(row.route) && !/[?#]/.test(row.route) && Array.isArray(row.event_types) && row.event_types.every(function (type) {return !!labels[type];});});
      rows.forEach(function (row) {[row.route].concat(row.aliases||[]).forEach(function (route) {var key=pathKey(route);if(key)byRoute.set(row.source+'\n'+key.path,row);});});
      paintChoice();bindActivity();initPopularity();initDownloadCounts();
      var scanTimer;
      new MutationObserver(function (changes) {
        if (!changes.some(function (change) {return Array.from(change.addedNodes).some(function (node) {return node.nodeType===1 && (node.matches('a[href]') || node.querySelector('a[href]'));});})) return;
        clearTimeout(scanTimer);scanTimer=setTimeout(initDownloadCounts,150);
      }).observe(d.body,{childList:true,subtree:true});
      readyResolve(config);
    }).catch(function () {config=null;paintChoice();initPopularity();readyResolve(null);});
})(window,document);
