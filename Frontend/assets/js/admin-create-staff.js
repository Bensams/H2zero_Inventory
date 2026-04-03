let staffRows = [];
let filteredStaffRows = [];
let currentStaffPage = 0;
const staffRowsPerPage = 5;

let editingStaff = null;
let deletingStaffId = null;
let selectedStaffIdForPasswordReset = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdminPage();
  if (!user) return;

  setUserLabels(user);

  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  const form = document.getElementById("createStaffForm");
  if (form) form.addEventListener("submit", createStaffAccount);

  document.getElementById("prevStaffBtn")?.addEventListener("click", prevStaffPage);
  document.getElementById("nextStaffBtn")?.addEventListener("click", nextStaffPage);
  document.getElementById("staffSearch")?.addEventListener("input", applyStaffSearch);

  bindStaffModals();
  bindMessageModal();

  await loadStaffList();
});

function bindStaffModals() {
  document.getElementById("closeEditStaffModal")?.addEventListener("click", closeEditStaffModal);
  document.getElementById("cancelEditStaffModal")?.addEventListener("click", closeEditStaffModal);
  document.getElementById("saveEditStaffModal")?.addEventListener("click", saveEditedStaff);

  document.getElementById("closeDeleteStaffModal")?.addEventListener("click", closeDeleteStaffModal);
  document.getElementById("cancelDeleteStaffModal")?.addEventListener("click", closeDeleteStaffModal);
  document.getElementById("confirmDeleteStaffModal")?.addEventListener("click", confirmDeleteStaffModal);

  document.getElementById("closeResetPasswordModal")?.addEventListener("click", closeResetPasswordModal);
  document.getElementById("cancelResetPasswordModal")?.addEventListener("click", closeResetPasswordModal);
  document.getElementById("saveResetPasswordModal")?.addEventListener("click", saveResetPassword);
}

function bindMessageModal() {
  document.getElementById("closeMessageModal")?.addEventListener("click", closeMessageModal);
  document.getElementById("okMessageModal")?.addEventListener("click", closeMessageModal);
}

function showMessageModal(message, title = "Notice") {
  const modal = document.getElementById("messageModal");
  const titleEl = document.getElementById("messageModalTitle");
  const textEl = document.getElementById("messageModalText");

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = message;
  if (modal) modal.style.display = "flex";
}

function closeMessageModal() {
  const modal = document.getElementById("messageModal");
  if (modal) modal.style.display = "none";
}

function isValidGmail(value) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim());
}

async function createStaffAccount(event) {
  event.preventDefault();

  const full_name = document.getElementById("full_name").value.trim();
  const age = document.getElementById("age").value.trim();
  const gender = document.getElementById("gender").value.trim();
  const username = document.getElementById("staff_username").value.trim().toLowerCase();
  const password = document.getElementById("staff_password").value.trim();
  const messageBox = document.getElementById("createStaffMessage");

  if (messageBox) messageBox.textContent = "";

  if (!full_name || !username || !password) {
    if (messageBox) {
      messageBox.textContent = "Full name, Gmail, and password are required.";
      messageBox.style.color = "#ff8080";
    }
    return;
  }

  if (!isValidGmail(username)) {
    if (messageBox) {
      messageBox.textContent = "Please enter a valid Gmail address ending in @gmail.com.";
      messageBox.style.color = "#ff8080";
    }
    return;
  }

  if (password.length < 6) {
    if (messageBox) {
      messageBox.textContent = "Password must be at least 6 characters.";
      messageBox.style.color = "#ff8080";
    }
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.registerStaff, {
      method: "POST",
      body: JSON.stringify({
        full_name,
        age,
        gender,
        username,
        password,
        role: "staff"
      })
    });

    if (!result.success) {
      if (messageBox) {
        messageBox.textContent = result.message || "Failed to create staff.";
        messageBox.style.color = "#ff8080";
      }
      return;
    }

    if (messageBox) {
      messageBox.textContent = "Staff account created successfully.";
      messageBox.style.color = "#7CFC98";
    }

    document.getElementById("createStaffForm").reset();
    await loadStaffList();
  } catch (error) {
    console.error("createStaffAccount error:", error);
    if (messageBox) {
      messageBox.textContent = "Failed to create staff account.";
      messageBox.style.color = "#ff8080";
    }
  }
}

async function loadStaffList() {
  try {
    const result = await apiRequest(API_ENDPOINTS.staffList, { method: "GET" });

    if (!result.success || !Array.isArray(result.data)) {
      staffRows = [];
      filteredStaffRows = [];
      renderStaffTable();
      return;
    }

    staffRows = result.data;
    applyStaffSearch();
  } catch (error) {
    console.error("loadStaffList error:", error);
    staffRows = [];
    filteredStaffRows = [];
    renderStaffTable();
  }
}

function applyStaffSearch() {
  const query = (document.getElementById("staffSearch")?.value || "").trim().toLowerCase();

  if (!query) {
    filteredStaffRows = [...staffRows];
  } else {
    filteredStaffRows = staffRows.filter((staff) => {
      return (
        String(staff.full_name || "").toLowerCase().includes(query) ||
        String(staff.username || "").toLowerCase().includes(query) ||
        String(staff.gender || "").toLowerCase().includes(query) ||
        String(staff.age || "").toLowerCase().includes(query) ||
        String(staff.created_at || "").toLowerCase().includes(query)
      );
    });
  }

  currentStaffPage = 0;
  renderStaffTable();
}

function renderStaffTable() {
  const tbody = document.getElementById("staffTableBody");
  const label = document.getElementById("staffPageLabel");
  const prevBtn = document.getElementById("prevStaffBtn");
  const nextBtn = document.getElementById("nextStaffBtn");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!filteredStaffRows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#b8c5d9;">No registered staff found.</td>
      </tr>
    `;
    if (label) label.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const start = currentStaffPage * staffRowsPerPage;
  const end = start + staffRowsPerPage;
  const pageItems = filteredStaffRows.slice(start, end);

  pageItems.forEach((staff) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(staff.full_name ?? "-")}</td>
      <td>${escapeHtml(staff.username ?? "-")}</td>
      <td>${escapeHtml(staff.gender ?? "-")}</td>
      <td>${escapeHtml(staff.age ?? "-")}</td>
      <td>${escapeHtml(staff.created_at ?? "-")}</td>
      <td>
        <div class="table-actions">
          <button class="icon-btn icon-btn-edit btn-edit" type="button" title="Edit Staff" aria-label="Edit Staff">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
          </button>

          <button class="icon-btn icon-btn-reset btn-reset-password" type="button" title="Reset Password" aria-label="Reset Password">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 3-6.7"/>
              <path d="M3 3v6h6"/>
              <path d="M12 7v5l3 3"/>
            </svg>
          </button>

          <button class="icon-btn icon-btn-delete btn-delete" type="button" title="Delete Staff" aria-label="Delete Staff">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
              <path d="M3 6h18"/>
              <path d="M8 6V4h8v2"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-edit").addEventListener("click", () => openEditStaffModal(staff));
    tr.querySelector(".btn-reset-password").addEventListener("click", () => openResetPasswordModal(staff.id));
    tr.querySelector(".btn-delete").addEventListener("click", () => openDeleteStaffModal(staff.id, staff.full_name));

    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil(filteredStaffRows.length / staffRowsPerPage);
  if (label) label.textContent = `Page ${currentStaffPage + 1} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentStaffPage === 0;
  if (nextBtn) nextBtn.disabled = currentStaffPage >= totalPages - 1;
}

function openEditStaffModal(staff) {
  editingStaff = staff;

  document.getElementById("editStaffName").value = staff.full_name || "";
  document.getElementById("editStaffEmail").value = staff.username || "";
  document.getElementById("editStaffGender").value = staff.gender || "";
  document.getElementById("editStaffAge").value = staff.age || "";

  const modal = document.getElementById("editStaffModal");
  if (modal) modal.style.display = "flex";
}

function closeEditStaffModal() {
  const modal = document.getElementById("editStaffModal");
  if (modal) modal.style.display = "none";
  editingStaff = null;
}

async function saveEditedStaff() {
  if (!editingStaff) return;

  const full_name = document.getElementById("editStaffName").value.trim();
  const username = document.getElementById("editStaffEmail").value.trim().toLowerCase();
  const gender = document.getElementById("editStaffGender").value.trim();
  const age = document.getElementById("editStaffAge").value.trim();

  if (!full_name || !username) {
    showMessageModal("Full name and Gmail are required.");
    return;
  }

  if (!isValidGmail(username)) {
    showMessageModal("Please enter a valid Gmail address ending in @gmail.com.");
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.editStaff, {
      method: "PUT",
      body: JSON.stringify({
        id: editingStaff.id,
        full_name,
        username,
        gender,
        age
      })
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to update staff.");
      return;
    }

    closeEditStaffModal();
    await loadStaffList();
    showMessageModal("Staff updated successfully.", "Success");
  } catch (error) {
    console.error("saveEditedStaff error:", error);
    showMessageModal("Failed to update staff.");
  }
}

function openDeleteStaffModal(id, name) {
  deletingStaffId = id;
  const text = document.getElementById("deleteStaffText");
  const modal = document.getElementById("deleteStaffModal");

  if (text) text.textContent = `Delete staff account for "${name}"?`;
  if (modal) modal.style.display = "flex";
}

function closeDeleteStaffModal() {
  const modal = document.getElementById("deleteStaffModal");
  if (modal) modal.style.display = "none";
  deletingStaffId = null;
}

async function confirmDeleteStaffModal() {
  if (!deletingStaffId) return;

  try {
    const result = await apiRequest(API_ENDPOINTS.deleteStaff(deletingStaffId), {
      method: "DELETE"
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to delete staff.");
      return;
    }

    closeDeleteStaffModal();
    await loadStaffList();
    showMessageModal("Staff deleted successfully.", "Success");
  } catch (error) {
    console.error("confirmDeleteStaffModal error:", error);
    showMessageModal("Failed to delete staff.");
  }
}

function openResetPasswordModal(staffId) {
  selectedStaffIdForPasswordReset = staffId;
  const input = document.getElementById("resetPasswordInput");
  const modal = document.getElementById("resetPasswordModal");

  if (input) input.value = "";
  if (modal) modal.style.display = "flex";
}

function closeResetPasswordModal() {
  selectedStaffIdForPasswordReset = null;
  const modal = document.getElementById("resetPasswordModal");
  if (modal) modal.style.display = "none";
}

async function saveResetPassword() {
  const input = document.getElementById("resetPasswordInput");
  const new_password = (input?.value || "").trim();

  if (!selectedStaffIdForPasswordReset) return;

  if (!new_password) {
    showMessageModal("New password is required.");
    return;
  }

  if (new_password.length < 6) {
    showMessageModal("Password must be at least 6 characters.");
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.resetStaffPassword, {
      method: "PUT",
      body: JSON.stringify({
        id: selectedStaffIdForPasswordReset,
        new_password
      })
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to reset password.");
      return;
    }

    closeResetPasswordModal();
    showMessageModal("Staff password reset successfully.", "Success");
  } catch (error) {
    console.error("saveResetPassword error:", error);
    showMessageModal("Failed to reset password.");
  }
}

function nextStaffPage() {
  const totalPages = Math.ceil(filteredStaffRows.length / staffRowsPerPage);
  if (currentStaffPage < totalPages - 1) {
    currentStaffPage++;
    renderStaffTable();
  }
}

function prevStaffPage() {
  if (currentStaffPage > 0) {
    currentStaffPage--;
    renderStaffTable();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}