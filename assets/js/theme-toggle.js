const toggleCheckbox = document.getElementById("theme-toggle-checkbox");
const htmlElement = document.documentElement; // <html> element
const THEME_KEY = "theme";

// Initialize theme based on localStorage
if (localStorage.getItem(THEME_KEY) === "dark") {
  htmlElement.setAttribute("data-theme", "dark");
  toggleCheckbox.checked = true;
} else {
  htmlElement.removeAttribute("data-theme");
  toggleCheckbox.checked = false;
}

// Update aria-checked for accessibility
function updateAriaChecked(isChecked) {
  toggleCheckbox.setAttribute("aria-checked", isChecked ? "true" : "false");
}

// Initial aria update
updateAriaChecked(toggleCheckbox.checked);

// Listen for toggle changes
toggleCheckbox.addEventListener("change", (e) => {
  if (e.target.checked) {
    htmlElement.setAttribute("data-theme", "dark");
    localStorage.setItem(THEME_KEY, "dark");
    updateAriaChecked(true);
  } else {
    htmlElement.removeAttribute("data-theme");
    localStorage.setItem(THEME_KEY, "light");
    updateAriaChecked(false);
  }
});
