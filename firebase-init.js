// theme-toggle.js

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("#theme-toggle");
  const rootElement = document.documentElement;
  const storageKey = "user-theme";

  // Apply saved theme or default to light
  const savedTheme = localStorage.getItem(storageKey);
  if (savedTheme) {
    rootElement.setAttribute("data-theme", savedTheme);
    toggle.checked = savedTheme === "dark";
  } else {
    rootElement.setAttribute("data-theme", "light");
    toggle.checked = false;
  }

  // Listen for toggle changes
  toggle.addEventListener("change", () => {
    const newTheme = toggle.checked ? "dark" : "light";
    rootElement.setAttribute("data-theme", newTheme);
    localStorage.setItem(storageKey, newTheme);
  });
});
