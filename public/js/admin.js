// Auth guard
const token = localStorage.getItem('pm_token');
const currentUser = JSON.parse(localStorage.getItem('pm_user') || 'null');
if (!token || !currentUser) window.location.href = '/';
if (currentUser && !currentUser.isAdmin) window.location.href = '/app.html';

let allUsers = [];
let allMessages = [];

async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

function switchTab(tab) {
  document.getElementById('tabUsers').classList.toggle('active', tab === 'users');
  document.getElementById('tabMessages').classList.toggle('active', tab === 'messages');
  document.getElementById('panelUsers').classList.toggle('active', tab === 'users');
  document.getElementById('panelMessages').classList.toggle('active', tab === 'messages');
  if (tab === 'messages' && allMessages.length === 0) loadMessages();
}

// ─── USERS ───

async function loadUsers() {
  try {
    const res = await apiFetch('/api/admin/users');
    allUsers = await res.json();
    document.getElementById('statUsers').textContent = allUsers.filter(u => !u.isAdmin).length;
    renderUsersTable(allUsers);
  } catch (e) {
    document.getElementById('usersTableWrap').innerHTML = '<div class="loading">error loading users</div>';
  }
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  renderUsersTable(allUsers.filter(u => u.username.toLowerCase().includes(q)));
}

function renderUsersTable(users) {
  const wrap = document.getElementById('usersTableWrap');
  if (!users.length) {
    wrap.innerHTML = '<div class="empty-state">no users found</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Sent</th>
          <th>Received</th>
          <th>Joined</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td style="font-family:var(--mono)">@ ${u.username}</td>
            <td>${u.isAdmin ? '<span class="admin-tag">admin</span>' : '<span style="color:var(--text-dim);font-size:11px;font-family:var(--mono)">user</span>'}</td>
            <td style="font-family:var(--mono);color:var(--text-mid)">${u.messagesSent ?? '—'}</td>
            <td style="font-family:var(--mono);color:var(--text-mid)">${u.messagesReceived ?? '—'}</td>
            <td style="color:var(--text-dim);font-size:12px;font-family:var(--mono);white-space:nowrap">${new Date(u.createdAt).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'})}</td>
            <td>${u.isAdmin ? '' : `<button class="btn btn-danger" onclick="deleteUser('${u._id}', '${u.username}')">Delete</button>`}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "@${username}" and all their messages? This cannot be undone.`)) return;
  try {
    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) { await loadUsers(); allMessages = []; }
  } catch (e) { alert('Error deleting user'); }
}

// ─── MESSAGES ───

async function loadMessages() {
  try {
    const res = await apiFetch('/api/admin/messages');
    allMessages = await res.json();
    document.getElementById('statMessages').textContent = allMessages.length;
    renderMessagesTable(allMessages);
  } catch (e) {
    document.getElementById('msgsTableWrap').innerHTML = '<div class="loading">error loading messages</div>';
  }
}

function filterMessages() {
  const q = document.getElementById('msgSearch').value.toLowerCase();
  renderMessagesTable(allMessages.filter(m =>
    m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
  ));
}

function renderMessagesTable(messages) {
  const wrap = document.getElementById('msgsTableWrap');
  if (!messages.length) {
    wrap.innerHTML = '<div class="empty-state">no messages found</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>From</th>
          <th>To</th>
          <th>Message</th>
          <th>Date</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${messages.map(m => `
          <tr>
            <td style="font-family:var(--mono);white-space:nowrap">@ ${escapeHtml(m.from)}</td>
            <td style="font-family:var(--mono);white-space:nowrap">@ ${escapeHtml(m.to)}</td>
            <td class="msg-content-cell">${escapeHtml(m.content)}</td>
            <td style="color:var(--text-dim);font-size:11px;font-family:var(--mono);white-space:nowrap">${new Date(m.createdAt).toLocaleString('en-US', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
            <td><button class="btn btn-danger" onclick="deleteMessage('${m._id}')">Del</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  try {
    const res = await apiFetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
    if (res.ok) {
      allMessages = allMessages.filter(m => m._id !== id);
      document.getElementById('statMessages').textContent = allMessages.length;
      filterMessages();
    }
  } catch (e) { alert('Error deleting message'); }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function logout() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_user');
  window.location.href = '/';
}

loadUsers();