const seedTasks = [
  {
    id: "t1",
    title: "Finalize homepage wireframes",
    description: "Desktop + mobile layouts",
    status: "todo",
    tag: "Design",
    due: "Nov 28",
    assignee: "AM",
    comments: 3,
  },
  {
    id: "t2",
    title: "Write copy for about page",
    status: "todo",
    tag: "Content",
    due: "Nov 29",
    assignee: "RK",
    comments: 2,
  },
  {
    id: "t3",
    title: "Collect customer testimonials",
    status: "todo",
    tag: "Research",
    due: "Dec 02",
    assignee: "TL",
    comments: 0,
  },
  {
    id: "t4",
    title: "Design system & components",
    description: "Buttons, forms, cards, navigation",
    status: "progress",
    tag: "Design",
    due: "Nov 27",
    assignee: "JD",
    comments: 5,
  },
  {
    id: "t5",
    title: "Homepage hero illustrations",
    status: "progress",
    tag: "Brand",
    due: "Nov 28",
    assignee: "AM",
    comments: 1,
  },
  {
    id: "t6",
    title: "Set up staging environment",
    status: "progress",
    tag: "Development",
    due: "Nov 30",
    assignee: "TL",
    comments: 0,
  },
  {
    id: "t7",
    title: "Project kickoff & discovery",
    status: "completed",
    tag: "Research",
    due: "Nov 20",
    assignee: "JD",
    comments: 4,
  },
  {
    id: "t8",
    title: "Audit current website",
    status: "completed",
    tag: "Development",
    due: "Nov 22",
    assignee: "RK",
    comments: 2,
  },
];
const members = {
  JD: { name: "Jordan Davis", class: "avatar-me" },
  AM: { name: "Alex Morgan", class: "av1" },
  RK: { name: "Ravi Kapoor", class: "av2" },
  TL: { name: "Taylor Lee", class: "av3" },
};
const statusNames = {
  todo: "To do",
  progress: "In progress",
  completed: "Completed",
};
let tasks = [];
let socket = null;
let toastTimer;
let typingTimer, typingDisplayTimer;
let taskFilter = "";
let taskSearch = "";
let myTasksOnly = false;
let currentUserId = "JD";
let listSort = { key: "due", direction: 1 };
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
function tagClass(tag) {
  return (
    {
      Design: "tag-design",
      Content: "tag-content",
      Development: "tag-dev",
      Research: "tag-research",
      Brand: "tag-brand",
      Marketing: "tag-marketing",
    }[tag] || "tag-design"
  );
}
function matchesTask(task) {
  const assigneeName =
    task.assigneeName || members[task.assignee]?.name || "Unassigned";
  const mine =
    String(task.assigneeId || task.assignee || "") === String(currentUserId);
  return (!myTasksOnly || mine) && (!taskFilter || assigneeName === taskFilter);
}
function render() {
  for (const status of Object.keys(statusNames)) {
    const lane = document.getElementById(status);
    const rows = tasks.filter((t) => t.status === status && matchesTask(t));
    lane.innerHTML = rows.length
      ? rows
          .map((t) => {
            const member = members[t.assignee] || members.JD;
            return `<article class="task-card" draggable="true" data-id="${esc(
              t.id
            )}"><h3>${esc(t.title)}</h3>${
              t.description
                ? `<p class="task-desc">${esc(t.description)}</p>`
                : ""
            }${
              t.tag
                ? `<span class="tag ${tagClass(t.tag)}">${esc(t.tag)}</span>`
                : ""
            }<div class="task-footer"><span class="task-date ${
              t.overdue ? "overdue" : ""
            }">▢ ${esc(
              t.due || "No due date"
            )}</span><span class="task-spacer"></span>${
              t.comments
                ? `<span class="task-comments">▤ ${t.comments}</span>`
                : ""
            }<span class="avatar task-avatar ${member.class}" title="${esc(
              t.assigneeName || member.name
            )}">${esc(t.assignee)}</span></div></article>`;
          })
          .join("")
      : '<div class="empty-state">Nothing here yet</div>';
    document.querySelector(
      `[data-status="${status}"] .column-count`
    ).textContent = rows.length;
  }
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => openTaskDetails(card.dataset.id));
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  persist();
}
function persist() {}
function notify(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
let openActionMenu = null;
function showActionMenu(anchor, items) {
  openActionMenu?.remove();
  const menu = document.createElement("div");
  menu.className = "action-menu";
  menu.setAttribute("role", "menu");
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    button.addEventListener("click", () => {
      menu.remove();
      openActionMenu = null;
      item.action();
    });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect(),
    width = menu.offsetWidth,
    height = menu.offsetHeight;
  menu.style.left = `${Math.max(
    8,
    Math.min(rect.right - width, innerWidth - width - 8)
  )}px`;
  menu.style.top = `${Math.max(
    8,
    Math.min(rect.bottom + 4, innerHeight - height - 8)
  )}px`;
  openActionMenu = menu;
  const outside = (e) => {
    if (!menu.contains(e.target) && !anchor.contains(e.target)) {
      menu.remove();
      openActionMenu = null;
      document.removeEventListener("pointerdown", outside, true);
    }
  };
  const keys = (e) => {
    if (e.key === "Escape") {
      menu.remove();
      openActionMenu = null;
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", keys, true);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", outside, true));
  document.addEventListener("keydown", keys, true);
}
function changeStatus(id, status, remote = false) {
  if (!apiState.token) {
    showAuth();
    return;
  }
  const task = tasks.find((t) => t.id === id);
  if (!task || task.status === status) return;
  task.status = status;
  render();
  $("#liveText").textContent = `${task.title} moved to ${statusNames[status]}`;
  setTimeout(() => ($("#liveText").textContent = "You're all caught up"), 3500);
  if (!remote) {
    socket?.emit("task:move", { id, status });
    addActivity("You", task.title, statusNames[status]);
    notify(`Moved to ${statusNames[status]}`);
  }
}
document.querySelectorAll(".column").forEach((col) => {
  col.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    changeStatus(id, col.dataset.status);
  });
});
const dialog = $("#taskDialog");
const dueCreate = document.createElement("label");
dueCreate.className = "date-field";
dueCreate.innerHTML = 'Due date<input id="taskDue" type="date">';
document.querySelector("#taskStatus").closest(".form-row").before(dueCreate);
function openTask() {
  if (!apiState.token) {
    showAuth();
    return;
  }
  if (!apiState.projectId) {
    notify("Choose a workspace and project first");
    return;
  }
  dialog.showModal();
  $("#taskName").focus();
}
$("#addTask").addEventListener("click", openTask);
document.querySelectorAll("[data-add]").forEach((b) =>
  b.addEventListener("click", () => {
    if (b.closest(".column"))
      $("#taskStatus").value = b.closest(".column").dataset.status;
    openTask();
  })
);
$("#taskForm").addEventListener("submit", async (e) => {
  if (e.submitter?.value === "cancel") return;
  e.preventDefault();
  if (!apiState.token || !apiState.projectId) {
    showAuth();
    return;
  }
  if (!$("#taskName").value.trim()) return;
  const dueDate = $("#taskDue").value || null;
  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : `t${Date.now()}`,
    title: $("#taskName").value.trim(),
    description: $("#taskDescription").value.trim(),
    status: $("#taskStatus").value,
    assignee: $("#taskAssignee").value,
    tag: "Design",
    due: dueDate ? dateLabel(dueDate) : "No due date",
    dueISO: dueDate,
    comments: 0,
  };
  try {
    const assignee = $("#taskAssignee").value;
    const saved = await api("/api/projects/" + apiState.projectId + "/tasks", {
      method: "POST",
      body: {
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate,
        ...(assignee ? { assignee } : {}),
      },
    });
    Object.assign(task, {
      id: saved._id,
      comments: 0,
      assignee: initialsFor(saved.assignee?.name),
      assigneeId: saved.assignee?._id || "",
      assigneeName: saved.assignee?.name || "Unassigned",
    });
    if (!tasks.some((existing) => existing.id === task.id)) tasks.unshift(task);
    render();
    addActivity("You", task.title, statusNames[task.status], "created");
    dialog.close();
    e.target.reset();
    notify("Task created");
  } catch (err) {
    notify(err.message);
  }
});
const feed = $("#chatFeed"),
  input = $("#chatInput");
let chatReady = false,
  chatHistoryLoaded = false,
  chatTeamJoined = false;
function resetChatFeed() {
  feed.innerHTML =
    '<div class="day-separator"><span></span><b>Today</b><span></span></div><div class="chat-empty" id="chatEmpty">No messages yet. Send a message to start the conversation.</div><div class="typing" id="typing" hidden></div>';
}
resetChatFeed();
function addMessage({
  name = "You",
  initials = "JD",
  avatar = "avatar-me",
  text,
  time = null,
  own = true,
}) {
  const when =
    time ||
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  $("#chatEmpty")?.remove();
  const el = document.createElement("div");
  el.className = `message ${own ? "own-message" : ""}`;
  el.innerHTML = `<div class="avatar ${avatar}">${esc(
    initials
  )}</div><div class="message-body"><div class="message-meta"><b>${esc(
    name
  )}</b><time>${esc(when)}</time></div><p>${esc(text)}</p></div>`;
  const typing = $("#typing");
  feed.insertBefore(el, typing);
  feed.scrollTop = feed.scrollHeight;
}
function addActivity(name, title, status, verb = "moved") {
  const el = document.createElement("div");
  el.className = "chat-activity";
  el.innerHTML = `<div class="activity-icon">↗</div><div><b>${esc(
    name
  )}</b> ${esc(verb)} <a>${esc(title)}</a> ${
    verb === "created" ? "" : `to <span>${esc(status)}</span>`
  }</div>`;
  feed.insertBefore(el, $("#typing"));
  feed.scrollTop = feed.scrollHeight;
}
let chatSendPending = false;
function sendMessage() {
  if (!apiState.token || !apiState.teamId) {
    showAuth();
    return;
  }
  const text = input.value.trim();
  if (!text) return;
  if (!chatReady || !socket?.connected) {
    notify(
      "Team chat is connecting. Wait for the live connection and try again."
    );
    return;
  }
  if (chatSendPending) return;
  chatSendPending = true;
  const button = $("#sendMessage");
  button.disabled = true;
  socket
    .timeout(7000)
    .emit(
      "chat:message",
      { teamId: apiState.teamId, text },
      (error, result) => {
        chatSendPending = false;
        button.disabled = false;
        if (error) {
          notify(
            "Chat did not respond. Check the live connection and try again."
          );
          return;
        }
        if (result?.error) {
          notify(result.error);
          return;
        }
        addMessage({
          name: $(".profile-copy b").textContent,
          initials: initialsFor($(".profile-copy b").textContent),
          text,
          own: true,
        });
        input.value = "";
        input.style.height = "22px";
      }
    );
}
$("#sendMessage").addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
input.addEventListener("input", () => {
  input.style.height = "22px";
  input.style.height = Math.min(input.scrollHeight, 90) + "px";
  if (socket && apiState?.teamId) {
    clearTimeout(typingTimer);
    socket.emit("chat:typing", {
      teamId: apiState.teamId,
      typing: input.value.length > 0,
    });
    if (input.value.length)
      typingTimer = setTimeout(
        () =>
          socket?.emit("chat:typing", {
            teamId: apiState.teamId,
            typing: false,
          }),
        1200
      );
  }
});
$(".search-button").addEventListener("click", () => {
  let box = $(".search-pop");
  if (box) {
    box.remove();
    return;
  }
  box = document.createElement("div");
  box.className = "search-pop";
  box.innerHTML = '<input placeholder="Search tasks…" autofocus>';
  document.body.appendChild(box);
  box.querySelector("input").focus();
  box.querySelector("input").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document
      .querySelectorAll(".task-card")
      .forEach(
        (card) => (card.hidden = !card.textContent.toLowerCase().includes(q))
      );
  });
});
const baseRender = render;
render = function () {
  baseRender();
  const view = document.getElementById("listView");
  if (view && !view.hidden) renderList();
  const timeline = document.getElementById("timelineView");
  if (timeline && !timeline.hidden) renderTimeline();
  const files = document.getElementById("fileView");
  if (files && !files.hidden) renderFiles();
};
render();

// Persistent API mode: authenticate, choose a team/project, and hydrate the same board UI.
const apiState = {
  token: localStorage.getItem("orbit-token") || "",
  userId: "",
  teamId: "",
  projectId: "",
};
async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiState.token ? { Authorization: `Bearer ${apiState.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function requestText(
  title,
  label,
  initialValue = "",
  submitLabel = "Continue"
) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "input-dialog";
    d.innerHTML = `<form><div class="dialog-head"><div><span class="eyebrow">${title.toLowerCase().includes("project") ? "NEW PROJECT" : "WORKSPACE SETUP"}</span><h2>${esc(
      title
    )}</h2></div><button type="button" class="dialog-close" data-cancel aria-label="Close">×</button></div><label>${esc(
      label
    )}<input name="value" required maxlength="80" value="${esc(
      initialValue
    )}" placeholder="Enter ${esc(
      label.toLowerCase()
    )}"></label><p class="auth-error" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="cancel-button" data-cancel>Cancel</button><button type="submit" class="primary-button">${esc(
      submitLabel
    )} <span>→</span></button></div></form>`;
    document.body.appendChild(d);
    const form = d.querySelector("form"),
      input = form.elements.value;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      d.close();
      d.remove();
      resolve(value);
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) {
        form.querySelector(".auth-error").textContent = `${label} is required`;
        input.focus();
        return;
      }
      finish(value);
    });
    d.querySelectorAll("[data-cancel]").forEach((button) =>
      button.addEventListener("click", () => finish(null))
    );
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(null);
    });
    d.showModal();
    input.focus();
    input.select();
  });
}
function chooseTeamDialog(teams) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "input-dialog";
    d.innerHTML = `<form><div class="dialog-head"><div><span class="eyebrow">YOUR WORKSPACES</span><h2>Choose a team</h2></div></div><label>Team<select name="team">${teams
      .map(
        (team, index) => `<option value="${index}">${esc(team.name)}</option>`
      )
      .join(
        ""
      )}</select></label><div class="dialog-actions"><button type="submit" class="primary-button">Open team <span>→</span></button></div></form>`;
    document.body.appendChild(d);
    d.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const team = teams[Number(e.currentTarget.elements.team.value)];
      d.close();
      d.remove();
      resolve(team);
    });
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      d.close();
      d.remove();
      resolve(null);
    });
    d.showModal();
  });
}
function showInviteDialog(joinUrl) {
  const d = document.createElement("dialog");
  d.className = "input-dialog";
  d.innerHTML = `<form method="dialog"><div class="dialog-head"><div><span class="eyebrow">TEAM INVITATION</span><h2>Invite a teammate</h2></div><button class="dialog-close" aria-label="Close">×</button></div><label>Invitation link<input id="inviteLinkValue" readonly value="${esc(
    joinUrl
  )}"></label><div class="dialog-actions"><button type="button" class="primary-button" id="copyInviteLink">Copy link</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector("#copyInviteLink").addEventListener("click", async () => {
    const input = d.querySelector("#inviteLinkValue");
    try {
      await navigator.clipboard.writeText(joinUrl);
      notify("Invite link copied to clipboard");
    } catch {
      input.select();
      notify("Link selected. Copy it with Ctrl+C");
    }
  });
  d.addEventListener("close", () => d.remove());
  d.showModal();
  d.querySelector("#inviteLinkValue").focus();
  d.querySelector("#inviteLinkValue").select();
}
const authButton = document.createElement("button");
authButton.className = "share-button";
authButton.style.marginLeft = "8px";
authButton.textContent = apiState.token ? "Sign out" : "Sign in";
$(".heading-buttons").append(authButton);
authButton.addEventListener(
  "click",
  () => {
    if (apiState.token) {
      localStorage.removeItem("orbit-tasks");
      tasks = [];
      render();
    }
  },
  { capture: true }
);
function showAuth() {
  let d = $("#authDialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "authDialog";
    d.innerHTML =
      '<form id="authForm"><div class="dialog-head"><div><span class="eyebrow">YOUR WORKSPACE</span><h2 id="authTitle">Welcome back</h2></div><button type="button" class="dialog-close" id="authClose">×</button></div><label id="nameWrap" hidden>Your name<input id="authName" autocomplete="name" placeholder="Jordan Davis"></label><label>Email<input id="authEmail" type="email" required autocomplete="email" placeholder="you@company.com"></label><label>Password<input id="authPassword" type="password" required minlength="8" autocomplete="current-password" placeholder="At least 8 characters"></label><p id="authError" class="auth-error"></p><div class="dialog-actions"><button type="button" class="cancel-button" id="authMode">Create account</button><button class="primary-button" id="authSubmit">Sign in <span>→</span></button></div></form>';
    document.body.appendChild(d);
    let registering = false;
    $("#authClose").onclick = () => d.close();
    $("#authMode").onclick = () => {
      registering = !registering;
      $("#nameWrap").hidden = !registering;
      $("#authTitle").textContent = registering
        ? "Create your account"
        : "Welcome back";
      $("#authSubmit").innerHTML = registering
        ? "Create account <span>→</span>"
        : "Sign in <span>→</span>";
      $("#authMode").textContent = registering
        ? "Back to sign in"
        : "Create account";
      $("#authPassword").autocomplete = registering
        ? "new-password"
        : "current-password";
    };
    $("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      $("#authError").textContent = "";
      try {
        const payload = {
          email: $("#authEmail").value.trim(),
          password: $("#authPassword").value,
        };
        if (registering) payload.name = $("#authName").value.trim();
        const result = await api(
          "/api/auth/" + (registering ? "register" : "login"),
          { method: "POST", body: payload }
        );
        apiState.token = result.token;
        localStorage.setItem("orbit-token", result.token);
        d.close();
        authButton.textContent = "Sign out";
        await setupWorkspace(registering);
      } catch (err) {
        $("#authError").textContent = err.message;
      }
    };
  }
  d.showModal();
  $("#authEmail").focus();
}
function initialsFor(name = "Jordan Davis") {
  return (
    String(name)
      .split(/\s+/)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "JD"
  );
}
function dateLabel(value) {
  if (!value) return "No due date";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}
function taskFromApi(t) {
  const dueISO = t.dueDate
    ? new Date(t.dueDate).toISOString().slice(0, 10)
    : "";
  const due = dateLabel(dueISO);
  return {
    id: String(t._id || t.id),
    title: t.title,
    description: t.description || "",
    status: t.status,
    tag: "Design",
    due,
    dueISO,
    assignee: t.assignee ? initialsFor(t.assignee.name) : "JD",
    assigneeId: t.assignee ? String(t.assignee._id || t.assignee) : "",
    assigneeName: t.assignee?.name || "Unassigned",
    comments: t.comments?.length || 0,
    commentRows: (t.comments || []).map((c) => ({
      id: String(c._id || c.id),
      name: c.user?.name || c.name || "Teammate",
      text: c.text,
      createdAt: c.createdAt,
    })),
    attachments: t.attachments || [],
  };
}
async function setupWorkspace(isNew = false) {
  try {
    const me = await api("/api/auth/me");
    apiState.userId = me.id;
    currentUserId = me.id;
    $(".profile-copy b").textContent = me.name;
    $(".profile-copy small").textContent = me.email;
    let teams = await api("/api/teams");
    const invite = new URLSearchParams(location.search).get("invite");
    if (invite) {
      await api("/api/teams/join", {
        method: "POST",
        body: { inviteCode: invite },
      });
      history.replaceState({}, "", location.pathname);
      teams = await api("/api/teams");
    }
    let team;
    if (!teams.length) {
      const teamName = await requestText(
        "Create your workspace",
        "Team name",
        "Studio North",
        "Create team"
      );
      if (!teamName) {
        notify("Signed in. Create a team to sync tasks.");
        return;
      }
      team = await api("/api/teams", {
        method: "POST",
        body: { name: teamName },
      });
    } else {
      const requestedTeam = new URLSearchParams(location.search).get("team");
      team = teams.find((t) => String(t._id) === requestedTeam) || teams[0];
      if (!requestedTeam && teams.length > 1) {
        team = await chooseTeamDialog(teams);
        if (!team) return;
      }
    }
    apiState.teamId = team._id;
    $(".workspace-name b").textContent = team.name;
    let projects = await api(`/api/teams/${team._id}/projects`);
    let project;
    if (!projects.length) {
      let projectName = await requestText(
        "Create your first project",
        "Project name",
        "Website redesign",
        "Create project"
      );
      if (!projectName) {
        notify("Team connected. Add a project to sync tasks.");
        return;
      }
      project = await api(`/api/teams/${team._id}/projects`, {
        method: "POST",
        body: { name: projectName, description: "Team project" },
      });
      projects = [project];
    } else {
      const requested = new URLSearchParams(location.search).get("project");
      project =
        projects.find((p) => String(p._id) === requested) || projects[0];
    }
    apiState.projectId = project._id;
    $(".title-line h1").textContent = project.name;
    const breadcrumb = $(".breadcrumbs");
    if (breadcrumb) {
      breadcrumb.firstChild.nodeValue = team.name + " ";
      breadcrumb.querySelector("b").textContent = project.name;
    }
    const eyebrow = $(".project-heading .eyebrow");
    if (eyebrow?.childNodes[1])
      eyebrow.childNodes[1].nodeValue = ` ${team.name.toUpperCase()} `;
    $(".subtitle").textContent =
      project.description ||
      "Plan, track, and collaborate on work across your team.";
    chatReady = false;
    chatHistoryLoaded = false;
    chatTeamJoined = false;
    resetChatFeed();
    const rows = await api(`/api/projects/${project._id}/tasks`);
    tasks = rows.map(taskFromApi);
    render();
    socket?.disconnect();
    socket = io({ auth: { token: apiState.token } });
    socket.on("connect", () => {
      socket.emit("project:join", { projectId: apiState.projectId });
      socket.emit("team:join", { teamId: apiState.teamId }, (result) => {
        if (result?.error) {
          chatTeamJoined = false;
          chatReady = false;
          $("#liveText").textContent = "Team chat unavailable";
          $("#liveText").title = result.error;
          notify(result.error);
        } else {
          chatTeamJoined = true;
          chatReady = chatHistoryLoaded;
        }
      });
      document.querySelector(".live-indicator").style.background = "#6fc19b";
      $("#liveText").textContent = "Live updates connected";
    });
    socket.on("connect_error", (err) => {
      chatTeamJoined = false;
      chatReady = false;
      $("#liveText").textContent = "Live connection error";
      $("#liveText").title = err.message;
      console.error("Socket.IO connection failed:", err.message);
    });
    socket.on("disconnect", (reason) => {
      chatTeamJoined = false;
      chatReady = false;
      $("#liveText").textContent = "Live connection disconnected";
      $("#liveText").title = reason;
    });
    socket.on("task:updated", (task) => {
      const i = tasks.findIndex((t) => t.id === String(task._id || task.id));
      const row = taskFromApi(task);
      if (i < 0) tasks.push(row);
      else tasks[i] = row;
      render();
      addActivity("A teammate", row.title, statusNames[row.status]);
    });
    socket.on("task:created", (task) => {
      if (!tasks.some((t) => t.id === String(task._id || task.id))) {
        tasks.unshift(taskFromApi(task));
        render();
      }
    });
    socket.on("task:comment", ({ taskId }) => {
      const t = tasks.find((x) => x.id === String(taskId));
      if (t) t.comments++;
      render();
    });
    socket.on("chat:message", (m) => {
      if (m.senderId !== socket.id)
        addMessage({
          name: m.name || "Teammate",
          initials: m.initials || "AM",
          avatar: "av1",
          text: m.text,
          own: false,
        });
    });
    socket.on("chat:typing", (m) => {
      $("#typing").hidden = !m.typing;
    });
    const history = await api(`/api/teams/${team._id}/messages`);
    history.reverse().forEach((m) => {
      const mine = String(m.user?._id || "") === String(apiState.userId);
      const memberName = m.user?.name || "Teammate";
      addMessage({
        name: mine ? "You" : memberName,
        initials: initialsFor(memberName),
        avatar: mine ? "avatar-me" : "av2",
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        own: mine,
      });
    });
    chatHistoryLoaded = true;
    chatReady = chatTeamJoined && !!socket?.connected;
    notify("Workspace synced with MongoDB");
  } catch (err) {
    notify(err.message);
  }
}
authButton.addEventListener("click", async () => {
  if (apiState.token) {
    apiState.token = "";
    apiState.projectId = "";
    apiState.teamId = "";
    localStorage.removeItem("orbit-token");
    socket?.disconnect();
    authButton.textContent = "Sign in";
    tasks = JSON.parse(localStorage.getItem("orbit-tasks") || "[]");
    render();
    notify("Signed out");
  } else showAuth();
});
if (apiState.token) authButton.textContent = "Sign out";

const detailDialog = document.createElement("dialog");
detailDialog.id = "detailDialog";
detailDialog.innerHTML =
  '<section class="detail-panel"><div class="dialog-head"><div><span class="eyebrow">TASK DETAILS</span><h2 id="detailTitle"></h2></div><button class="dialog-close" id="detailClose">×</button></div><p id="detailDescription" class="detail-description"></p><div class="detail-section"><h3>Attachments</h3><div id="attachmentList" class="attachment-list"></div><label class="upload-label">＋ Attach a file<input id="attachmentInput" type="file" accept="image/*,.pdf,.txt,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx"></label><small class="upload-note">Up to 10 MB · Cloudinary required</small></div><div class="detail-section"><h3>Comments <span id="commentCount"></span></h3><div id="commentList" class="comment-list"></div><form id="commentForm" class="comment-form"><textarea id="commentInput" rows="2" maxlength="2000" placeholder="Write a comment..."></textarea><button class="primary-button">Send comment <span>→</span></button></form></div></section>';
document.body.appendChild(detailDialog);
const detailFields = document.createElement("div");
detailFields.className = "task-edit-fields";
detailFields.innerHTML =
  '<label>Task name<input id="detailTaskTitle" maxlength="100"></label><label>Description<textarea id="detailTaskDescription" rows="2" maxlength="2000"></textarea></label><label>Assignee<select id="detailAssignee"></select></label>';
detailDialog.querySelector("#detailDescription").after(detailFields);
const detailControls = document.createElement("div");
detailControls.className = "task-edit-grid";
detailControls.innerHTML =
  '<label>Status<select id="detailStatus"><option value="todo">To do</option><option value="progress">In progress</option><option value="completed">Completed</option></select></label><label>Due date<input id="detailDue" type="date"></label><button class="primary-button" id="saveTaskDetails">Save changes</button>';
detailFields.after(detailControls);
const deleteTaskButton = document.createElement("button");
deleteTaskButton.id = "deleteTask";
deleteTaskButton.type = "button";
deleteTaskButton.className = "delete-task-button";
deleteTaskButton.textContent = "Delete task";
detailControls.after(deleteTaskButton);
let activeTaskId = null;
function showTaskDetails() {
  const task = tasks.find((t) => t.id === activeTaskId);
  if (!task) return;
  $("#detailTitle").textContent = task.title;
  $("#deleteTask").hidden =
    !apiState.token || !["Admin", "Manager"].includes(apiState.role);
  $("#detailDescription").textContent =
    task.description || "No description yet.";
  $("#detailTaskTitle").value = task.title;
  $("#detailTaskDescription").value = task.description || "";
  $("#detailAssignee").innerHTML = $("#taskAssignee").innerHTML;
  $("#detailAssignee").value = apiState.token
    ? task.assigneeId || ""
    : task.assignee || "";
  $("#detailAssignee").disabled =
    (apiState.token && !task.assigneeId && apiState.teamId === "") ||
    !$("#detailAssignee").options.length;
  $("#detailStatus").value = task.status;
  $("#detailDue").value = task.dueISO || "";
  $("#commentCount").textContent = `(${
    task.commentRows?.length ?? task.comments ?? 0
  })`;
  $("#commentList").innerHTML =
    (task.commentRows || [])
      .map(
        (c) =>
          `<div class="comment-item"><div class="comment-avatar">${esc(
            initialsFor(c.name)
          )}</div><div><b>${esc(c.name)}</b><time>${esc(
            new Date(c.createdAt || Date.now()).toLocaleString()
          )}</time><p>${esc(c.text)}</p></div></div>`
      )
      .join("") ||
    '<p class="empty-detail">No comments yet. Start the conversation.</p>';
  $("#attachmentList").innerHTML =
    (task.attachments || [])
      .map(
        (a) =>
          `<a class="attachment-item" href="${esc(
            a.url
          )}" target="_blank" rel="noopener">↗ <span>${esc(
            a.name || "Attachment"
          )}</span></a>`
      )
      .join("") || '<p class="empty-detail">No files attached.</p>';
  $("#attachmentInput").disabled =
    !apiState.token || !task.id.match(/^[a-f\d]{24}$/i);
  $("#attachmentInput").value = "";
}
function openTaskDetails(id) {
  if (!apiState.token) {
    showAuth();
    return;
  }
  activeTaskId = id;
  showTaskDetails();
  detailDialog.showModal();
}
$("#detailClose").addEventListener("click", () => detailDialog.close());
$("#deleteTask").addEventListener("click", async () => {
  const task = tasks.find((t) => t.id === activeTaskId);
  if (
    !task ||
    !(await confirmInApp(`Delete “${task.title}” permanently?`, {
      title: "Delete task",
      confirmLabel: "Delete",
      danger: true,
    }))
  )
    return;
  try {
    if (apiState.token)
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
    tasks = tasks.filter((t) => t.id !== task.id);
    detailDialog.close();
    render();
    notify("Task deleted");
  } catch (err) {
    notify(err.message);
  }
});
$("#saveTaskDetails").addEventListener("click", async () => {
  if (!apiState.token) {
    showAuth();
    return;
  }
  const task = tasks.find((t) => t.id === activeTaskId);
  if (!task) return;
  const status = $("#detailStatus").value,
    dueISO = $("#detailDue").value || "",
    title = $("#detailTaskTitle").value.trim(),
    description = $("#detailTaskDescription").value,
    assignee = $("#detailAssignee").value;
  if (!title) {
    notify("Task name is required");
    return;
  }
  try {
    const saved = await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: { title, description, status, dueDate: dueISO || null, assignee },
    });
    const current = tasks.find((t) => t.id === activeTaskId) || task;
    current.title = title;
    current.description = description;
    current.status = status;
    current.dueISO = dueISO;
    current.due = dateLabel(dueISO);
    current.assigneeId = saved.assignee ? String(saved.assignee._id) : "";
    current.assignee = saved.assignee ? initialsFor(saved.assignee.name) : "JD";
    current.assigneeName = saved.assignee?.name || "Unassigned";
    render();
    showTaskDetails();
    notify("Task details saved");
  } catch (err) {
    notify(err.message);
  }
});
$("#commentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!apiState.token) {
    showAuth();
    return;
  }
  const text = $("#commentInput").value.trim(),
    task = tasks.find((t) => t.id === activeTaskId);
  if (!text || !task) return;
  try {
    const comment = await api(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      body: { text },
    });
    task.commentRows = task.commentRows || [];
    if (
      !task.commentRows.some(
        (c) => String(c.id || c._id) === String(comment.id)
      )
    )
      task.commentRows.push(comment);
    task.comments = task.commentRows.length;
    $("#commentInput").value = "";
    showTaskDetails();
    render();
  } catch (err) {
    notify(err.message);
  }
});
$("#attachmentInput").addEventListener("change", async (e) => {
  const file = e.target.files[0],
    task = tasks.find((t) => t.id === activeTaskId);
  if (!file || !task) return;
  try {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiState.token}` },
      body,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");
    task.attachments = task.attachments || [];
    if (!task.attachments.some((a) => a.publicId === result.publicId))
      task.attachments.push(result);
    showTaskDetails();
    notify("File attached");
  } catch (err) {
    notify(err.message);
  }
});
async function loadAssignees() {
  const teams = await api("/api/teams"),
    team = teams.find((t) => String(t._id) === String(apiState.teamId));
  if (!team) return;
  apiState.role =
    team.members.find((m) => String(m.user?._id) === String(apiState.userId))
      ?.role || "Member";
  const select = $("#taskAssignee");
  select.innerHTML = '<option value="">Unassigned</option>';
  for (const member of team.members || []) {
    const user = member.user;
    if (!user?._id) continue;
    const option = document.createElement("option");
    option.value = user._id;
    option.textContent = `${user.name} · ${member.role}`;
    select.appendChild(option);
  }
  $("#detailAssignee").innerHTML = select.innerHTML;
}
const setupWorkspaceBase = setupWorkspace;
setupWorkspace = async function (isNew = false) {
  await setupWorkspaceBase(isNew);
  if (!apiState.token || !apiState.teamId) return;
  try {
    await loadAssignees();
    await loadProjectNavigation();
    const unread = await api("/api/notifications");
    inboxItems = unread;
    updateNotificationBadge();
    const latest = unread.find((n) => !n.readAt);
    if (latest) notify(latest.message);
    socket?.off("notification");
    socket?.on("team:presence", (users) => {
      const area = document.querySelector(".chat-sub");
      let text = area.querySelector(".presence-text");
      if (!text) {
        area.childNodes.forEach((node) => {
          if (node.nodeType === 3) node.remove();
        });
        text = document.createElement("span");
        text.className = "presence-text";
        area.insertBefore(text, area.querySelector("button"));
      }
      text.textContent = users.length
        ? `${users.length} online · ${users
            .slice(0, 3)
            .map((u) => u.name)
            .join(", ")}`
        : "No teammates online";
    });
    socket?.on("chat:typing", (m) => {
      const el = document.querySelector("#typing");
      el.textContent = m.typing ? `${m.name || "A teammate"} is typing` : "";
      el.hidden = !m.typing;
      clearTimeout(typingDisplayTimer);
      if (m.typing)
        typingDisplayTimer = setTimeout(() => (el.hidden = true), 1500);
    });
    socket?.on("notification", (n) => {
      notify(n.message || "You have a new task notification");
      inboxItems = [
        {
          ...n,
          _id: n._id || `live-${Date.now()}`,
          createdAt: n.createdAt || new Date(),
        },
        ...inboxItems,
      ];
      if (inboxDialog.open) renderInbox();
      updateNotificationBadge();
    });
    socket?.on("task:comment", ({ taskId, comment }) => {
      const task = tasks.find((t) => t.id === String(taskId));
      if (task && comment) {
        task.commentRows = task.commentRows || [];
        const item = {
          id: String(comment._id || comment.id || ""),
          name: comment.name || "Teammate",
          text: comment.text,
          createdAt: comment.createdAt,
        };
        if (
          !task.commentRows.some(
            (c) => item.id && String(c.id || c._id) === item.id
          )
        )
          task.commentRows.push(item);
        task.comments = task.commentRows.length;
        if (activeTaskId === task.id) showTaskDetails();
      }
    });
    socket?.on("task:deleted", ({ id }) => {
      tasks = tasks.filter((t) => t.id !== String(id));
      if (activeTaskId === String(id) && detailDialog.open)
        detailDialog.close();
      render();
    });
    socket?.on("task:attachment", ({ taskId, attachment }) => {
      const task = tasks.find((t) => t.id === String(taskId));
      if (task && attachment) {
        task.attachments = task.attachments || [];
        if (!task.attachments.some((a) => a.publicId === attachment.publicId))
          task.attachments.push(attachment);
        if (activeTaskId === task.id) showTaskDetails();
      }
    });
    socket?.emit("team:join", { teamId: apiState.teamId });
  } catch (err) {
    console.warn(err.message);
  }
};
if (apiState.token)
  setupWorkspace(false)
    .catch((err) => notify(err.message))
    .finally(() => document.documentElement.classList.remove("app-loading"));
else {
  showAuth();
  $("#authClose").hidden = true;
  $("#authDialog").addEventListener("cancel", (e) => e.preventDefault());
  if (new URLSearchParams(location.search).has("invite"))
    $("#authTitle").textContent = "Sign in to join your team";
  document.documentElement.classList.remove("app-loading");
}
$(".notification-button").addEventListener("click", async () => {
  if (!apiState.token) return;
  try {
    const notes = await api("/api/notifications"),
      unread = notes.filter((n) => !n.readAt);
    if (!unread.length) {
      notify("You’re all caught up");
      return;
    }
    await Promise.all(
      unread.map((n) =>
        api(`/api/notifications/${n._id}/read`, { method: "PATCH" })
      )
    );
    notify(
      `${unread.length} notification${unread.length === 1 ? "" : "s"}: ${
        unread[0].message
      }`
    );
  } catch (err) {
    notify(err.message);
  }
});
async function inviteTeammates() {
  if (!apiState.token || !apiState.teamId) {
    notify("Sign in and open a team before inviting teammates");
    return;
  }
  try {
    const invite = await api(`/api/teams/${apiState.teamId}/invites`, {
      method: "POST",
      body: {},
    });
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(invite.joinUrl);
      notify("Invite link copied to clipboard");
    } else {
      showInviteDialog(invite.joinUrl);
    }
  } catch (err) {
    notify(
      err instanceof TypeError && err.message === "Failed to fetch"
        ? `Could not reach Orbit at ${location.origin}. Make sure the server is running, then refresh the page.`
        : err.message
    );
  }
}
$(".share-button").addEventListener("click", inviteTeammates);
function openTaskFilter() {
  let pop = $(".filter-popover");
  if (pop) {
    pop.remove();
    return;
  }
  const names = [
    ...new Set(
      tasks.map(
        (t) => t.assigneeName || members[t.assignee]?.name || "Unassigned"
      )
    ),
  ].sort();
  pop = document.createElement("div");
  pop.className = "filter-popover";
  pop.innerHTML = `<b>Filter tasks</b><label>Assignee<select id="assigneeFilter"><option value="">Everyone</option>${names
    .map(
      (n) =>
        `<option value="${esc(n)}" ${taskFilter === n ? "selected" : ""}>${esc(
          n
        )}</option>`
    )
    .join("")}</select></label><button id="clearFilter">Clear filter</button>`;
  const tools = $(".board-tools");
  tools.style.position = "relative";
  tools.appendChild(pop);
  pop.querySelector("#assigneeFilter").addEventListener("change", (e) => {
    taskFilter = e.target.value;
    render();
    $(".filter-button").classList.toggle("filtered", !!taskFilter);
  });
  pop.querySelector("#clearFilter").addEventListener("click", () => {
    taskFilter = "";
    render();
    $(".filter-button").classList.remove("filtered");
    pop.remove();
  });
}
$(".filter-button").addEventListener(
  "click",
  (e) => {
    e.stopImmediatePropagation();
    openTaskFilter();
  },
  true
);
const membersDialog = document.createElement("dialog");
membersDialog.id = "membersDialog";
membersDialog.innerHTML =
  '<section class="members-panel"><div class="dialog-head"><div><span class="eyebrow">TEAM SETTINGS</span><h2>Team members</h2></div><button class="dialog-close" id="membersClose">×</button></div><p class="members-help">Manage access for everyone in this workspace.</p><div id="memberRows" class="member-rows"></div></section>';
document.body.appendChild(membersDialog);
$("#membersClose").addEventListener("click", () => membersDialog.close());
async function openMembers() {
  if (!apiState.token || !apiState.teamId) {
    notify("Sign in to view team members");
    return;
  }
  try {
    const teams = await api("/api/teams"),
      team = teams.find((t) => String(t._id) === String(apiState.teamId));
    if (!team) throw new Error("Team not found");
    const self = team.members.find(
      (m) => String(m.user?._id) === String(apiState.userId)
    );
    apiState.role = self?.role || "Member";
    const canManage = apiState.role === "Admin";
    $("#memberRows").innerHTML =
      (team.members || [])
        .map((m) => {
          const user = m.user || {};
          const isSelf = String(user._id) === String(apiState.userId);
          return `<div class="member-row"><div class="member-avatar">${esc(
            initialsFor(user.name || user.email || "M")
          )}</div><div class="member-info"><b>${esc(user.name || "Teammate")}${
            isSelf ? " <span>(you)</span>" : ""
          }</b><small>${esc(user.email || "")}</small></div>${
            canManage
              ? `<select class="role-select" data-user="${esc(
                  user._id
                )}" aria-label="Role for ${esc(
                  user.name || "member"
                )}"><option ${
                  m.role === "Admin" ? "selected" : ""
                }>Admin</option><option ${
                  m.role === "Manager" ? "selected" : ""
                }>Manager</option><option ${
                  m.role === "Member" ? "selected" : ""
                }>Member</option></select>`
              : `<span class="member-role">${esc(m.role)}</span>`
          }</div>`;
        })
        .join("") || '<p class="empty-detail">No team members yet.</p>';
    membersDialog.showModal();
  } catch (err) {
    notify(err.message);
  }
}
$(".avatar-stack").addEventListener("click", openMembers);
$(".avatar-stack").style.cursor = "pointer";
$("#memberRows").addEventListener("change", async (e) => {
  const select = e.target.closest(".role-select");
  if (!select) return;
  try {
    await api(
      `/api/teams/${apiState.teamId}/members/${select.dataset.user}/role`,
      { method: "PATCH", body: { role: select.value } }
    );
    if (select.dataset.user === apiState.userId) apiState.role = select.value;
    notify("Member role updated");
    if (apiState.role !== "Admin") {
      membersDialog.close();
    }
  } catch (err) {
    notify(err.message);
    openMembers();
  }
});

async function loadProjectNavigation() {
  const projects = await api(`/api/teams/${apiState.teamId}/projects`),
    nav = $(".nav.projects");
  nav.innerHTML =
    projects
      .map(
        (project, index) =>
          `<a href="#" class="nav-item ${
            String(project._id) === String(apiState.projectId)
              ? "active-project"
              : ""
          }" data-project-id="${esc(project._id)}"><i class="project-dot ${
            ["violet", "orange", "green", "blue"][index % 4]
          }"></i>${esc(project.name)}</a>`
      )
      .join("") +
    '<a href="#" class="nav-item muted create-project">＋ Add a project</a>';
}
function openProject(id) {
  const next = new URL(location.href);
  next.searchParams.set("project", id);
  if (apiState.teamId) next.searchParams.set("team", apiState.teamId);
  location.assign(next.toString());
}
$(".projects").addEventListener("click", async (e) => {
  const projectLink = e.target.closest("[data-project-id]");
  if (projectLink) {
    e.preventDefault();
    if (projectLink.dataset.projectId !== apiState.projectId)
      openProject(projectLink.dataset.projectId);
    return;
  }
  if (!e.target.closest(".create-project")) return;
  e.preventDefault();
  if (!apiState.token) {
    notify("Sign in to create a project");
    return;
  }
  const name = await requestText(
    "Create a project",
    "Project name",
    "",
    "Create project"
  );
  if (!name?.trim()) return;
  try {
    const project = await api(`/api/teams/${apiState.teamId}/projects`, {
      method: "POST",
      body: { name: name.trim() },
    });
    openProject(project._id);
  } catch (err) {
    notify(err.message);
  }
});
const listView = document.createElement("section");
listView.id = "listView";
listView.className = "list-view";
listView.hidden = true;
$("#board").after(listView);
const timelineView = document.createElement("section");
timelineView.id = "timelineView";
timelineView.className = "timeline-view";
timelineView.hidden = true;
listView.after(timelineView);
const fileView = document.createElement("section");
fileView.id = "fileView";
fileView.className = "file-view";
fileView.hidden = true;
timelineView.after(fileView);
const homeView = document.createElement("section");
homeView.id = "homeView";
homeView.className = "home-view";
homeView.hidden = true;
fileView.after(homeView);
const guideDialog = document.createElement("dialog");
guideDialog.id = "guideDialog";
guideDialog.innerHTML =
  '<section class="guide-panel"><div class="dialog-head"><div><span class="eyebrow">GETTING STARTED</span><h2>Orbit workspace guide</h2></div><button type="button" class="dialog-close" id="guideClose" aria-label="Close">×</button></div><div class="guide-steps"><article><span>1</span><div><b>Invite your team</b><p>Choose Share to copy an invitation link. Teammates sign in or create an account to join.</p></div></article><article><span>2</span><div><b>Organize projects</b><p>Use Add a project in the sidebar. Admins and Managers can create projects.</p></div></article><article><span>3</span><div><b>Track tasks</b><p>Add tasks to a column, drag them between statuses, and open a task to edit details, comment, or attach a file.</p></div></article><article><span>4</span><div><b>Stay in sync</b><p>Team chat and task updates work when you are signed in and the board shows Live updates connected.</p></div></article><article><span>5</span><div><b>On a phone</b><p>Scroll down to see each task status. Use the menu button for navigation and Chat to open team messages.</p></div></article></div><div class="dialog-actions"><button type="button" class="cancel-button" id="guideInvite">Invite a teammate</button><button type="button" class="primary-button" id="guideDone">Got it</button></div></section>';
document.body.appendChild(guideDialog);
$("#guideClose").addEventListener("click", () => guideDialog.close());
$("#guideDone").addEventListener("click", () => guideDialog.close());
$("#guideInvite").addEventListener("click", () => {
  guideDialog.close();
  $(".share-button").click();
});
const inboxDialog = document.createElement("dialog");
inboxDialog.id = "inboxDialog";
inboxDialog.innerHTML =
  '<section class="inbox-panel"><div class="dialog-head"><div><span class="eyebrow">UPDATES</span><h2>Inbox</h2></div><button class="dialog-close" id="inboxClose">×</button></div><div id="inboxItems" class="inbox-items"></div></section>';
document.body.appendChild(inboxDialog);
let inboxItems = [];
function updateNotificationBadge() {
  const badge = $(".notification-button i");
  const unread = inboxItems.filter((n) => !n.readAt).length;
  badge.hidden = !unread;
  $(".notification-button").title = unread
    ? `${unread} unread notification${unread === 1 ? "" : "s"}`
    : "Notifications";
}
$("#inboxClose").addEventListener("click", () => inboxDialog.close());
function renderInbox() {
  const list = $("#inboxItems");
  list.innerHTML = inboxItems.length
    ? inboxItems
        .map(
          (n) =>
            `<article class="inbox-item ${
              n.readAt ? "read" : ""
            }"><span class="inbox-status"></span><div class="inbox-item-copy"><b>${esc(
              n.message || "Task update"
            )}</b><time>${esc(
              new Date(n.createdAt || Date.now()).toLocaleString()
            )}</time></div>${
              !n.readAt
                ? `<button data-read="${esc(n._id)}">Mark read</button>`
                : ""
            }</article>`
        )
        .join("")
    : '<div class="files-empty"><b>You’re all caught up</b><p>Task assignments and updates will show here.</p></div>';
}
async function openInbox() {
  if (!apiState.token) {
    notify("Sign in to view your inbox");
    return;
  }
  try {
    inboxItems = await api("/api/notifications");
    updateNotificationBadge();
    renderInbox();
    inboxDialog.showModal();
  } catch (err) {
    notify(err.message);
  }
}
$("#inboxItems").addEventListener("click", async (e) => {
  const button = e.target.closest("[data-read]");
  if (!button) return;
  try {
    const updated = await api(
      `/api/notifications/${button.dataset.read}/read`,
      { method: "PATCH" }
    );
    inboxItems = inboxItems.map((n) => (n._id === updated._id ? updated : n));
    updateNotificationBadge();
    renderInbox();
  } catch (err) {
    notify(err.message);
  }
});
$(".notification-button").addEventListener(
  "click",
  (e) => {
    e.stopImmediatePropagation();
    openInbox();
  },
  true
);
const inboxLink = document.querySelector(".nav-inbox");
inboxLink?.addEventListener(
  "click",
  (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    closeMobilePanels();
    openInbox();
  },
  true
);
function renderList() {
  if (!listView || listView.hidden) return;
  let rows = tasks.filter(
    (t) =>
      matchesTask(t) &&
      (!taskSearch ||
        `${t.title} ${t.description || ""} ${t.assigneeName || ""}`
          .toLowerCase()
          .includes(taskSearch))
  );
  rows.sort((a, b) => {
    const av =
      listSort.key === "assignee"
        ? a.assigneeName || "Unassigned"
        : listSort.key === "status"
        ? statusNames[a.status] || ""
        : listSort.key === "due"
        ? a.dueISO || "9999"
        : a.title;
    const bv =
      listSort.key === "assignee"
        ? b.assigneeName || "Unassigned"
        : listSort.key === "status"
        ? statusNames[b.status] || ""
        : listSort.key === "due"
        ? b.dueISO || "9999"
        : b.title;
    return String(av).localeCompare(String(bv)) * listSort.direction;
  });
  listView.innerHTML = `<div class="list-table-wrap"><table class="task-table"><thead><tr><th><button data-sort="title">Task ${
    listSort.key === "title" ? (listSort.direction > 0 ? "↑" : "↓") : ""
  }</button></th><th><button data-sort="status">Status ${
    listSort.key === "status" ? (listSort.direction > 0 ? "↑" : "↓") : ""
  }</button></th><th><button data-sort="assignee">Assignee ${
    listSort.key === "assignee" ? (listSort.direction > 0 ? "↑" : "↓") : ""
  }</button></th><th><button data-sort="due">Due date ${
    listSort.key === "due" ? (listSort.direction > 0 ? "↑" : "↓") : ""
  }</button></th><th>Comments</th></tr></thead><tbody>${rows
    .map(
      (t) =>
        `<tr class="task-row"><td><button class="task-title-link" data-open-task="${esc(
          t.id
        )}">${esc(
          t.title
        )}</button></td><td><select class="table-status" data-task="${esc(
          t.id
        )}" aria-label="Status for ${esc(t.title)}">${Object.entries(
          statusNames
        )
          .map(
            ([key, label]) =>
              `<option value="${key}" ${
                t.status === key ? "selected" : ""
              }>${label}</option>`
          )
          .join("")}</select></td><td>${esc(
          t.assigneeName || members[t.assignee]?.name || "Unassigned"
        )}</td><td>${esc(t.due || "No due date")}</td><td>${
          t.comments || 0
        }</td></tr>`
    )
    .join("")}</tbody></table>${
    rows.length
      ? ""
      : '<p class="empty-detail">No tasks match the current search or filter.</p>'
  }</div>`;
}
function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}
function dueKey(task) {
  if (task.dueISO) return String(task.dueISO).slice(0, 10);
  if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(task.due || "")) {
    const guess = new Date(`${task.due} ${new Date().getFullYear()}`);
    if (!Number.isNaN(guess.getTime())) return localDayKey(guess);
  }
  return "";
}
function renderTimeline() {
  if (!timelineView || timelineView.hidden) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 21 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return date;
  });
  let rows = tasks.filter(
    (t) =>
      matchesTask(t) &&
      (!taskSearch ||
        `${t.title} ${t.description || ""} ${t.assigneeName || ""}`
          .toLowerCase()
          .includes(taskSearch))
  );
  const header = `<div class="timeline-row timeline-header"><div class="timeline-task-heading">Task</div><div class="timeline-outside">Past</div>${dates
    .map(
      (d) =>
        `<div class="timeline-day ${
          localDayKey(d) === localDayKey(today) ? "today" : ""
        }"><b>${d.toLocaleDateString(undefined, {
          weekday: "short",
        })}</b><span>${d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}</span></div>`
    )
    .join("")}<div class="timeline-outside">Later</div></div>`;
  const rowMarkup = rows
    .map((task) => {
      const key = dueKey(task);
      const diff = key
        ? Math.round((new Date(`${key}T00:00:00`) - today) / 86400000)
        : null;
      let marker = "";
      if (key && diff < 0)
        marker =
          task.status === "completed"
            ? '<span class="timeline-marker completed">Completed</span>'
            : '<span class="timeline-marker past">Overdue</span>';
      else if (key && diff >= dates.length)
        marker = '<span class="timeline-marker later">Later</span>';
      else if (key)
        marker = `<span class="timeline-marker ${esc(
          task.status
        )}" title="Due ${esc(task.due)}">${esc(task.due)}</span>`;
      return `<div class="timeline-row"><div class="timeline-task"><button data-open-task="${esc(
        task.id
      )}">${esc(task.title)}</button><small>${esc(
        task.assigneeName || members[task.assignee]?.name || "Unassigned"
      )}</small></div><div class="timeline-cell">${
        diff !== null && diff < 0 ? marker : ""
      }</div>${dates
        .map(
          (d, i) =>
            `<div class="timeline-cell ${i === 0 ? "today" : ""}">${
              diff === i ? marker : ""
            }</div>`
        )
        .join("")}<div class="timeline-cell">${
        diff !== null && diff >= dates.length ? marker : ""
      }</div></div>`;
    })
    .join("");
  timelineView.innerHTML = `<div class="timeline-scroll"><div class="timeline-grid">${header}${
    rowMarkup ||
    '<div class="timeline-empty">No tasks match the current search or filter.</div>'
  }</div></div><p class="timeline-note">Showing the next 21 days · Tasks without due dates appear without a marker.</p>`;
}
listView.addEventListener("click", (e) => {
  const sort = e.target.closest("[data-sort]");
  if (sort) {
    if (listSort.key === sort.dataset.sort) listSort.direction *= -1;
    else {
      listSort.key = sort.dataset.sort;
      listSort.direction = 1;
    }
    renderList();
    return;
  }
  const open = e.target.closest("[data-open-task]");
  if (open) openTaskDetails(open.dataset.openTask);
});
listView.addEventListener("change", (e) => {
  const status = e.target.closest(".table-status");
  if (!status) return;
  changeStatus(status.dataset.task, status.value);
  renderList();
});
timelineView.addEventListener("click", (e) => {
  const task = e.target.closest("[data-open-task]");
  if (task) openTaskDetails(task.dataset.openTask);
});
$(".tabs").addEventListener(
  "click",
  (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.querySelector(".tab.active")?.classList.remove("active");
    tab.classList.add("active");
    if (tab.textContent.includes("List")) {
      $("#board").hidden = true;
      timelineView.hidden = true;
      fileView.hidden = true;
      listView.hidden = false;
      renderList();
    } else if (tab.textContent.includes("Timeline")) {
      $("#board").hidden = true;
      listView.hidden = true;
      fileView.hidden = true;
      timelineView.hidden = false;
      renderTimeline();
    } else if (tab.textContent.includes("Files")) {
      $("#board").hidden = true;
      listView.hidden = true;
      timelineView.hidden = true;
      fileView.hidden = false;
      renderFiles();
    } else if (tab.textContent.includes("Board")) {
      listView.hidden = true;
      timelineView.hidden = true;
      fileView.hidden = true;
      $("#board").hidden = false;
    } else notify(`${tab.textContent.trim()} view is coming soon`);
  },
  true
);
document.addEventListener(
  "input",
  (e) => {
    if (e.target.matches(".search-pop input")) {
      taskSearch = e.target.value.trim().toLowerCase();
      renderList();
      renderTimeline();
      renderFiles();
    }
  },
  true
);
function renderFiles() {
  if (!fileView || fileView.hidden) return;
  const entries = tasks
    .filter(
      (t) =>
        matchesTask(t) &&
        (!taskSearch ||
          `${t.title} ${t.description || ""}`
            .toLowerCase()
            .includes(taskSearch))
    )
    .flatMap((task) =>
      (task.attachments || []).map((file) => ({ task, file }))
    );
  fileView.innerHTML = entries.length
    ? `<div class="file-grid">${entries
        .map(
          ({ task, file }) =>
            `<article class="file-card"><div class="file-card-icon">▧</div><div class="file-card-copy"><a href="${esc(
              file.url
            )}" target="_blank" rel="noopener">${esc(
              file.name || "Attachment"
            )}</a><small>Attached to <button data-open-task="${esc(
              task.id
            )}">${esc(
              task.title
            )}</button></small></div><a class="file-open" href="${esc(
              file.url
            )}" target="_blank" rel="noopener" aria-label="Open file">↗</a></article>`
        )
        .join("")}</div>`
    : '<div class="files-empty"><span>▧</span><b>No files in this project yet</b><p>Attach files from any task to collect them here.</p></div>';
}
fileView.addEventListener("click", (e) => {
  const task = e.target.closest("[data-open-task]");
  if (task) openTaskDetails(task.dataset.openTask);
});
const myTasksLink = document.querySelector(".nav-my-tasks");
myTasksLink?.classList.remove("active");
myTasksLink?.addEventListener("click", (e) => {
  e.preventDefault();
  showProjectView();
  myTasksOnly = !myTasksOnly;
  myTasksLink.classList.toggle("active", myTasksOnly);
  render();
  notify(
    myTasksOnly ? "Showing tasks assigned to you" : "Showing all project tasks"
  );
});
const homeLink = document.querySelector(".nav-home");
homeLink?.addEventListener("click", (e) => {
  e.preventDefault();
  openHome();
});
function showProjectView() {
  homeView.hidden = true;
  for (const selector of [
    ".project-heading",
    ".project-meta",
    "#board",
    ".board-foot",
    "#listView",
    "#timelineView",
    "#fileView",
  ]) {
    const el = document.querySelector(selector);
    if (el) el.hidden = false;
  }
  $("#board").hidden = false;
  listView.hidden = true;
  timelineView.hidden = true;
  fileView.hidden = true;
  document.querySelector(".tab.active")?.classList.remove("active");
  document.querySelector(".tab").classList.add("active");
  homeLink?.classList.remove("active");
}
async function openHome() {
  for (const selector of [
    ".project-heading",
    ".project-meta",
    "#board",
    ".board-foot",
    "#listView",
    "#timelineView",
    "#fileView",
  ]) {
    const el = document.querySelector(selector);
    if (el) el.hidden = true;
  }
  homeView.hidden = false;
  homeLink?.classList.add("active");
  myTasksLink?.classList.remove("active");
  let projects = [],
    groups = [];
  try {
    if (apiState.token) {
      projects = await api(`/api/teams/${apiState.teamId}/projects`);
      groups = await Promise.all(
        projects.map(async (project) => ({
          project,
          tasks: await api(`/api/projects/${project._id}/tasks`),
        }))
      );
    } else groups = [{ project: { name: "Website redesign" }, tasks }];
  } catch (err) {
    notify(err.message);
    return;
  }
  const all = groups.flatMap((g) =>
    g.tasks.map((t) => ({
      ...t,
      projectName: g.project.name,
      projectId: g.project._id,
    }))
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = all.filter(
    (t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < today
  ).length;
  const inProgress = all.filter((t) => t.status === "progress").length;
  const completed = all.filter((t) => t.status === "completed").length;
  const recent = [...all]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0) -
        new Date(a.updatedAt || a.createdAt || 0)
    )
    .slice(0, 6);
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
      ? "Good afternoon"
      : "Good evening";
  homeView.innerHTML = `<div class="home-greeting"><span class="eyebrow">TEAM OVERVIEW</span><h1>${greeting}, ${esc(
    apiState.token ? $(".profile-copy b").textContent : "Jordan"
  )}</h1><p>A quick look at the work moving across your projects.</p></div><div class="home-stats"><article><span>Open tasks</span><b>${
    all.length - completed
  }</b></article><article><span>In progress</span><b>${inProgress}</b></article><article><span>Completed</span><b>${completed}</b></article><article class="overdue-stat"><span>Overdue</span><b>${overdue}</b></article></div><div class="home-section-head"><h2>Your projects</h2><button class="home-add-project">＋ Add project</button></div><div class="home-projects">${
    groups
      .map(({ project, tasks: rows }) => {
        const done = rows.filter((t) => t.status === "completed").length;
        return `<button class="home-project" ${
          project._id ? `data-open-project="${esc(project._id)}"` : ""
        }><span class="project-dot violet"></span><b>${esc(
          project.name
        )}</b><small>${
          rows.length
        } tasks · ${done} completed</small><span class="home-project-arrow">→</span></button>`;
      })
      .join("") || '<p class="empty-detail">No projects yet.</p>'
  }</div><div class="home-section-head recent-head"><h2>Recently updated</h2></div><div class="home-recent">${
    recent
      .map(
        (task) =>
          `<article><span class="status-mark ${
            task.status === "completed"
              ? "done-mark"
              : task.status === "progress"
              ? "progress-mark"
              : "todo-mark"
          }">${task.status === "completed" ? "✓" : ""}</span><div><b>${esc(
            task.title
          )}</b><small>${esc(task.projectName)} · ${esc(
            task.assignee?.name || "Unassigned"
          )}</small></div><span class="home-status">${esc(
            statusNames[task.status] || task.status
          )}</span></article>`
      )
      .join("") || '<p class="empty-detail">No recent tasks yet.</p>'
  }</div>`;
  homeView
    .querySelectorAll("[data-open-project]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openProject(button.dataset.openProject)
      )
    );
  homeView
    .querySelector(".home-add-project")
    ?.addEventListener("click", () => $(".create-project")?.click());
}

// Context menus and narrow-screen panels.
const inviteTeammate = () => $(".share-button").click();
document.querySelector(".workspace-menu")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "Team members", action: openMembers },
    { label: "Invite teammates", action: inviteTeammate },
    { label: "Add a project", action: () => $(".create-project")?.click() },
  ])
);
document.querySelector(".title-more")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "Refresh project", action: () => setupWorkspace(false) },
    { label: "Invite teammates", action: inviteTeammate },
    { label: "Team members", action: openMembers },
  ])
);
document.querySelectorAll(".column-more").forEach((button) =>
  button.addEventListener("click", (e) => {
    const status = e.currentTarget.closest(".column").dataset.status;
    showActionMenu(e.currentTarget, [
      {
        label: "Add task to this column",
        action: () => {
          $("#taskStatus").value = status;
          openTask();
        },
      },
      {
        label: "Sort by due date",
        action: () => {
          tasks.sort((a, b) =>
            String(a.dueISO || "9999-12-31").localeCompare(
              String(b.dueISO || "9999-12-31")
            )
          );
          render();
        },
      },
      {
        label: "Sort alphabetically",
        action: () => {
          tasks.sort((a, b) => a.title.localeCompare(b.title));
          render();
        },
      },
    ]);
  })
);
document.querySelector(".chat-menu")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "Team members", action: openMembers },
    { label: "Invite teammates", action: inviteTeammate },
  ])
);
document.querySelector(".view-button")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "Filter tasks", action: openTaskFilter },
    { label: "Refresh project", action: () => setupWorkspace(false) },
    {
      label: "Show all tasks",
      action: () => {
        taskFilter = "";
        myTasksOnly = false;
        render();
        notify("Showing all project tasks");
      },
    },
  ])
);
document
  .querySelector(".profile-menu")
  ?.addEventListener("click", (e) =>
    showActionMenu(e.currentTarget, [
      {
        label: apiState.token ? "Sign out" : "Sign in",
        action: () => authButton.click(),
      },
    ])
  );
const mobileBackdrop = $("#mobileBackdrop"),
  sidebar = $(".sidebar"),
  chatPanel = $(".chat-panel");
function closeMobilePanels() {
  sidebar.classList.remove("mobile-open");
  chatPanel.classList.remove("mobile-open");
  mobileBackdrop.hidden = true;
}
$(".mobile-nav-toggle")?.addEventListener("click", () => {
  chatPanel.classList.remove("mobile-open");
  sidebar.classList.add("mobile-open");
  mobileBackdrop.hidden = false;
});
$(".mobile-chat-toggle")?.addEventListener("click", () => {
  sidebar.classList.remove("mobile-open");
  chatPanel.classList.add("mobile-open");
  mobileBackdrop.hidden = false;
});
mobileBackdrop?.addEventListener("click", closeMobilePanels);
sidebar.addEventListener("click", (e) => {
  if (e.target.closest(".nav-item")) closeMobilePanels();
});
window.addEventListener("resize", () => {
  if (innerWidth > 850) chatPanel.classList.remove("mobile-open");
  if (innerWidth > 620) sidebar.classList.remove("mobile-open");
  if (
    !sidebar.classList.contains("mobile-open") &&
    !chatPanel.classList.contains("mobile-open")
  )
    mobileBackdrop.hidden = true;
});
document
  .querySelector(".add-project")
  ?.addEventListener("click", () =>
    document.querySelector(".create-project")?.click()
  );

// Finish the sidebar destinations with real guide and account settings views.
document.querySelector(".guide-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  guideDialog.showModal();
});
const settingsDialog = document.createElement("dialog");
settingsDialog.id = "settingsDialog";
settingsDialog.innerHTML =
  '<section class="settings-panel"><div class="dialog-head"><div><span class="eyebrow">ACCOUNT</span><h2>Settings</h2></div><button type="button" class="dialog-close" id="settingsClose" aria-label="Close">×</button></div><div class="settings-details"><div><small>Signed in as</small><b id="settingsName"></b><span id="settingsEmail"></span></div><div><small>Workspace</small><b id="settingsTeam"></b><span id="settingsRole"></span></div></div><div class="dialog-actions"><button type="button" class="cancel-button" id="settingsMembers">Team members</button><button type="button" class="primary-button" id="settingsSignOut">Sign out</button></div></section>';
document.body.appendChild(settingsDialog);
$("#settingsClose").addEventListener("click", () => settingsDialog.close());
$("#settingsMembers").addEventListener("click", () => {
  settingsDialog.close();
  openMembers();
});
$("#settingsSignOut").addEventListener("click", () => {
  settingsDialog.close();
  authButton.click();
});
document.querySelector(".settings-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!apiState.token) {
    showAuth();
    return;
  }
  $("#settingsName").textContent = $(".profile-copy b").textContent;
  $("#settingsEmail").textContent = $(".profile-copy small").textContent;
  $("#settingsTeam").textContent = $(".workspace-name b").textContent;
  $("#settingsRole").textContent = `Your role: ${apiState.role || "Member"}`;
  settingsDialog.showModal();
});

function confirmInApp(
  message,
  { title = "Please confirm", confirmLabel = "Continue", danger = false } = {}
) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    d.innerHTML =
      '<section class="confirm-panel"><div class="dialog-head"><div><span class="eyebrow">CONFIRMATION</span><h2 id="confirmTitle"></h2></div><button type="button" class="dialog-close" id="confirmClose" aria-label="Close">×</button></div><p id="confirmMessage" class="confirm-message"></p><div class="dialog-actions"><button type="button" class="cancel-button" id="confirmCancel">Cancel</button><button type="button" class="primary-button" id="confirmAccept"></button></div></section>';
    d.querySelector("#confirmTitle").textContent = title;
    d.querySelector("#confirmMessage").textContent = message;
    const accept = d.querySelector("#confirmAccept");
    accept.textContent = confirmLabel;
    if (danger) accept.classList.add("danger-button");
    document.body.appendChild(d);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      d.close();
      d.remove();
      resolve(value);
    };
    d.querySelector("#confirmClose").addEventListener("click", () =>
      finish(false)
    );
    d.querySelector("#confirmCancel").addEventListener("click", () =>
      finish(false)
    );
    accept.addEventListener("click", () => finish(true));
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    });
    d.showModal();
    d.querySelector("#confirmCancel").focus();
  });
}
document
  .querySelector(".workspace-switch")
  ?.addEventListener("click", async () => {
    if (!apiState.token) {
      showAuth();
      return;
    }
    try {
      const teams = await api("/api/teams");
      if (teams.length < 2) {
        notify(
          teams.length
            ? "This account has one team workspace"
            : "No team workspace is available"
        );
        return;
      }
      const selected = await chooseTeamDialog(teams);
      if (!selected || String(selected._id) === String(apiState.teamId)) return;
      const url = new URL(location.href);
      url.searchParams.set("team", selected._id);
      url.searchParams.delete("project");
      location.assign(url.toString());
    } catch (err) {
      notify(err.message);
    }
  });
$(".board-search")?.addEventListener("click", () =>
  $(".search-button")?.click()
);
$(".sort-button")?.addEventListener(
  "click",
  (e) => {
    e.stopImmediatePropagation();
    showActionMenu(e.currentTarget, [
      {
        label: "Sort by due date",
        action: () => {
          tasks.sort((a, b) =>
            String(a.dueISO || "9999-12-31").localeCompare(
              String(b.dueISO || "9999-12-31")
            )
          );
          render();
        },
      },
      {
        label: "Sort by task name",
        action: () => {
          tasks.sort((a, b) => a.title.localeCompare(b.title));
          render();
        },
      },
      {
        label: "Sort by status",
        action: () => {
          const order = { todo: 0, progress: 1, completed: 2 };
          tasks.sort((a, b) => order[a.status] - order[b.status]);
          render();
        },
      },
    ]);
  },
  true
);
document.querySelector(".chat-channel-menu")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "Team members", action: openMembers },
    { label: "Invite teammates", action: inviteTeammate },
  ])
);
function insertChatEmoji(emoji) {
  const start = input.selectionStart ?? input.value.length,
    end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  input.focus();
  input.setSelectionRange(start + emoji.length, start + emoji.length);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
document.querySelector(".emoji-button")?.addEventListener("click", (e) =>
  showActionMenu(e.currentTarget, [
    { label: "😀 Smile", action: () => insertChatEmoji("😀") },
    { label: "👍 Like", action: () => insertChatEmoji("👍") },
    { label: "🎉 Celebrate", action: () => insertChatEmoji("🎉") },
    { label: "❤️ Love", action: () => insertChatEmoji("❤️") },
    { label: "🙏 Thanks", action: () => insertChatEmoji("🙏") },
  ])
);
