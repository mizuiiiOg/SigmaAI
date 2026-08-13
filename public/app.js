/* ---------------- Supabase setup ---------------- */
let sb = null;
let currentUser = null;

function initSupabase() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR_') ||
      !window.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY.includes('YOUR_')) {
    return false;
  }
  sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}

/* ---------------- Navigation ---------------- */
let currentChatBotId = null;

function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

/* ---------------- Bot storage (Supabase, per-user) ---------------- */
function rowToBot(row) {
  return {
    id: row.id,
    name: row.name,
    personality: row.personality,
    pfp: row.pfp,
    fishKey: row.fish_key,
    fishVoiceId: row.fish_voice_id,
    hasVoice: row.has_voice,
    messages: row.messages || []
  };
}

async function getBots() {
  if (!sb || !currentUser) return [];
  const { data, error } = await sb
    .from('bots')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });
  if (error) {
    toast('Could not load bots: ' + error.message);
    return [];
  }
  return data.map(rowToBot);
}

async function getBot(id) {
  if (!sb || !currentUser) return null;
  const { data, error } = await sb
    .from('bots')
    .select('*')
    .eq('id', id)
    .eq('user_id', currentUser.id)
    .single();
  if (error) return null;
  return rowToBot(data);
}

async function upsertBot(bot) {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('bots').upsert({
    id: bot.id,
    user_id: currentUser.id,
    name: bot.name,
    personality: bot.personality,
    pfp: bot.pfp,
    fish_key: bot.fishKey,
    fish_voice_id: bot.fishVoiceId,
    has_voice: bot.hasVoice,
    messages: bot.messages
  });
  if (error) toast('Could not save bot: ' + error.message);
}

async function deleteBotRow(id) {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('bots').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) toast('Could not delete bot: ' + error.message);
}

/* ---------------- Auth ---------------- */
let authMode = 'signin';

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-tab-signin').classList.toggle('active', mode === 'signin');
  document.getElementById('auth-tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('auth-submit-btn').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  document.getElementById('auth-status').textContent = '';
}

async function onAuthReady(user) {
  currentUser = user;
  document.getElementById('auth-status').textContent = '';
  await renderBotList();
  goTo('page-main');
}

document.getElementById('auth-tab-signin').addEventListener('click', () => setAuthMode('signin'));
document.getElementById('auth-tab-signup').addEventListener('click', () => setAuthMode('signup'));
document.getElementById('auth-back-btn').addEventListener('click', () => goTo('page-welcome'));

document.getElementById('auth-submit-btn').addEventListener('click', async () => {
  if (!sb) return toast('Supabase is not configured yet — fill in config.js first.');

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) return toast('Enter an email and password.');

  const statusEl = document.getElementById('auth-status');
  statusEl.textContent = 'Working...';

  if (authMode === 'signup') {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { statusEl.textContent = ''; return toast(error.message); }
    if (!data.session) {
      statusEl.textContent = 'Check your email to confirm your account, then sign in.';
      return;
    }
    onAuthReady(data.session.user);
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { statusEl.textContent = ''; return toast(error.message); }
    onAuthReady(data.session.user);
  }
});

document.getElementById('auth-google-btn').addEventListener('click', async () => {
  if (!sb) return toast('Supabase is not configured yet — fill in config.js first.');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) toast(error.message);
});

document.getElementById('sign-out-btn').addEventListener('click', async () => {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  goTo('page-welcome');
});

document.getElementById('enter-btn').addEventListener('click', async () => {
  if (!sb) return toast('Supabase is not configured yet — fill in config.js, run setup.sql, then redeploy.');
  if (currentUser) {
    await renderBotList();
    goTo('page-main');
  } else {
    goTo('page-auth');
  }
});

/* ---------------- Main page: bot list ---------------- */
async function renderBotList() {
  const bots = await getBots();
  const scroll = document.getElementById('bots-scroll');
  const empty = document.getElementById('bots-empty');
  scroll.innerHTML = '';

  if (bots.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  bots.forEach(bot => {
    const card = document.createElement('div');
    card.className = 'bot-card';
    card.innerHTML = `
      <div class="bot-avatar ${bot.hasVoice ? 'has-voice' : ''}" style="${bot.pfp ? `background-image:url('${bot.pfp}')` : ''}">
        ${bot.pfp ? '' : initialsSvg()}
      </div>
      <div class="bot-card-info">
        <div class="bot-card-name">${escapeHtml(bot.name)}</div>
        <div class="bot-card-sub">${bot.hasVoice ? 'Voice enabled' : 'Text only'}</div>
      </div>
    `;
    card.addEventListener('click', () => openChat(bot.id));
    scroll.appendChild(card);
  });
}
function initialsSvg() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.getElementById('add-bot-btn').addEventListener('click', () => {
  resetCreateForm();
  goTo('page-create');
});
document.getElementById('create-back-btn').addEventListener('click', () => goTo('page-main'));
document.getElementById('chat-back-btn').addEventListener('click', async () => {
  await renderBotList();
  goTo('page-main');
});

/* ---------------- Create bot page ---------------- */
let pendingAvatarDataUrl = null;

function resetCreateForm() {
  pendingAvatarDataUrl = null;
  document.getElementById('bot-name').value = '';
  document.getElementById('bot-personality').value = '';
  document.getElementById('fish-key').value = '';
  document.getElementById('fish-voice-id').value = '';
  const preview = document.getElementById('avatar-preview');
  preview.style.backgroundImage = '';
  preview.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

document.getElementById('choose-image-btn').addEventListener('click', () => {
  document.getElementById('avatar-input').click();
});
document.getElementById('avatar-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingAvatarDataUrl = reader.result;
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundImage = `url('${pendingAvatarDataUrl}')`;
    preview.innerHTML = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('create-btn').addEventListener('click', async () => {
  const name = document.getElementById('bot-name').value.trim();
  const personality = document.getElementById('bot-personality').value.trim();
  const fishKey = document.getElementById('fish-key').value.trim();
  const fishVoiceId = document.getElementById('fish-voice-id').value.trim();

  if (!name) return toast('Give your bot a name.');
  if (!personality) return toast('Describe a personality for your bot.');

  const hasVoice = !!(fishKey && fishVoiceId);

  const bot = {
    id: 'bot_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    personality,
    pfp: pendingAvatarDataUrl,
    fishKey: hasVoice ? fishKey : '',
    fishVoiceId: hasVoice ? fishVoiceId : '',
    hasVoice,
    messages: []
  };

  await upsertBot(bot);
  toast('Bot created.');
  await renderBotList();
  goTo('page-main');
});

/* ---------------- Chat page ---------------- */
async function openChat(botId) {
  const bot = await getBot(botId);
  if (!bot) return toast('Could not load that bot.');
  currentChatBotId = botId;

  document.getElementById('chat-bot-name').textContent = bot.name;
  const avatarEl = document.getElementById('chat-bot-avatar');
  avatarEl.style.backgroundImage = bot.pfp ? `url('${bot.pfp}')` : '';

  renderMessages(bot);
  goTo('page-chat');
  document.getElementById('chat-input').focus();
}

function renderMessages(bot) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  bot.messages.forEach(m => appendMessageBubble(m.role, m.text));
  container.scrollTop = container.scrollHeight;
}

function appendMessageBubble(role, text) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'msg bot typing';
  bubble.id = 'typing-indicator';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

/**
 * Reads a fetch Response safely: never assumes the body is valid JSON.
 * This is what lets us show the REAL error instead of a generic
 * "connection error" message.
 */
async function readJsonSafely(res) {
  const raw = await res.text();
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, raw };
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentChatBotId) return;

  const bot = await getBot(currentChatBotId);
  if (!bot) return toast('Could not load this bot.');

  input.value = '';
  appendMessageBubble('user', text);
  bot.messages.push({ role: 'user', text });
  await upsertBot(bot);

  showTyping();

  let res;
  try {
    const history = bot.messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personality: bot.personality, messages: history })
    });
  } catch (networkErr) {
    hideTyping();
    toast('Network error: the browser could not reach /api/chat at all. Check your internet connection.');
    console.error('Fetch to /api/chat failed:', networkErr);
    return;
  }

  const parsed = await readJsonSafely(res);
  hideTyping();

  if (!parsed.ok) {
    console.error('Non-JSON response from /api/chat (status ' + res.status + '):', parsed.raw.slice(0, 500));
    toast(`Server returned an invalid response (status ${res.status}). The /api/chat function likely crashed — check Vercel → Deployments → Logs.`);
    return;
  }

  if (!res.ok) {
    toast(`AI error (${res.status}): ${parsed.data.error || 'Unknown error'}`);
    return;
  }

  const reply = parsed.data.reply || '...';
  appendMessageBubble('bot', reply);
  bot.messages.push({ role: 'bot', text: reply });
  await upsertBot(bot);

  if (bot.hasVoice) speak(bot, reply);
}

async function speak(bot, text) {
  let res;
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fishApiKey: bot.fishKey, voiceId: bot.fishVoiceId })
    });
  } catch (err) {
    console.error('Fetch to /api/tts failed:', err);
    return; // voice is a bonus, never block chat on it
  }

  if (!res.ok) {
    const parsed = await readJsonSafely(res);
    console.error('Voice generation failed:', parsed.ok ? parsed.data : parsed.raw);
    toast('Voice failed to generate (text reply above still works). Check Fish Audio key/voice ID.');
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(() => {});
}

document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

/* ---------------- Settings modal ---------------- */
let pendingSettingsAvatarDataUrl = null;

document.getElementById('chat-settings-btn').addEventListener('click', async () => {
  const bot = await getBot(currentChatBotId);
  if (!bot) return;
  pendingSettingsAvatarDataUrl = bot.pfp;

  const preview = document.getElementById('settings-avatar-preview');
  preview.style.backgroundImage = bot.pfp ? `url('${bot.pfp}')` : '';
  preview.innerHTML = bot.pfp ? '' : initialsSvg();

  document.getElementById('settings-fish-key').value = bot.fishKey || '';
  document.getElementById('settings-fish-voice-id').value = bot.fishVoiceId || '';

  document.getElementById('settings-modal').classList.add('active');
});

document.getElementById('settings-close-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('active');
});

document.getElementById('settings-choose-image-btn').addEventListener('click', () => {
  document.getElementById('settings-avatar-input').click();
});
document.getElementById('settings-avatar-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingSettingsAvatarDataUrl = reader.result;
    const preview = document.getElementById('settings-avatar-preview');
    preview.style.backgroundImage = `url('${pendingSettingsAvatarDataUrl}')`;
    preview.innerHTML = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const bot = await getBot(currentChatBotId);
  if (!bot) return;

  const fishKey = document.getElementById('settings-fish-key').value.trim();
  const fishVoiceId = document.getElementById('settings-fish-voice-id').value.trim();
  const hasVoice = !!(fishKey && fishVoiceId);

  bot.pfp = pendingSettingsAvatarDataUrl;
  bot.fishKey = hasVoice ? fishKey : '';
  bot.fishVoiceId = hasVoice ? fishVoiceId : '';
  bot.hasVoice = hasVoice;

  await upsertBot(bot);
  document.getElementById('settings-modal').classList.remove('active');
  await openChat(bot.id);
  toast('Settings saved.');
});

document.getElementById('settings-delete-btn').addEventListener('click', async () => {
  if (!currentChatBotId) return;
  await deleteBotRow(currentChatBotId);
  document.getElementById('settings-modal').classList.remove('active');
  await renderBotList();
  goTo('page-main');
  toast('Bot deleted.');
});

/* ---------------- Boot ---------------- */
window.addEventListener('DOMContentLoaded', async () => {
  const configured = initSupabase();
  if (!configured) {
    toast('Supabase is not configured yet — fill in public/config.js, run setup.sql, then redeploy.');
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await renderBotList();
    goTo('page-main');
  }

  sb.auth.onAuthStateChange(async (_event, newSession) => {
    if (newSession && !currentUser) {
      currentUser = newSession.user;
      await renderBotList();
      goTo('page-main');
    } else if (!newSession) {
      currentUser = null;
    }
  });
});
