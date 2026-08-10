document.querySelectorAll(".routine").forEach((routine) => {
  routine.addEventListener("click", () => {
    routine.classList.toggle("done");
    const routines = [...document.querySelectorAll(".routine")];
    const completed = routines.filter((item) => item.classList.contains("done")).length;
    const total = routines.length;
    const percentage = Math.round((completed / total) * 100);
    const value = document.querySelector("[data-progress-value]");
    const percent = document.querySelector("[data-progress-percent]");
    const fill = document.querySelector("[data-progress-fill]");
    if (value) value.textContent = `${completed} / ${total} 완료`;
    if (percent) percent.textContent = `${percentage}%`;
    if (fill) fill.style.width = `${percentage}%`;
  });
});

document.querySelectorAll(".emoji-picker button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".emoji-picker button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
});
