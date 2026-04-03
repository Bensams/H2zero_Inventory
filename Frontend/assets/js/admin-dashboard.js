let activityLogs = [];
let activityPage = 0;
const activityPerPage = 5;

let inventoryChartInstance = null;
let stocksChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdminPage();
  if (!user) return;

  setUserLabels(user);

  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  const dateInput = document.getElementById("dashboardDate");
  const dateText = document.getElementById("dashboardDateText");
  const calendarBtn = document.getElementById("dashboardCalendarBtn");

  if (dateInput) {
    dateInput.value = getTodayDate();
    updateDateText(dateInput.value, dateText);

    if (calendarBtn) {
      calendarBtn.addEventListener("click", () => {
        if (typeof dateInput.showPicker === "function") {
          dateInput.showPicker();
        } else {
          dateInput.focus();
          dateInput.click();
        }
      });
    }

    dateInput.addEventListener("change", async () => {
      updateDateText(dateInput.value, dateText);
      await loadStatsAndChart();
      await loadActivityLogs();
    });
  }

  document.getElementById("prevActivityBtn")?.addEventListener("click", prevActivityPage);
  document.getElementById("nextActivityBtn")?.addEventListener("click", nextActivityPage);

  await loadStatsAndChart();
  await loadActivityLogs();
});

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLong(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function updateDateText(dateValue, targetElement) {
  if (!targetElement) return;
  targetElement.textContent = formatDateLong(dateValue);
}

function getSelectedDashboardDate() {
  const input = document.getElementById("dashboardDate");
  return input && input.value ? input.value : getTodayDate();
}

async function loadStatsAndChart() {
  try {
    const selectedDate = getSelectedDashboardDate();

    const statsRes = await apiRequest(
      `${API_ENDPOINTS.dashboardStats}&date=${encodeURIComponent(selectedDate)}`,
      { method: "GET" }
    );

    if (statsRes.success && statsRes.data) {
      document.getElementById("totalProducts").textContent = statsRes.data.total_products ?? 0;
      document.getElementById("totalQuantity").textContent = statsRes.data.total_quantity ?? 0;
      document.getElementById("totalML").textContent = Number(statsRes.data.total_ml ?? 0).toLocaleString();

      document.getElementById("stockTotalProducts").textContent = statsRes.data.stock_total_products ?? 0;
      document.getElementById("stockTotalQuantity").textContent = Number(statsRes.data.stock_total_quantity ?? 0).toLocaleString();
      document.getElementById("stockTotalML").textContent = Number(statsRes.data.stock_total_ml ?? 0).toLocaleString();

      renderStocksChart(statsRes.data.stocks_overview ?? []);
    } else {
      resetDashboardCards();
      renderStocksChart([]);
    }

    const inventoryRes = await apiRequest(
      `${API_ENDPOINTS.inventoryList}&date=${encodeURIComponent(selectedDate)}`,
      { method: "GET" }
    );

    if (!inventoryRes.success || !Array.isArray(inventoryRes.data) || inventoryRes.data.length === 0) {
      renderInventoryChart({});
      return;
    }

    const productQtyMap = {};

    inventoryRes.data.forEach((item) => {
      const name = item.item_name || "Unknown";
      const qty = parseInt(item.quantity, 10) || 0;

      if (!productQtyMap[name]) {
        productQtyMap[name] = 0;
      }
      productQtyMap[name] += qty;
    });

    renderInventoryChart(productQtyMap);
  } catch (error) {
    console.error("loadStatsAndChart error:", error);
    resetDashboardCards();
    renderInventoryChart({});
    renderStocksChart([]);
  }
}

function resetDashboardCards() {
  document.getElementById("totalProducts").textContent = "0";
  document.getElementById("totalQuantity").textContent = "0";
  document.getElementById("totalML").textContent = "0";
  document.getElementById("stockTotalProducts").textContent = "0";
  document.getElementById("stockTotalQuantity").textContent = "0";
  document.getElementById("stockTotalML").textContent = "0";
}

function renderInventoryChart(productQtyMap) {
  const canvas = document.getElementById("inventoryChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Object.keys(productQtyMap);
  const values = Object.values(productQtyMap);

  if (inventoryChartInstance) {
    inventoryChartInstance.destroy();
  }

  inventoryChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Quantity",
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#dfe7f5" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#dfe7f5" },
          grid: { color: "rgba(255,255,255,0.08)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#dfe7f5" },
          grid: { color: "rgba(255,255,255,0.08)" }
        }
      }
    }
  });
}

function renderStocksChart(items) {
  const canvas = document.getElementById("stocksChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = [];
  const values = [];

  (items || []).forEach((item) => {
    labels.push(item.product_name || "Unknown");
    values.push(Number(item.total_quantity || 0));
  });

  if (stocksChartInstance) {
    stocksChartInstance.destroy();
  }

  stocksChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Stocks",
        data: values,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#dfe7f5" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#dfe7f5" },
          grid: { color: "rgba(255,255,255,0.08)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#dfe7f5" },
          grid: { color: "rgba(255,255,255,0.08)" }
        }
      }
    }
  });
}

async function loadActivityLogs() {
  try {
    const selectedDate = getSelectedDashboardDate();
    const res = await apiRequest(
      `${API_ENDPOINTS.reportsActivity}&date=${encodeURIComponent(selectedDate)}`,
      { method: "GET" }
    );

    if (!res.success || !Array.isArray(res.data)) {
      activityLogs = [];
      renderActivityLogs();
      return;
    }

    activityLogs = res.data;
    activityPage = 0;
    renderActivityLogs();
  } catch (error) {
    console.error("loadActivityLogs error:", error);
    activityLogs = [];
    renderActivityLogs();
  }
}

function renderActivityLogs() {
  const tbody = document.getElementById("activityTable");
  const label = document.getElementById("activityPageLabel");
  const prevBtn = document.getElementById("prevActivityBtn");
  const nextBtn = document.getElementById("nextActivityBtn");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!activityLogs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center;color:#b8c5d9;">No activity logs found.</td>
      </tr>
    `;
    if (label) label.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const start = activityPage * activityPerPage;
  const items = activityLogs.slice(start, start + activityPerPage);

  items.forEach((log) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(log.full_name ?? "-")}</td>
      <td>${escapeHtml(log.description ?? "-")}</td>
      <td>${escapeHtml(log.created_at ?? "-")}</td>
    `;
    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil(activityLogs.length / activityPerPage);
  if (label) label.textContent = `Page ${activityPage + 1} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = activityPage === 0;
  if (nextBtn) nextBtn.disabled = activityPage >= totalPages - 1;
}

function nextActivityPage() {
  const totalPages = Math.ceil(activityLogs.length / activityPerPage);
  if (activityPage < totalPages - 1) {
    activityPage++;
    renderActivityLogs();
  }
}

function prevActivityPage() {
  if (activityPage > 0) {
    activityPage--;
    renderActivityLogs();
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