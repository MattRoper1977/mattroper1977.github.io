/* mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09
   One deterministic, same-origin discovery engine for root suggestions,
   Teach Hub, Resource Catalogue and Professional Education Hub. */
(function(){
  'use strict';
  var doc=document;
  var INDEX_URL='/data/mbm-search-index.json';
  var EDUCATION_URL='/data/education-hub.json';
  var indexPromise=null;
  var educationPromise=null;

  function fetchJson(url){
    return fetch(url,{credentials:'same-origin',cache:'force-cache'}).then(function(response){
      if(!response.ok)throw new Error(url+' returned '+response.status);
      return response.json();
    });
  }
  function loadIndex(){
    if(!indexPromise)indexPromise=fetchJson(INDEX_URL).then(function(data){
      if(!data||!Array.isArray(data.entries))throw new Error('Invalid search index');
      return data;
    });
    return indexPromise;
  }
  function loadEducation(){
    if(!educationPromise)educationPromise=fetchJson(EDUCATION_URL).then(function(data){
      if(!data||!Array.isArray(data.resources))throw new Error('Invalid education data');
      return data;
    });
    return educationPromise;
  }
  function norm(value){
    return String(value==null?'':value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function unique(values){return Array.from(new Set(values.filter(Boolean)));}
  function array(value){return Array.isArray(value)?value:(value?[value]:[]);}
  function buildHaystack(entry){
    if(entry.__haystack)return entry.__haystack;
    entry.__haystack=norm([
      entry.title,entry.description,entry.contentType,entry.subject,entry.family,entry.year,
      array(entry.pathway).join(' '),array(entry.audience).join(' '),entry.source,
      array(entry.keywords).join(' '),array(entry.tasks).join(' '),entry.topic,entry.jurisdiction
    ].join(' '));
    return entry.__haystack;
  }
  function score(entry,query){
    var q=norm(query);
    if(!q)return 1;
    var tokens=q.split(/\s+/).filter(Boolean);
    var hay=buildHaystack(entry);
    if(!tokens.every(function(token){return hay.indexOf(token)!==-1;}))return -1;
    var title=norm(entry.title);
    var result=0;
    if(title===q)result+=500;
    if(title.indexOf(q)===0)result+=260;
    if(title.indexOf(q)!==-1)result+=130;
    tokens.forEach(function(token){
      if(title.split(' ').indexOf(token)!==-1)result+=55;
      else if(title.indexOf(token)!==-1)result+=28;
      if(norm(entry.subject).indexOf(token)!==-1)result+=12;
      if(norm(entry.source).indexOf(token)!==-1)result+=7;
    });
    if(entry.category==='page')result+=5;
    return result;
  }
  function deriveStatus(resource,asOf){
    var today=asOf||new Date().toISOString().slice(0,10);
    var from=resource.effectiveFrom||'';
    var to=resource.effectiveTo||'';
    if(from&&today<from)return 'upcoming';
    if(to&&today>to)return 'superseded';
    if(from)return 'current';
    return 'evergreen';
  }
  function externalEntry(resource,asOf){
    var status=deriveStatus(resource,asOf);
    return {
      id:'external-'+resource.id,
      sourceId:resource.id,
      title:resource.title,
      description:resource.summary,
      route:resource.url,
      category:'external',
      contentType:resource.type||'Official resource',
      subject:resource.topic,
      topic:resource.topic,
      pathway:[],
      format:resource.format||'Web guidance',
      audience:array(resource.audience),
      source:resource.source,
      jurisdiction:resource.jurisdiction,
      lastReviewed:resource.lastReviewed,
      status:status,
      effectiveFrom:resource.effectiveFrom,
      effectiveTo:resource.effectiveTo,
      keywords:array(resource.keywords),
      external:true,
      action:'Open on '+resource.source+' (leaves Made by Matt)'
    };
  }
  function matchesValue(entry,filter,value){
    if(!value)return true;
    if(filter==='origin')return value==='external'?entry.category==='external':entry.category!=='external';
    if(filter==='category')return entry.category===value;
    if(filter==='task')return array(entry.tasks).indexOf(value)!==-1;
    if(filter==='audience')return array(entry.audience).indexOf(value)!==-1;
    if(filter==='pathway')return array(entry.pathway).indexOf(value)!==-1;
    if(filter==='status')return entry.status===value;
    var actual=entry[filter];
    if(Array.isArray(actual))return actual.indexOf(value)!==-1;
    return String(actual||'')===value;
  }
  function sortRows(rows,sort,query){
    rows.sort(function(a,b){
      if(sort==='title')return a.title.localeCompare(b.title,'en-GB',{sensitivity:'base'});
      if(sort==='source')return String(a.source||'').localeCompare(String(b.source||''),'en-GB',{sensitivity:'base'})||a.title.localeCompare(b.title);
      if(sort==='type')return String(a.contentType||'').localeCompare(String(b.contentType||''),'en-GB',{sensitivity:'base'})||a.title.localeCompare(b.title);
      var delta=(b.__score||0)-(a.__score||0);
      return delta||a.title.localeCompare(b.title,'en-GB',{sensitivity:'base'});
    });
    return rows;
  }
  function search(entries,query,filters,sort){
    var rows=[];
    entries.forEach(function(entry){
      var points=score(entry,query);
      if(points<0)return;
      for(var key in filters){if(filters[key]&&!matchesValue(entry,key,filters[key]))return;}
      entry.__score=points;rows.push(entry);
    });
    return sortRows(rows,sort||'relevance',query);
  }
  function el(tag,className,text){
    var node=doc.createElement(tag);
    if(className)node.className=className;
    if(text!=null)node.textContent=String(text);
    return node;
  }
  function setRecentAttributes(link,entry){
    if(entry.category==='external')return;
    link.setAttribute('data-mbm-track-recent',entry.id);
    link.setAttribute('data-mbm-recent-route',entry.route);
  }
  function card(entry){
    var article=el('article','mbm-result-card mbm-result-'+entry.category);
    article.setAttribute('data-result-id',entry.id);
    if(entry.external)article.setAttribute('data-mbm-external-result','true');
    var top=el('div','mbm-result-top');
    var kind=el('span','mbm-result-kind',entry.category==='external'?'Official external resource · '+entry.source:(entry.contentType||entry.category));
    top.appendChild(kind);
    if(entry.status&&entry.status!=='evergreen'){
      var label=entry.status==='current'?'Current':entry.status==='upcoming'?'Upcoming':'Superseded';
      var status=el('span','mbm-status mbm-status-'+entry.status,label);
      status.setAttribute('data-status',entry.status);top.appendChild(status);
    }
    article.appendChild(top);
    var h=el('h3','',entry.title);article.appendChild(h);
    var metaParts=[];
    if(entry.subject)metaParts.push(entry.subject);
    if(array(entry.pathway).length)metaParts.push(array(entry.pathway).join(' · '));
    if(entry.jurisdiction)metaParts.push(entry.jurisdiction);
    if(entry.source&&entry.category!=='external')metaParts.push(entry.source);
    if(metaParts.length)article.appendChild(el('p','mbm-result-meta',metaParts.join(' · ')));
    article.appendChild(el('p','mbm-result-description',entry.description||''));
    if(entry.category==='external'){
      var source=el('p','mbm-source-note','Publisher: '+entry.source+' · Reviewed '+entry.lastReviewed);
      article.appendChild(source);
    }
    var link=el('a','mbm-result-action',entry.action||('Open '+entry.title));
    link.href=entry.route;
    if(entry.external){link.target='_blank';link.rel='noopener noreferrer external';}
    setRecentAttributes(link,entry);
    article.appendChild(link);
    return article;
  }

  function initSuggest(form){
    var input=form.querySelector('input[name="q"]');
    var list=form.querySelector('[data-mbm-suggestions]');
    var status=form.querySelector('[data-mbm-search-status]');
    if(!input||!list)return;
    var rows=[];var active=-1;var request=0;
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
    list.setAttribute('role','listbox');
    function close(){list.hidden=true;list.textContent='';rows=[];active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function highlight(next){
      if(!rows.length)return;
      active=(next+rows.length)%rows.length;
      rows.forEach(function(row,index){row.setAttribute('aria-selected',index===active?'true':'false');row.classList.toggle('is-active',index===active);});
      input.setAttribute('aria-activedescendant',rows[active].id);
      rows[active].scrollIntoView({block:'nearest'});
    }
    function render(entries,query){
      list.textContent='';rows=[];active=-1;
      entries.slice(0,Number(form.getAttribute('data-mbm-limit')||6)).forEach(function(entry,index){
        var a=el('a','mbm-suggestion');a.id=list.id+'-option-'+index;a.href=entry.route;a.setAttribute('role','option');a.setAttribute('aria-selected','false');
        setRecentAttributes(a,entry);
        a.append(el('span','mbm-suggestion-kind',entry.contentType||entry.category),el('strong','',entry.title),el('small','',entry.description||''));
        a.addEventListener('pointermove',function(){highlight(index);});
        list.appendChild(a);rows.push(a);
      });
      if(!rows.length){close();if(status)status.textContent='No suggestions for '+query;return;}
      list.hidden=false;input.setAttribute('aria-expanded','true');
      if(status)status.textContent=rows.length+' suggestions available. Use the down arrow to review them.';
    }
    function update(){
      var query=input.value.trim();var current=++request;
      if(query.length<2){close();if(status)status.textContent='';return;}
      loadIndex().then(function(index){
        if(current!==request)return;
        render(search(index.entries,query,{},'relevance'),query);
      }).catch(function(){close();if(status)status.textContent='Search suggestions are unavailable. Submit to search the catalogue.';});
    }
    input.addEventListener('focus',function(){loadIndex().catch(function(){});if(input.value.trim().length>=2)update();});
    input.addEventListener('input',update);
    input.addEventListener('keydown',function(event){
      if(event.key==='ArrowDown'){event.preventDefault();if(list.hidden)update();else highlight(active+1);}
      else if(event.key==='ArrowUp'){if(!list.hidden){event.preventDefault();highlight(active-1);}}
      else if(event.key==='Escape'){if(!list.hidden){event.preventDefault();close();}}
      else if(event.key==='Enter'&&active>=0&&rows[active]){event.preventDefault();rows[active].click();}
      else if(event.key==='Tab'){close();}
    });
    doc.addEventListener('pointerdown',function(event){if(!form.contains(event.target))close();},{passive:true});
    form.addEventListener('submit',close);
  }

  function readFilters(root){
    var filters={};
    root.querySelectorAll('[data-mbm-filter]').forEach(function(control){
      var key=control.getAttribute('data-mbm-filter')||control.name;
      var value='';
      if(control.matches('button'))value=control.getAttribute('aria-pressed')==='true'?(control.value||control.dataset.value||''):'';
      else value=control.value||'';
      if(key&&value)filters[key]=value;
    });
    return filters;
  }
  function filterControls(root){return Array.prototype.slice.call(root.querySelectorAll('[data-mbm-filter]'));}
  function stateFromUrl(root){
    var params=new URLSearchParams(location.search);
    var q=root.querySelector('input[name="q"]');if(q&&params.has('q'))q.value=params.get('q')||'';
    filterControls(root).forEach(function(control){
      var key=control.getAttribute('data-mbm-filter')||control.name;
      if(!key||!params.has(key))return;
      var value=params.get(key)||'';
      if(control.matches('button'))control.setAttribute('aria-pressed',(control.value||control.dataset.value)===value?'true':'false');
      else control.value=value;
    });
    var sort=root.querySelector('[data-mbm-sort]');if(sort&&params.has('sort'))sort.value=params.get('sort')||'relevance';
  }
  function writeUrl(root){
    var params=new URLSearchParams();
    var q=root.querySelector('input[name="q"]');if(q&&q.value.trim())params.set('q',q.value.trim());
    var filters=readFilters(root);Object.keys(filters).sort().forEach(function(key){params.set(key,filters[key]);});
    var sort=root.querySelector('[data-mbm-sort]');if(sort&&sort.value&&sort.value!=='relevance')params.set('sort',sort.value);
    var url=location.pathname+(params.toString()?'?'+params.toString():'')+location.hash;
    history.replaceState(null,'',url);
  }
  function fillSelect(select,values,label){
    if(!select||select.options.length>1)return;
    unique(values).sort(function(a,b){return a.localeCompare(b,'en-GB',{sensitivity:'base'});}).forEach(function(value){
      var option=el('option','',value);option.value=value;select.appendChild(option);
    });
    if(label)select.setAttribute('aria-label',label);
  }
  function populateFilters(root,entries){
    fillSelect(root.querySelector('[data-mbm-filter="subject"]'),entries.map(function(e){return e.subject;}),'Filter by subject');
    fillSelect(root.querySelector('[data-mbm-filter="pathway"]'),entries.flatMap(function(e){return array(e.pathway); }),'Filter by pathway');
    fillSelect(root.querySelector('[data-mbm-filter="format"]'),entries.map(function(e){return e.format;}),'Filter by format');
    fillSelect(root.querySelector('[data-mbm-filter="audience"]'),entries.flatMap(function(e){return array(e.audience); }),'Filter by audience');
    fillSelect(root.querySelector('[data-mbm-filter="source"]'),entries.map(function(e){return e.source;}),'Filter by source');
    fillSelect(root.querySelector('[data-mbm-filter="topic"]'),entries.map(function(e){return e.topic;}),'Filter by topic');
    fillSelect(root.querySelector('[data-mbm-filter="jurisdiction"]'),entries.map(function(e){return e.jurisdiction;}),'Filter by jurisdiction');
  }

  function initApp(root){
    var mode=root.getAttribute('data-mbm-mode')||'resources';
    var input=root.querySelector('input[name="q"]');
    var form=root.querySelector('form[data-mbm-search-form]')||root.querySelector('form');
    var results=root.querySelector('[data-mbm-results]');
    var internalResults=root.querySelector('[data-mbm-internal-results]');
    var externalResults=root.querySelector('[data-mbm-external-results]');
    var count=root.querySelector('[data-mbm-result-count]');
    var loadMore=root.querySelector('[data-mbm-load-more]');
    var clear=root.querySelector('[data-mbm-clear]');
    var active=root.querySelector('[data-mbm-active-filters]');
    var sort=root.querySelector('[data-mbm-sort]');
    var pageSize=Number(root.getAttribute('data-mbm-page-size')||24);
    var shown=pageSize;var allEntries=[];var currentRows=[];

    function baseScope(entries){
      if(mode==='teach')return entries.filter(function(entry){return array(entry.audience).indexOf('teachers')!==-1&&entry.id!=='page-discovery-home';});
      if(mode==='education')return entries.filter(function(entry){return entry.category!=='game'&&array(entry.audience).some(function(a){return ['teachers','schools-semh','trusts','councils-organisations','partners'].indexOf(a)!==-1;});});
      return entries;
    }
    function renderActive(filters){
      if(!active)return;
      active.textContent='';var keys=Object.keys(filters);
      active.hidden=!keys.length;
      keys.forEach(function(key){
        var chip=el('span','mbm-active-filter',key.replace(/(^|-)\w/g,function(m){return m.replace('-',' ').toUpperCase();})+': '+filters[key]);
        active.appendChild(chip);
      });
    }
    function renderStandard(rows){
      if(!results)return;
      results.textContent='';
      rows.slice(0,shown).forEach(function(entry){results.appendChild(card(entry));});
    }
    function renderEducation(rows){
      var internal=rows.filter(function(e){return e.category!=='external';});
      var external=rows.filter(function(e){return e.category==='external';});
      if(internalResults){internalResults.textContent='';internal.slice(0,shown).forEach(function(e){internalResults.appendChild(card(e));});}
      if(externalResults){externalResults.textContent='';external.slice(0,shown).forEach(function(e){externalResults.appendChild(card(e));});}
      var ih=root.querySelector('[data-mbm-internal-count]');if(ih)ih.textContent=internal.length+' Made by Matt result'+(internal.length===1?'':'s');
      var eh=root.querySelector('[data-mbm-external-count]');if(eh)eh.textContent=external.length+' authoritative external result'+(external.length===1?'':'s');
    }
    function refresh(updateUrl){
      if(!allEntries.length)return;
      var query=input?input.value.trim():'';
      var filters=readFilters(root);
      var sortValue=sort?sort.value:'relevance';
      shown=Math.max(pageSize,shown===0?pageSize:shown);
      currentRows=search(allEntries,query,filters,sortValue);
      if(mode==='education')renderEducation(currentRows);else renderStandard(currentRows);
      if(count)count.textContent=currentRows.length+' result'+(currentRows.length===1?'':'s')+(query?' for “'+query+'”':'');
      if(loadMore){loadMore.hidden=currentRows.length<=shown;loadMore.setAttribute('aria-label','Show more search results');}
      var empty=root.querySelector('[data-mbm-empty]');if(empty)empty.hidden=currentRows.length>0;
      renderActive(filters);
      if(updateUrl)writeUrl(root);
    }
    function reset(){
      if(input)input.value='';
      filterControls(root).forEach(function(control){if(control.matches('button'))control.setAttribute('aria-pressed','false');else control.value='';});
      if(sort)sort.value='relevance';shown=pageSize;refresh(true);if(input)input.focus();
    }
    function bind(){
      if(form)form.addEventListener('submit',function(event){event.preventDefault();shown=pageSize;refresh(true);});
      if(input)input.addEventListener('input',function(){shown=pageSize;refresh(true);});
      filterControls(root).forEach(function(control){
        var eventName=control.matches('button')?'click':'change';
        control.addEventListener(eventName,function(){
          if(control.matches('button')){
            var group=control.getAttribute('data-mbm-filter');
            root.querySelectorAll('button[data-mbm-filter="'+group+'"]').forEach(function(button){button.setAttribute('aria-pressed',button===control&&control.getAttribute('aria-pressed')!=='true'?'true':'false');});
          }
          shown=pageSize;refresh(true);
        });
      });
      if(sort)sort.addEventListener('change',function(){shown=pageSize;refresh(true);});
      if(loadMore)loadMore.addEventListener('click',function(){var previous=shown;shown+=pageSize;refresh(false);var cards=root.querySelectorAll('[data-result-id]');var next=cards[Math.max(0,previous)];if(next){next.setAttribute('tabindex','-1');next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}});
      if(clear)clear.addEventListener('click',reset);
      root.querySelectorAll('[data-mbm-task-query]').forEach(function(link){link.addEventListener('click',function(event){
        var task=link.getAttribute('data-mbm-task-query');
        if(task){event.preventDefault();var control=root.querySelector('[data-mbm-filter="task"]');if(control)control.value=task;shown=pageSize;refresh(true);root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
      });});
      window.addEventListener('popstate',function(){stateFromUrl(root);shown=pageSize;refresh(false);});
    }

    var loading=count;if(loading)loading.textContent='Loading the same-origin Made by Matt index…';
    Promise.all([loadIndex(),mode==='education'?loadEducation():Promise.resolve(null)]).then(function(values){
      var internal=baseScope(values[0].entries.slice());
      if(mode==='education'){
        var asOf=new Date().toISOString().slice(0,10);
        var external=values[1].resources.map(function(r){return externalEntry(r,asOf);});
        allEntries=internal.concat(external);
      }else allEntries=internal;
      populateFilters(root,allEntries);
      stateFromUrl(root);
      bind();refresh(false);
      root.setAttribute('data-mbm-search-ready','true');
    }).catch(function(error){
      if(count)count.textContent='Search could not be loaded. The key links on this page still work.';
      root.setAttribute('data-mbm-search-error',String(error&&error.message||error));
    });
  }

  function init(){
    doc.querySelectorAll('form[data-mbm-search="suggest"]').forEach(initSuggest);
    doc.querySelectorAll('[data-mbm-search-app]').forEach(initApp);
  }
  window.MBMSearch={loadIndex:loadIndex,loadEducation:loadEducation,search:search,deriveStatus:deriveStatus};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
