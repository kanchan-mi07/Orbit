const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { io } = require('socket.io-client');

const root = path.resolve(__dirname, '..');
const mongoPath = process.env.MONGOD_PATH || 'mongod';
const tempDb = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-integration-'));
let mongoProcess;
let appProcess;
const sockets = [];
let appOutput = '';

function availablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close(() => resolve(port));
    });
  });
}

function listen(child) {
  child.stdout?.on('data', chunk => { appOutput += chunk.toString(); });
  child.stderr?.on('data', chunk => { appOutput += chunk.toString(); });
}

async function waitForHealth(baseUrl, child, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`App exited early.\n${appOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        const health = await response.json();
        if (health.database === 'connected') return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`App did not connect to the isolated MongoDB database.\n${appOutput}`);
}

async function request(baseUrl, token, route, { method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(response, status, action) {
  assert(response.status === status, `${action}: expected HTTP ${status}, got ${response.status} (${response.data.error || 'no error detail'})`);
}

function connectSocket(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
    const timeout = setTimeout(() => { socket.close(); reject(new Error('Socket.IO connection timed out')); }, 6000);
    socket.once('connect', () => { clearTimeout(timeout); sockets.push(socket); resolve(socket); });
    socket.once('connect_error', error => { clearTimeout(timeout); socket.close(); reject(error); });
  });
}

function nextEvent(socket, name, predicate = () => true, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timed out waiting for ${name}`)); }, timeoutMs);
    function handler(payload) { if (!predicate(payload)) return; clearTimeout(timer); resolve(payload); }
    socket.on(name, handler);
  });
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function run() {
  const mongoPort = await availablePort();
  const appPort = await availablePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const mongoUri = `mongodb://127.0.0.1:${mongoPort}/orbit_integration_test`;
  mongoProcess = spawn(mongoPath, ['--dbpath', tempDb, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mongod did not start within 10 seconds')), 10000);
    mongoProcess.once('spawn', () => { clearTimeout(timer); resolve(); });
    mongoProcess.once('error', error => { clearTimeout(timer); reject(new Error(`Could not start mongod (${mongoPath}): ${error.message}`)); });
  });
  appProcess = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(appPort),
      NODE_ENV: 'test',
      MONGODB_URI: mongoUri,
      JWT_SECRET: 'orbit-integration-smoke-secret',
      CLIENT_ORIGIN: baseUrl,
      REDIS_URL: '',
      ENABLE_NOTIFICATION_QUEUE: 'false',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  listen(appProcess);
  await waitForHealth(baseUrl, appProcess);
  console.log('PASS isolated app and MongoDB startup');

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const a = await request(baseUrl, null, '/api/auth/register', { method: 'POST', body: { name: 'Orbit Admin', email: `admin-${suffix}@example.test`, password: 'SmokeTest123!' } });
  expectStatus(a, 201, 'Admin registration');
  const b = await request(baseUrl, null, '/api/auth/register', { method: 'POST', body: { name: 'Orbit Member', email: `member-${suffix}@example.test`, password: 'SmokeTest123!' } });
  expectStatus(b, 201, 'Member registration');
  const adminToken = a.data.token;
  const memberToken = b.data.token;

  const team = await request(baseUrl, adminToken, '/api/teams', { method: 'POST', body: { name: 'Smoke Test Team' } });
  expectStatus(team, 201, 'Team creation');
  const teamId = team.data._id;
  const invite = await request(baseUrl, adminToken, `/api/teams/${teamId}/invites`, { method: 'POST', body: {} });
  expectStatus(invite, 200, 'Invite creation');
  const joined = await request(baseUrl, memberToken, '/api/teams/join', { method: 'POST', body: { inviteCode: invite.data.inviteCode } });
  expectStatus(joined, 200, 'Team invite join');
  const project = await request(baseUrl, adminToken, `/api/teams/${teamId}/projects`, { method: 'POST', body: { name: 'Smoke Project' } });
  expectStatus(project, 201, 'Project creation');
  const projectId = project.data._id;
  console.log('PASS registration, team invites, and project creation');

  const adminSocket = await connectSocket(baseUrl, adminToken);
  const memberSocket = await connectSocket(baseUrl, memberToken);
  const presence = nextEvent(adminSocket, 'team:presence', users => users.length >= 2);
  adminSocket.emit('project:join', { projectId });
  adminSocket.emit('team:join', { teamId });
  memberSocket.emit('project:join', { projectId });
  memberSocket.emit('team:join', { teamId });
  const onlineUsers = await presence;
  assert(onlineUsers.some(user => user.name === 'Orbit Admin') && onlineUsers.some(user => user.name === 'Orbit Member'), 'Presence did not include both team members');
  await new Promise(resolve => setTimeout(resolve, 150));
  console.log('PASS authenticated team presence');

  const created = await request(baseUrl, adminToken, `/api/projects/${projectId}/tasks`, { method: 'POST', body: { title: 'Realtime task', description: 'Integration check', assignee: b.data.user.id } });
  expectStatus(created, 201, 'Task creation and assignment');
  const taskId = created.data._id;
  const assignedNotes = await request(baseUrl, memberToken, '/api/notifications');
  expectStatus(assignedNotes, 200, 'Assigned task notifications');
  assert(assignedNotes.data.some(note => note.type === 'task:assigned'), 'Assignee did not receive a persisted assignment notification');

  const messageEvent = nextEvent(memberSocket, 'chat:message');
  const messageAck = new Promise((resolve, reject) => adminSocket.timeout(5000).emit('chat:message', { teamId, text: 'Realtime chat smoke check' }, (error, result) => error ? reject(error) : resolve(result)));
  const [message, accepted] = await Promise.all([messageEvent, messageAck]);
  assert(accepted.ok && accepted.id === message.id, 'Chat sender did not receive a successful save acknowledgement');
  assert(message.text === 'Realtime chat smoke check', 'Chat message was not broadcast');
  const history = await request(baseUrl, memberToken, `/api/teams/${teamId}/messages`);
  assert(history.data.some(item => item.text === message.text), 'Chat message was not persisted');

  const updateEvent = nextEvent(memberSocket, 'task:updated');
  adminSocket.emit('task:move', { id: taskId, status: 'completed' });
  const update = await updateEvent;
  assert(update.status === 'completed', 'Task status update was not broadcast');
  const storedTasks = await request(baseUrl, memberToken, `/api/projects/${projectId}/tasks`);
  assert(storedTasks.data.find(item => item._id === taskId)?.status === 'completed', 'Task status update was not persisted');

  const commentEvent = nextEvent(adminSocket, 'task:comment');
  const comment = await request(baseUrl, memberToken, `/api/tasks/${taskId}/comments`, { method: 'POST', body: { text: 'Comment smoke check' } });
  expectStatus(comment, 201, 'Task comment');
  const broadcastComment = await commentEvent;
  assert(broadcastComment.comment.text === 'Comment smoke check', 'Task comment was not broadcast');

  const uploadUnavailable = await request(baseUrl, adminToken, `/api/tasks/${taskId}/attachments`, { method: 'POST' });
  expectStatus(uploadUnavailable, 503, 'Cloudinary-disabled upload guard');
  const memberDelete = await request(baseUrl, memberToken, `/api/tasks/${taskId}`, { method: 'DELETE' });
  expectStatus(memberDelete, 403, 'Member task-delete role guard');

  const deletedEvent = nextEvent(memberSocket, 'task:deleted');
  const deleted = await request(baseUrl, adminToken, `/api/tasks/${taskId}`, { method: 'DELETE' });
  expectStatus(deleted, 200, 'Admin task deletion');
  await deletedEvent;
  const afterDelete = await request(baseUrl, adminToken, `/api/projects/${projectId}/tasks`);
  assert(!afterDelete.data.some(item => item._id === taskId), 'Deleted task remains in project results');
  const finalNotifications = await request(baseUrl, memberToken, '/api/notifications');
  assert(finalNotifications.data.some(note => note.type === 'task:updated'), 'Assignee did not receive a persisted task-update notification');
  console.log('PASS assigned notifications, live chat/task/comment/delete events, persistence, upload guard, and RBAC');
}

(async () => {
  let error;
  try { await run(); }
  catch (caught) { error = caught; console.error(`FAIL ${caught.stack || caught.message}`); }
  finally {
    for (const socket of sockets) socket.close();
    await stop(appProcess);
    await stop(mongoProcess);
    try { fs.rmSync(tempDb, { recursive: true, force: true }); } catch {}
  }
  if (error) process.exitCode = 1;
})();
