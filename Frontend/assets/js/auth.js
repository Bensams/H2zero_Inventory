document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const logoutButtons = document.querySelectorAll(".logout-btn");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });
});

async function handleLogin(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const roleInput = document.getElementById("role");
  const messageBox = document.getElementById("loginMessage");

  const username = usernameInput ? usernameInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";
  const role = roleInput ? roleInput.value.trim().toLowerCase() : "";

  if (messageBox) {
    messageBox.textContent = "";
  }

  console.log("LOGIN PAYLOAD:", { username, password, role });

  if (!username || !password || !role) {
    if (messageBox) {
      messageBox.textContent = "All login fields are required.";
      messageBox.style.color = "#ff8080";
    }
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.login, {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        role
      })
    });

    if (!result.success) {
      if (messageBox) {
        messageBox.textContent = result.message || "Login failed.";
        messageBox.style.color = "#ff8080";
      }
      return;
    }

    const user = result.data.user;

    if (user.role === "admin") {
      window.location.href = "../admin/dashboard.html";
    } else {
      window.location.href = "../staff/inventory.html";
    }
  } catch (error) {
    console.error("Login error:", error);
    if (messageBox) {
      messageBox.textContent = "Login failed. Check browser console.";
      messageBox.style.color = "#ff8080";
    }
  }
}

async function handleLogout() {
  try {
    await apiRequest(API_ENDPOINTS.logout, {
      method: "POST"
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.href = "../pages/index.html";
}

async function getCurrentUser() {
  try {
    const result = await apiRequest(API_ENDPOINTS.me, {
      method: "GET"
    });

    if (!result.success) return null;
    return result.data;
  } catch (error) {
    console.error("getCurrentUser error:", error);
    return null;
  }
}

async function requireLogin() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "../pages/index.html";
    return null;
  }

  return user;
}

async function requireAdminPage() {
  const user = await requireLogin();
  if (!user) return null;

  if (user.role !== "admin") {
    window.location.href = "../staff/inventory.html";
    return null;
  }

  return user;
}

async function requireStaffPage() {
  const user = await requireLogin();
  if (!user) return null;

  if (user.role !== "staff") {
    window.location.href = "../admin/dashboard.html";
    return null;
  }

  return user;
}

function setUserLabels(user) {
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  const userPill = document.getElementById("userPill");
  const userRoleText = document.getElementById("userRoleText");

  if (userPill) userPill.textContent = roleLabel;
  if (userRoleText) userRoleText.textContent = roleLabel;
}