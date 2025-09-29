const themeSwitch = document.getElementById("theme-switch");

function setDarkMode(isDark) {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

themeSwitch.addEventListener("change", () => {
  setDarkMode(themeSwitch.checked);
});

const savedTheme = localStorage.getItem('theme') === 'dark';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);