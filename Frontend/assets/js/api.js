async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Invalid JSON response:", text);
    throw new Error("Invalid JSON response");
  }
}