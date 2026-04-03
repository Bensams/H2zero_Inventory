// ====== Inventory Matrix (Figma style) ======

// LocalStorage key
const INV_KEY = "h2zero_inventory_matrix";

// Sizes/columns
const SIZES = [350, 500, 1000, 1500, 4000, 6000];

const matrixBody = document.getElementById("matrixBody");
const btnSave = document.getElementById("btnSave");
const saveMsg = document.getElementById("saveMsg");
const logoutTop = document.getElementById("logoutBtnTop");

// Load auth (same as dashboard)
const authRaw = localStorage.getItem("h2zero_auth");
const auth = authRaw ? JSON.parse(authRaw) : null;
if (!auth?.token) window.location.href = "index.html";

// default brands (you can add more)
function defaultInventory() {
  return [
    { brand: "H2zero", sizes: sizeMap(0) },
    { brand: "Coolers", sizes: sizeMap(0) },
  ];
}

function sizeMap(value) {
  const obj = {};
  SIZES.forEach(s => obj[s] = value);
  return obj;
}

function loadInventory() {
  const raw = localStorage.getItem(INV_KEY);
  if (!raw) return defaultInventory();
  try { return JSON.parse(raw); } catch { return defaultInventory(); }
}

function saveInventory(data) {
  localStorage.setItem(INV_KEY, JSON.stringify(data));
}

function renderMatrix(data) {
  matrixBody.innerHTML = "";

  data.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    // brand cell
    const tdBrand = document.createElement("td");
    tdBrand.textContent = row.brand;
    tr.appendChild(tdBrand);

    // size cells with inputs
    SIZES.forEach((size) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "qty-input";
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = row.sizes?.[size] ?? 0;

      // store where this input belongs
      input.dataset.row = String(rowIndex);
      input.dataset.size = String(size);

      td.appendChild(input);
      tr.appendChild(td);
    });

    matrixBody.appendChild(tr);
  });
}

function readMatrixFromInputs(currentData) {
  // clone
  const data = JSON.parse(JSON.stringify(currentData));

  const inputs = matrixBody.querySelectorAll("input.qty-input");
  inputs.forEach((inp) => {
    const row = Number(inp.dataset.row);
    const size = Number(inp.dataset.size);
    const val = Number(inp.value || 0);

    if (!Number.isFinite(val) || val < 0) return;
    data[row].sizes[size] = Math.floor(val);
  });

  return data;
}

// Toast helper (from app.js if you have it)
function toastLocal(title, body, type="") {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="t-title">${title}</div><div class="t-body">${body || ""}</div>`;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// INIT
let inventory = loadInventory();
renderMatrix(inventory);

btnSave.addEventListener("click", () => {
  inventory = readMatrixFromInputs(inventory);
  saveInventory(inventory);
  saveMsg.textContent = "Saved ✅ Dashboard will update from this.";
  toastLocal("Saved", "Inventory matrix saved.", "ok");
});

// top logout button
logoutTop?.addEventListener("click", () => {
  localStorage.removeItem("h2zero_auth");
  window.location.href = "index.html";
});