async function loadHTML(el, file) {
  const res = await fetch(file);
  el.innerHTML = await res.text();
}

function toast(title, body, type = "") {
  const host = document.getElementById("toastHost");
  if (!host) return;

  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `
    <div class="t-title">${title}</div>
    <div class="t-body">${body || ""}</div>
  `;
  host.appendChild(t);

  setTimeout(() => t.remove(), 3200);
}

async function getSessionUser() {
  try {
    const res = await fetch("http://localhost/inventory-system/index.php?route=auth&action=me", {
      method: "GET",
      credentials: "include"
    });

    const data = await res.json();

    if (!data.success) return null;
    return data.data;
  } catch (error) {
    console.error("getSessionUser error:", error);
    return null;
  }
}

function setActiveNav() {
  const page = location.pathname.split("/").pop();

  const dashboardLink = document.getElementById("nav-dashboard");
  const inventoryLink = document.getElementById("nav-inventory");
  const reportsLink = document.getElementById("nav-reports");
  const createStaffLink = document.getElementById("nav-create-staff");

  if (dashboardLink) dashboardLink.classList.remove("active");
  if (inventoryLink) inventoryLink.classList.remove("active");
  if (reportsLink) reportsLink.classList.remove("active");
  if (createStaffLink) createStaffLink.classList.remove("active");

  if (page === "dashboard.html" && dashboardLink) dashboardLink.classList.add("active");
  if (page === "inventory.html" && inventoryLink) inventoryLink.classList.add("active");
  if (page === "reports.html" && reportsLink) reportsLink.classList.add("active");
  if (page === "create-staff.html" && createStaffLink) createStaffLink.classList.add("active");

  const crumbs = document.getElementById("crumbs");
  if (crumbs) {
    if (page === "dashboard.html") crumbs.textContent = "H2Zero IMS / Dashboard";
    else if (page === "inventory.html") crumbs.textContent = "H2Zero IMS / Inventory";
    else if (page === "reports.html") crumbs.textContent = "H2Zero IMS / Reports";
    else if (page === "create-staff.html") crumbs.textContent = "H2Zero IMS / Create Staff";
    else crumbs.textContent = "H2Zero IMS";
  }
}

async function applyRoleAccess(user) {
  const dashboardLink = document.getElementById("nav-dashboard");
  const reportsLink = document.getElementById("nav-reports");
  const createStaffLink = document.getElementById("nav-create-staff");

  if (user.role === "staff") {
    if (dashboardLink) dashboardLink.style.display = "none";
    if (reportsLink) reportsLink.style.display = "none";
    if (createStaffLink) createStaffLink.style.display = "none";

    const page = location.pathname.split("/").pop();
    if (page === "dashboard.html" || page === "reports.html" || page === "create-staff.html") {
      alert("Access denied. Staff can only access Inventory.");
      window.location.href = "inventory.html";
    }
  }
}

(async function initLayout() {
  const isAppPage = !!document.getElementById("sidebar");
  if (!isAppPage) return;

  const user = await getSessionUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await loadHTML(document.getElementById("sidebar"), "../components/sidebar.html");
  await loadHTML(document.getElementById("topbar"), "../components/topbar.html");

  const pill = document.getElementById("userPill");
  if (pill) {
    pill.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  }

  const userRoleText = document.getElementById("userRoleText");
  if (userRoleText) {
    userRoleText.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  }

  setActiveNav();
  await applyRoleAccess(user);

  const logoutButtons = document.querySelectorAll(".logout-btn");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch("http://localhost/inventory-system/index.php?route=auth&action=logout", {
        method: "POST",
        credentials: "include"
      });

      window.location.href = "index.html";
    });
  });
})();