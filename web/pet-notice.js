"use strict";
(() => {
  const labels = {reaction:"", status:"工作进度", reminder:"提醒", success:"任务完成", attention:"待处理", error:"异常"};
  function attach(card, announcement, send = () => {}) {
    const label = card.querySelector(".notice-kind");
    const title = card.querySelector(".notice-title");
    const detail = card.querySelector(".notice-detail");
    const open = card.querySelector(".notice-open");
    let timer = 0, expiry = 0, priorityUntil = 0, signature = "";
    let actionId = "", opening = false, rectangle = "";

    function reportRect() {
      if (!actionId || card.classList.contains("hidden")) return;
      const {left,top,width,height} = card.getBoundingClientRect();
      const rect = width > 0 && height > 0 ? [left,top,width,height].map(Math.round) : null;
      const next = JSON.stringify(rect);
      if (next === rectangle) return;
      rectangle = next;
      send({t:"workbench-notice-rect",id:actionId,rect});
    }

    function clearAction() {
      if (actionId) send({t:"workbench-notice-rect",id:actionId,rect:null});
      actionId = rectangle = "";
      opening = false;
      if (open) open.hidden = true;
      delete card.dataset.action;
      card.setAttribute("aria-hidden","true");
    }

    function clear() {
      clearTimeout(timer);
      card.classList.add("hidden");
      clearAction();
      announcement.textContent = "";
      expiry = priorityUntil = 0;
      signature = "";
    }

    function position(headTop) {
      const above = Number.isFinite(headTop) && headTop >= 36;
      const height = above ? Math.floor(headTop - 15) : 28;
      card.dataset.placement = above ? "above" : "top";
      card.dataset.density = height < 65 || window.innerWidth < 185 ? "compact" : "full";
      card.style.setProperty("--notice-bottom", above ? `${Math.round(window.innerHeight - headTop + 8)}px` : "auto");
      card.style.setProperty("--notice-height", `${Math.min(100, height)}px`);
      reportRect();
    }

    function show(options) {
      const now = performance.now();
      if (document.hidden || (!options.reminder && now < priorityUntil)) return;
      const kind = Object.hasOwn(labels, options.kind) ? options.kind : options.reminder ? "reminder" : "reaction";
      const lines = String(options.text ?? "").slice(0, 500).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (!lines.length) return;
      const nextLabel = options.label || labels[kind];
      const nextDetail = lines.slice(1).join(" · ");
      const target = open && typeof options.actionId==="string" && /^[a-f0-9]{32}$/.test(options.actionId) ? options.actionId : "";
      const key = JSON.stringify([kind, nextLabel, lines, target]);
      if (key === signature && now < expiry) return;
      const duration = Math.min(15000, Math.max(1000, Number(options.duration) || 2200));
      signature = key;
      expiry = now + duration;
      if (options.reminder) priorityUntil = expiry;
      card.dataset.kind = kind;
      label.textContent = nextLabel;
      label.hidden = !nextLabel || nextLabel === lines[0];
      title.textContent = lines[0];
      detail.textContent = nextDetail;
      detail.hidden = !nextDetail;
      clearAction();
      if (target) {
        actionId = target;
        card.dataset.action = "";
        card.removeAttribute("aria-hidden");
        open.hidden = false;
        open.textContent = "↗";
        open.setAttribute("aria-label","打开对应任务");
        open.title = "打开对应任务";
        open.removeAttribute("aria-busy");
      }
      announcement.textContent = [label.hidden ? "" : nextLabel, ...lines].filter(Boolean).join("。");
      card.classList.remove("hidden");
      reportRect();
      clearTimeout(timer);
      timer = setTimeout(clear, duration);
    }

    open?.addEventListener("click", event => {
      event.stopPropagation();
      if (!actionId || opening) return;
      opening = true;
      clearTimeout(timer);
      expiry = priorityUntil = performance.now() + 15000;
      timer = setTimeout(clear, 15000);
      open.setAttribute("aria-busy","true");
      open.textContent = "…";
      send({t:"workbench-notice-open",id:actionId});
    });
    function actionResult(result) {
      if (!actionId || result.id!==actionId) return;
      if (result.ok) { clear(); return; }
      opening = false;
      open.removeAttribute("aria-busy");
      open.textContent = "↗";
      open.setAttribute("aria-label","打开未确认，点此重试");
      open.title = "打开未确认，点此重试";
      announcement.textContent = "工作站打开未确认，可以重试。";
    }
    card.addEventListener("animationend",reportRect);
    window.addEventListener("resize",reportRect);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); });
    window.addEventListener("pagehide", clear);
    position(null);
    return {show, position, clear, actionResult};
  }
  window.PetNotice = {attach};
})();
