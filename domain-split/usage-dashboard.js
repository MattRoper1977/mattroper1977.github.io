/* Owner UI. The existing account client sends Auth; the server authorizes owners. */
(function (w, d) {
  'use strict';
  var root=d.querySelector('[data-usage-owner]');if(!root)return;
  var status=root.querySelector('[data-owner-status]'),content=root.querySelector('[data-owner-content]');
  var source=root.querySelector('[data-owner-source]'),period=root.querySelector('[data-owner-period]');
  var button=root.querySelector('[data-owner-load]'),exportButton=root.querySelector('[data-owner-export]');
  var approved=null,generation=0,userId=null;
  function clear(message){approved=null;generation++;content.replaceChildren();content.hidden=true;exportButton.disabled=true;status.textContent=message;}
  function node(tag,text,cls){var el=d.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  function numeric(value){return Number.isSafeInteger(value)&&value>=0;}
  function show(data){
    if(!data||data.schema!==1||data.source!==source.value||!data.windows)throw new Error('unavailable');
    var windowData=data.windows[period.value];if(!windowData||!windowData.totals)throw new Error('unavailable');
    content.replaceChildren();
    var date=data.measured_since?new Date(data.measured_since):null;
    content.appendChild(node('p',date&&!isNaN(date)?'Real activity recorded since '+date.toLocaleDateString('en-GB',{timeZone:'UTC'})+'.':'No real activity has been recorded yet.','usage-status'));
    var grid=node('div',undefined,'usage-grid');
    [['lesson_open','Lesson opens'],['download_request','Download requests'],['game_launch','Game launches']].forEach(function(pair){
      var n=windowData.totals[pair[0]];if(!numeric(n))throw new Error('unavailable');
      var card=node('article',undefined,'usage-card');card.append(node('span',n.toLocaleString('en-GB'),'usage-total'),node('h3',pair[1]));grid.appendChild(card);
    });content.appendChild(grid);
    content.appendChild(node('p','Totals count events across visitors who opted in, not unique people or completed activities. Education and Play are separate sources; no visitor identity joins them.'));
    var rankingGrid=node('div',undefined,'usage-grid');
    [['lessons','Top 10 lessons'],['packs','Top 10 lesson packs'],['games','Top 10 games']].forEach(function(pair){
      var card=node('article',undefined,'usage-card'),list=node('div');list.dataset.usageList=pair[0];card.append(node('h3',pair[1]),list);rankingGrid.appendChild(card);
    });content.appendChild(rankingGrid);
    ['lessons','packs','games'].forEach(function(kind){w.MBMUsage.paintRanks(content,data,kind,period.value);});
    content.appendChild(node('h2','Approximate geography'));
    // No map or country value is fabricated when trusted geography is unavailable.
    var geo=data.geography;
    if(!geo||geo.enabled!==true){
      content.appendChild(node('p','Country and UK-region measurement is off. Location is Unknown; time zones are never treated as measured locations.','usage-note'));
      var table=node('table'),caption=node('caption','Geography collection status');table.appendChild(caption);
      var row=node('tr');row.append(node('th','Country / UK region'),node('td','Not collected'));table.appendChild(row);content.appendChild(table);
    }else{
      // Enabling geography requires a separately reviewed provider and suppression contract.
      content.appendChild(node('p','The current dashboard does not display geographic data. A verified, privacy-reviewed geography release is required.','usage-note'));
    }
    approved=data;content.hidden=false;exportButton.disabled=false;status.textContent='Owner access verified by the service. Figures shown for '+(period.value==='alltime'?'all time':'the last 30 UTC calendar days, including today')+'.';
  }
  function accountClient(){
    if(w.MBMAccount)return w.MBMAccount.ready.then(function(){return w.MBMAccount;});
    return new Promise(function(resolve,reject){var script=d.createElement('script');script.src='/assets/mbm-account.js';script.onload=function(){if(!w.MBMAccount)return reject(new Error('account'));w.MBMAccount.ready.then(function(){resolve(w.MBMAccount);});};script.onerror=reject;d.head.appendChild(script);});
  }
  function load(){
    clear('Checking owner access…');var thisGeneration=generation;button.disabled=true;
    accountClient().then(function(account){
      if(typeof account.readUsageDashboard!=='function')throw new Error('account');
      userId=account.state&&account.state.user&&account.state.user.id||null;
      return account.readUsageDashboard(source.value);
    }).then(function(data){if(thisGeneration===generation)show(data);}).catch(function(){
      if(thisGeneration===generation)clear('Owner statistics could not be opened. Sign in with the authorised owner account, then try again. Other accounts cannot access this dashboard.');
    }).finally(function(){button.disabled=false;});
  }
  button.addEventListener('click',load);
  source.addEventListener('change',function(){clear(w.MBMUsage && w.MBMUsage.config && w.MBMUsage.config.enabled?'Choose Load owner dashboard to check this source.':'Shared collection and the owner dashboard are not active yet. No simulated or device-local totals are shown.');});
  period.addEventListener('change',function(){if(approved){try{show(approved);}catch(_){clear('Statistics are unavailable. Please load them again.');}}});
  exportButton.addEventListener('click',function(){
    if(!approved)return;
    var url=URL.createObjectURL(new Blob([JSON.stringify(approved,null,2)+'\n'],{type:'application/json'}));
    var a=d.createElement('a');a.href=url;a.download='madebymatt-aggregate-usage-'+source.value+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
  w.addEventListener('mbm:account-state',function(event){var next=event.detail&&event.detail.user&&event.detail.user.id;if(!next || (userId && next!==userId))clear('Account changed. Load the dashboard again to verify owner access.');userId=next||null;});
  w.addEventListener('pagehide',function(){clear('Owner dashboard closed.');});
  if(!w.MBMUsage){clear('Statistics are unavailable. Public resources remain available.');return;}
  w.MBMUsage.ready.then(function(config){
    if(!config||!config.enabled){button.disabled=true;clear('Shared collection and the owner dashboard are not active yet. No simulated or device-local totals are shown.');}
    else{button.disabled=false;clear('Sign in through the existing account page, then load the dashboard. The service verifies owner access before returning any private figures.');}
  });
})(window,document);
