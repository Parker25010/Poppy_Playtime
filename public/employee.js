const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#personnel-dashboard");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const loginSubmitLabel = document.querySelector("#login-submit-label");
const loginSubmit = loginForm.querySelector("[type=submit]");

function setLoginMessage(message) {
  loginError.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function renderBriefing(briefing) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.querySelector("#dashboard-employee").textContent = briefing.employee;
  document.querySelector("#dashboard-clearance").textContent = briefing.clearance;
  document.querySelector("#bulletin-label").textContent = briefing.bulletin.label;
  document.querySelector("#bulletin-title").textContent = briefing.bulletin.title;
  document.querySelector("#bulletin-text").textContent = briefing.bulletin.text;
  document.querySelector("#records-count").textContent = `${String(briefing.files.length).padStart(2, "0")} OPEN FILES`;
  document.querySelector("#records-list").innerHTML = briefing.files.map((file, index) => `
    <details class="record-row">
      <summary>
        <span class="record-index">0${index + 1}</span>
        <span class="record-main"><span class="record-code">${escapeHtml(file.code)}</span><strong>${escapeHtml(file.title)}</strong><span class="record-summary">${escapeHtml(file.summary)}</span></span>
        <span class="record-status">${escapeHtml(file.status)}</span>
        <span class="record-toggle" aria-hidden="true">+</span>
      </summary>
      <p class="record-detail">${escapeHtml(file.detail)}</p>
    </details>
  `).join("");
}

async function loadBriefing() {
  const response = await fetch("/api/employee/briefing", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Employee briefing could not be loaded.");
  renderBriefing(await response.json());
}

async function restoreSession() {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin" });
    const session = await response.json();
    if (session.authenticated) await loadBriefing();
    else {
      dashboard.hidden = true;
      loginPanel.hidden = false;
    }
  } catch {
    setLoginMessage("Personnel services are offline. Please try again shortly.");
  }
}

document.querySelector("#fill-demo").addEventListener("click", () => {
  document.querySelector("#employee-id").value = "employee";
  document.querySelector("#employee-password").value = "factory1984";
  document.querySelector("#employee-password").focus();
  setLoginMessage("Local demo credentials filled. Sign in to continue.");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginMessage("");
  loginSubmit.disabled = true;
  loginSubmitLabel.textContent = "Checking badge...";
  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        employeeId: formData.get("employeeId"),
        password: formData.get("password"),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Access denied.");
    await loadBriefing();
  } catch (error) {
    setLoginMessage(error.message || "Personnel services are offline. Please try again.");
  } finally {
    loginSubmit.disabled = false;
    loginSubmitLabel.textContent = "Verify credentials";
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  setLoginMessage("You have signed out of personnel services.");
});

restoreSession();