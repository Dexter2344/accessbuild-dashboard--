// ============================================
// AccessBuild — Frontend Logic
// ============================================

const API_BASE = "https://accessbuild-api.onrender.com";

// ---------- Utilities ----------
function el(id) {
  return document.getElementById(id);
}

function showError(message) {
  const box = el("error-box");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError() {
  const box = el("error-box");
  if (box) box.classList.add("hidden");
}

function gradeColor(grade) {
  const map = {
    A: "#16a34a",
    B: "#65a30d",
    C: "#ca8a04",
    D: "#ea580c",
    F: "#dc2626",
  };
  return map[grade] || "#6b7280";
}

// ---------- Homepage: Stats + Recent ----------
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    el("total-audits").textContent = data.total_audits ?? 0;
    el("avg-accessibility").textContent =
      (data.average_accessibility ?? 0) + "%";

    // Grade distribution
    const dist = data.grade_distribution || {};
    const distEl = el("grade-distribution");
    const grades = Object.keys(dist).sort();
    if (grades.length === 0) {
      distEl.textContent = "—";
    } else {
      distEl.innerHTML = grades
        .map(
          (g) =>
            `<span class="grade-chip" style="background:${gradeColor(g)}">${g}: ${dist[g]}</span>`
        )
        .join("");
    }
  } catch (err) {
    console.error("Stats error:", err);
    showError("Could not load stats: " + err.message);
  }
}

async function loadRecentAudits() {
  const container = el("recent-audits");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/audits/recent?limit=10`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const audits = data.audits || [];
    if (audits.length === 0) {
      container.innerHTML = `<p class="empty">No audits yet. Run one to get started.</p>`;
      return;
    }

    container.innerHTML = audits
      .map((a) => {
        const grade = a.grade || "?";
        const color = gradeColor(grade);
        return `
          <div class="audit-row">
            <div class="audit-grade" style="background:${color}">${grade}</div>
            <div class="audit-info">
              <div class="audit-app">${escapeHtml(a.app_name || "Unknown")}</div>
              <div class="audit-meta">
                ${escapeHtml(a.screen_name || "—")} · ${a.accessibility_percentage ?? "—"}%
              </div>
            </div>
            <div class="audit-score">${a.score ?? "—"}</div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Recent audits error:", err);
    container.innerHTML = `<p class="empty">Could not load audits.</p>`;
  }
}

async function checkApiStatus() {
  const badge = el("api-status");
  if (!badge) return;
  try {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error();
    badge.innerHTML = `<span class="dot online"></span> API Live`;
  } catch {
    badge.innerHTML = `<span class="dot offline"></span> API Offline`;
  }
}

// ---------- Audit Page: Form Submit ----------
function setupAuditForm() {
  const form = el("audit-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const appName = el("app-name").value.trim();
    const packageName = el("package-name").value.trim();
    const screenName = el("screen-name").value.trim() || "Main Screen";
    const uiTree = el("ui-tree").value.trim();

    if (!appName) {
      showError("App name is required.");
      return;
    }

    const btn = el("submit-btn");
    btn.disabled = true;
    btn.textContent = "Running audit...";

    try {
      let endpoint, payload;

      if (uiTree) {
        // Use /scan if UI tree XML provided
        endpoint = `${API_BASE}/scan`;
        payload = {
          app_name: appName,
          package_name: packageName,
          screen_name: screenName,
          ui_tree_xml: uiTree,
        };
      } else {
        // Otherwise, send a manual audit with empty elements
        // (will score poorly — user should provide XML for real results)
        endpoint = `${API_BASE}/audit`;
        payload = {
          app_name: appName,
          package_name: packageName,
          screen_name: screenName,
          elements: [],
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const result = await res.json();
      renderResult(result);
    } catch (err) {
      console.error("Audit error:", err);
      showError("Audit failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Run Audit →";
    }
  });
}

function renderResult(r) {
  const section = el("result-section");
  section.classList.remove("hidden");

  const grade = r.grade || "?";
  const circle = el("result-grade");
  circle.textContent = grade;
  circle.style.background = gradeColor(grade);

  el("result-app").textContent = r.app_name || "—";
  el("result-screen").textContent = r.screen_name || "—";
  el("result-score").textContent = r.score ?? "—";
  el("result-total").textContent = r.total_elements ?? "—";
  el("result-labeled").textContent = r.labeled_elements ?? "—";
  el("result-unlabeled").textContent = r.unlabeled_elements ?? "—";
  el("result-recommendation").textContent = r.recommendation || "—";

  section.scrollIntoView({ behavior: "smooth" });
}

// ---------- Escape HTML ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  // Homepage
  if (el("total-audits")) {
    checkApiStatus();
    loadStats();
    loadRecentAudits();
  }

  // Audit page
  if (el("audit-form")) {
    setupAuditForm();
  }
});