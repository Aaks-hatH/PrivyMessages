// Auth guard
const token = localStorage.getItem('pm_token');
const currentUser = JSON.parse(localStorage.getItem('pm_user') || 'null');

if (!token || !currentUser) { window.location.href = '/'; throw new Error('Not authenticated'); }
if (currentUser.isAdmin) { window.location.href = '/admin.html'; throw new Error('Admin user'); }

// State
let selectedUserId = null;
let selectedUsername = null;
let allUsers = [];
let onlineUserIds = new Set();
let socket = null;
const unreadMap = new Map();

// Init
document.getElementById('currentUsername').textContent = '@ ' + currentUser.username;

// ─── MOBILE SIDEBAR CONTROLS ───

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}

function goBack() {
  // On mobile, deselect chat and show user list
  selectedUserId = null;
  selectedUsername = null;
  document.getElementById('activeChat').style.display = 'none';
  document.getElementById('noChat').style.display = '';
  document.getElementById('appLayout').classList.remove('chat-active');
  updateChatHeaderEmpty();
  renderUserList();
}

function updateChatHeaderEmpty() {
  document.getElementById('chatAvatar').style.display = 'none';
  document.getElementById('chatHeaderInfo').style.display = 'none';
  document.getElementById('chatHeaderEnc').style.display = 'none';
  document.getElementById('headerBrand').style.display = '';
}

function updateChatHeaderUser(username, userId) {
  document.getElementById('chatAvatar').textContent = username[0];
  document.getElementById('chatAvatar').style.display = '';
  document.getElementById('chatHeaderName').textContent = username;
  document.getElementById('chatHeaderInfo').style.display = '';
  document.getElementById('chatHeaderEnc').style.display = '';
  document.getElementById('headerBrand').style.display = 'none';
  updateChatHeaderStatus();
}

// Show brand in header on desktop when no chat selected
updateChatHeaderEmpty();

// ─── SOCKET ───

function connectSocket() {
  socket = io({ auth: { token } });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  socket.on('users_online', (userIds) => {
    onlineUserIds = new Set(userIds);
    renderUserList();
    updateChatHeaderStatus();
  });

  socket.on('new_message', (msg) => {
    if (msg.from === selectedUserId) {
      appendMessage(msg, false);
      scrollToBottom();
    } else {
      markUnread(msg.from);
    }
  });

  socket.on('disconnect', () => console.log('Socket disconnected'));
}

// ─── USERS ───

async function loadUsers() {
  try {
    const res = await apiFetch('/api/messages/users');
    allUsers = await res.json();
    renderUserList();
  } catch (e) {
    if (e.message !== 'Session expired') {
      document.getElementById('userList').innerHTML = '<div class="loading">error loading users</div>';
    }
  }
}

function markUnread(userId) {
  unreadMap.set(userId, (unreadMap.get(userId) || 0) + 1);
  renderUserList();
}

function renderUserList() {
  const list = document.getElementById('userList');
  if (!allUsers.length) {
    list.innerHTML = '<div class="loading" style="font-size:11px;">no other users yet</div>';
    return;
  }
  list.innerHTML = allUsers.map(u => {
    const isOnline = onlineUserIds.has(u._id);
    const isActive = u._id === selectedUserId;
    const unread = unreadMap.get(u._id) || 0;
    return `
      <div class="user-item ${isActive ? 'active' : ''}" onclick="selectUser('${u._id}', '${u.username}')">
        <div class="user-avatar ${isOnline ? 'online' : ''}">${u.username[0]}</div>
        <div class="user-info">
          <span class="user-name">${u.username}</span>
          <span class="user-status-text">${isOnline ? 'online' : 'offline'}</span>
        </div>
        ${unread > 0 && !isActive ? `<span class="unread-badge">${unread}</span>` : ''}
      </div>`;
  }).join('');
}

// ─── SELECT USER ───

async function selectUser(userId, username) {
  selectedUserId = userId;
  selectedUsername = username;
  unreadMap.delete(userId);
  renderUserList();

  // Mark chat as active (for mobile CSS)
  document.getElementById('appLayout').classList.add('chat-active');

  // Close sidebar on mobile
  closeSidebar();

  // Update header
  updateChatHeaderUser(username, userId);

  // Show chat
  document.getElementById('noChat').style.display = 'none';
  const ac = document.getElementById('activeChat');
  ac.style.display = 'flex';
  ac.style.flexDirection = 'column';
  ac.style.overflow = 'hidden';
  ac.style.flex = '1';

  document.getElementById('messagesContainer').innerHTML = '<div class="loading">loading messages...</div>';

  try {
    const res = await apiFetch(`/api/messages/conversation/${userId}`);
    const messages = await res.json();
    renderMessages(messages);
  } catch (e) {
    if (e.message !== 'Session expired') {
      document.getElementById('messagesContainer').innerHTML = '<div class="loading">error loading messages</div>';
    }
  }

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  if (!selectedUserId) return;
  const isOnline = onlineUserIds.has(selectedUserId);
  const el = document.getElementById('chatHeaderStatus');
  el.textContent = isOnline ? 'online' : 'offline';
  el.className = 'chat-header-status' + (isOnline ? ' online' : '');
}

// ─── MESSAGES ───

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  if (!messages.length) {
    container.innerHTML = '<div class="loading" style="opacity:0.4;">no messages yet — say hello!</div>';
    return;
  }

  let html = '';
  let lastDate = null;

  messages.forEach(msg => {
    const d = new Date(msg.createdAt);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (dateStr !== lastDate) {
      html += `<div class="msg-group-label">${dateStr}</div>`;
      lastDate = dateStr;
    }
    const isOutgoing = msg.from.toString() === currentUser.id.toString();
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    html += `
      <div class="message ${isOutgoing ? 'outgoing' : 'incoming'}">
        ${escapeHtml(msg.content)}
        <div class="message-time">${timeStr}</div>
      </div>`;
  });

  container.innerHTML = html;
  scrollToBottom();
}

function appendMessage(msg, isOutgoing) {
  const container = document.getElementById('messagesContainer');
  const empty = container.querySelector('.loading');
  if (empty) empty.remove();

  const d = new Date(msg.createdAt);
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
  div.innerHTML = `${escapeHtml(msg.content)}<div class="message-time">${timeStr}</div>`;
  container.appendChild(div);
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !selectedUserId) return;

  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  try {
    const res = await apiFetch('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ to: selectedUserId, content })
    });
    const msg = await res.json();
    if (!res.ok) throw new Error(msg.error);
    appendMessage(msg, true);
    scrollToBottom();
  } catch (e) {
    if (e.message !== 'Session expired') {
      input.value = content;
      alert('Failed to send: ' + e.message);
    }
  }

  btn.disabled = false;
  input.focus();
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  setTimeout(() => {
    const ta = document.getElementById('chatInput');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, 0);
}

function scrollToBottom() {
  const c = document.getElementById('messagesContainer');
  c.scrollTop = c.scrollHeight;
}

function logout() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_user');
  if (socket) socket.disconnect();
  window.location.href = '/';
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('pm_token');
    localStorage.removeItem('pm_user');
    if (socket) socket.disconnect();
    window.location.href = '/';
    throw new Error('Session expired');
  }
  return res;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

// Start
connectSocket();
loadUsers();