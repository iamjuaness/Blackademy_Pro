// js/ui.js

export function initializeProfessionalUI() {
  const navigation = document.querySelector(".nav-tabs");
  const main = document.querySelector("main");

  if (!navigation || !main) return;
  if (navigation.dataset.professionalUi === "ready") return;

  navigation.dataset.professionalUi = "ready";

  const tabs = Array.from(
    navigation.querySelectorAll(".tab-btn[data-target]")
  );

  navigation.setAttribute("role", "tablist");
  navigation.setAttribute("aria-label", "Secciones de Blackademy Pro");

  for (const tab of tabs) {
    const panel = document.getElementById(tab.dataset.target);

    if (!panel) continue;

    tab.id ||= `nav-${tab.dataset.target}`;
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);

    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
  }

  function synchronizeTabs() {
    for (const tab of tabs) {
      const selected = tab.classList.contains("active");
      const panel = document.getElementById(tab.dataset.target);

      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;

      if (panel) {
        panel.hidden = !selected;
      }
    }
  }

  function revealTab(tab) {
    const tabBounds = tab.getBoundingClientRect();
    const navBounds = navigation.getBoundingClientRect();

    let offset = 0;

    if (tabBounds.left < navBounds.left) {
      offset = tabBounds.left - navBounds.left - 8;
    } else if (tabBounds.right > navBounds.right) {
      offset = tabBounds.right - navBounds.right + 8;
    }

    if (offset !== 0) {
      navigation.scrollBy({
        left: offset,
        behavior: "auto"
      });
    }
  }

  navigation.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab-btn[data-target]");

    if (!tab || !navigation.contains(tab)) return;

    // Los listeners del botón en app.js ya se ejecutaron
    // antes de que el evento llegue al contenedor.
    synchronizeTabs();
    revealTab(tab);
  });

  navigation.addEventListener("keydown", (event) => {
    const tab = event.target.closest(".tab-btn[data-target]");
    const index = tabs.indexOf(tab);

    if (index === -1) return;

    let nextIndex;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;

      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = tabs.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const nextTab = tabs[nextIndex];

    nextTab.focus({ preventScroll: true });
    nextTab.click();
  });

  function wrapStrategyTables() {
    for (const table of main.querySelectorAll(".strategy-table")) {
      if (table.parentElement?.classList.contains("table-scroll")) {
        continue;
      }

      const wrapper = document.createElement("div");

      wrapper.className = "table-scroll";
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute(
        "aria-label",
        "Tabla de estrategia; desplazamiento horizontal disponible"
      );

      table.before(wrapper);
      wrapper.appendChild(table);
    }
  }

  synchronizeTabs();
  wrapStrategyTables();

  const observer = new MutationObserver(() => {
    wrapStrategyTables();
  });

  observer.observe(main, {
    childList: true,
    subtree: true
  });
}