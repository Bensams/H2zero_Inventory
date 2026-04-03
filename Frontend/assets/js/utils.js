function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
}