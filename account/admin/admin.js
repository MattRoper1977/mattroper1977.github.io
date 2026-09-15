(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var currentUser = '', request = 0, page = 1, size = 25, total = 0, busy = false;
  function message(text, error) {
    $('adminStatus').textContent = text;
    $('adminStatus').className = 'ma-status' + (error ? ' err' : '');
  }
  function clear() {
    $('memberRows').replaceChildren();
    $('adminResults').hidden = true;
    ['memberCount', 'verifiedCount', 'newCount', 'signinCount', 'asOf', 'pageLabel'].forEach(function (id) { $(id).textContent = ''; });
  }
  function controls(on) {
    busy = on;
    $('adminSearch').setAttribute('aria-busy', String(on));
    $('searchButton').disabled = on;
    $('refreshButton').disabled = on;
    $('previousPage').disabled = on || page <= 1;
    $('nextPage').disabled = on || page * size >= total;
  }
  function date(value) {
    if (!value) return 'Not yet';
    var d = new Date(value);
    return isNaN(d.getTime()) ? 'Unavailable' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function cell(row, value) {
    var el = document.createElement('td');
    el.textContent = String(value); row.appendChild(el);
  }
  async function refresh() {
    var ticket = ++request, user = currentUser;
    clear();
    if (!user) { controls(false); message('Log in with your administrator account to view members.'); return; }
    controls(true); message('Checking admin access and loading members…');
    try {
      var data = await MBMAccount.adminMembers({ page: page, pageSize: size, search: $('memberSearch').value.trim() });
      if (ticket !== request || user !== currentUser) return;
      if (!data || data.schema !== 1 || !Array.isArray(data.members) || !data.summary) throw new Error('The member list could not be loaded.');
      total = data.total;
      $('memberCount').textContent = data.summary.registered;
      $('verifiedCount').textContent = data.summary.verified;
      $('newCount').textContent = data.summary.joined_last_7_days;
      $('signinCount').textContent = data.summary.signed_in_last_7_days;
      $('asOf').textContent = 'Updated ' + date(data.as_of) + ' · times shown in your local time zone.';
      data.members.forEach(function (member) {
        var row = document.createElement('tr');
        cell(row, member.display_name || 'No display name'); cell(row, member.email);
        cell(row, member.email_verified ? 'Verified' : 'Awaiting verification');
        cell(row, date(member.created_at)); cell(row, date(member.last_sign_in_at));
        cell(row, member.recorded_sessions); $('memberRows').appendChild(row);
      });
      $('pageLabel').textContent = total ? 'Page ' + page + ' of ' + Math.ceil(total / size) + ' · ' + total + ' matching accounts' : 'No matching accounts';
      $('adminResults').hidden = false;
      message(data.members.length ? 'Member list loaded.' : 'No accounts match this search.');
    } catch (err) {
      if (ticket !== request || user !== currentUser) return;
      clear(); total = 0; message(err.message || 'The member list could not be loaded. Try again.', true);
    } finally { if (ticket === request) controls(false); }
  }
  $('adminSearch').addEventListener('submit', function (event) { event.preventDefault(); if (!busy) { page = 1; refresh(); } });
  $('refreshButton').addEventListener('click', function () { if (!busy) refresh(); });
  $('previousPage').addEventListener('click', function () { if (!busy && page > 1) { page--; refresh(); } });
  $('nextPage').addEventListener('click', function () { if (!busy && page * size < total) { page++; refresh(); } });
  MBMAccount.subscribe(function (state) {
    var id = state.user && state.user.id || '';
    if (!state.ready) return;
    $('adminLogin').hidden = !!id;
    $('adminSearch').hidden = !id;
    if (id !== currentUser) { currentUser = id; page = 1; refresh(); }
    else if (!id) { ++request; clear(); controls(false); message('Log in with your administrator account to view members.'); }
  });
  // Avoid retaining member details in a restored back/forward-cache page.
  window.addEventListener('pagehide', function () { ++request; clear(); });
  window.addEventListener('pageshow', function (event) { if (event.persisted) { currentUser = ''; MBMAccount.refresh(); } });
})();
