(() => {
  "use strict";

  const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const BLOCK_DURATION = 40;

  let groups = [];
  let days = [];
  let sorteoRunning = false;
  let assignments = [];

  const $ = (sel) => document.querySelector(sel);

  const els = {
    formGroup: $("#form-group"),
    inputGroup: $("#input-group"),
    groupsList: $("#groups-list"),
    groupsCount: $("#groups-count"),
    formDay: $("#form-day"),
    inputDay: $("#input-day"),
    inputStart: $("#input-start"),
    inputEnd: $("#input-end"),
    daysList: $("#days-list"),
    blocksCount: $("#blocks-count"),
    summaryText: $("#summary-text"),
    btnSorteo: $("#btn-sorteo"),
    btnReset: $("#btn-reset"),
    tombola: $("#tombola"),
    tombolaName: $("#tombola-name"),
    tombolaStatus: $("#tombola-status"),
    tombolaOrder: $("#tombola-order"),
    drumRing: document.querySelector(".tombola__drum-ring"),
    calendarSection: $("#calendar-section"),
    calendarHint: $("#calendar-hint"),
    calendar: $("#calendar"),
  };

  let dragSource = null;

  let idCounter = 0;
  const uid = () => `id-${++idCounter}`;

  function timeToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function generateBlocks(start, end) {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);

    if (endMin - startMin < BLOCK_DURATION) return null;

    const blocks = [];
    let cursor = startMin;

    while (cursor + BLOCK_DURATION <= endMin) {
      blocks.push({
        id: uid(),
        start: minutesToTime(cursor),
        end: minutesToTime(cursor + BLOCK_DURATION),
      });
      cursor += BLOCK_DURATION;
    }

    return blocks.length > 0 ? blocks : null;
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = WEEKDAYS[date.getDay()];
    const label = date.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    return { label, weekday, sortKey: dateStr };
  }

  function totalBlocks() {
    return days.reduce((sum, day) => sum + day.blocks.length, 0);
  }

  function allSlots() {
    const slots = [];
    const sortedDays = [...days].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    for (const day of sortedDays) {
      const sortedBlocks = [...day.blocks].sort((a, b) => a.start.localeCompare(b.start));
      for (const block of sortedBlocks) {
        slots.push({ dayId: day.id, blockId: block.id, day, block });
      }
    }
    return slots;
  }

  function updateSummary() {
    const g = groups.length;
    const b = totalBlocks();
    els.groupsCount.textContent = g;

    if (b === 0) {
      els.blocksCount.textContent = "0 bloques";
    } else if (b === 1) {
      els.blocksCount.textContent = "1 bloque";
    } else {
      els.blocksCount.textContent = `${b} bloques`;
    }

    if (g === 0 && b === 0) {
      els.summaryText.textContent = "Agrega grupos y bloques para comenzar";
      els.btnSorteo.disabled = true;
    } else if (g === 0) {
      els.summaryText.innerHTML = "Falta agregar al menos <strong>1 grupo</strong>";
      els.btnSorteo.disabled = true;
    } else if (b === 0) {
      els.summaryText.innerHTML = "Falta agregar al menos <strong>1 bloque</strong>";
      els.btnSorteo.disabled = true;
    } else if (g !== b) {
      els.summaryText.innerHTML =
        `Tienes <strong>${g} grupos</strong> y <strong>${b} bloques</strong>. Deben ser iguales para sortear.`;
      els.btnSorteo.disabled = true;
    } else {
      els.summaryText.innerHTML =
        `Listo: <strong>${g} grupos</strong> y <strong>${b} bloques</strong>. ¡Puedes sortear!`;
      els.btnSorteo.disabled = sorteoRunning;
    }
  }

  function renderGroups() {
    els.groupsList.innerHTML = "";
    if (groups.length === 0) {
      els.groupsList.innerHTML = '<li class="empty-msg">Sin grupos aún</li>';
      return;
    }
    for (const g of groups) {
      const li = document.createElement("li");
      li.className = "chip";
      li.innerHTML = `
        <span>${escapeHtml(g.name)}</span>
        <button class="chip__remove" data-id="${g.id}" title="Eliminar" aria-label="Eliminar grupo">×</button>
      `;
      els.groupsList.appendChild(li);
    }
    els.groupsList.querySelectorAll(".chip__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        groups = groups.filter((g) => g.id !== btn.dataset.id);
        renderGroups();
        updateSummary();
      });
    });
  }

  function renderDays() {
    els.daysList.innerHTML = "";
    if (days.length === 0) {
      els.daysList.innerHTML = '<p class="empty-msg">Sin días aún</p>';
      return;
    }

    const sorted = [...days].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    for (const day of sorted) {
      const card = document.createElement("div");
      card.className = "day-card";
      card.dataset.id = day.id;

      const sortedBlocks = [...day.blocks].sort((a, b) => a.start.localeCompare(b.start));

      const blocksHtml = sortedBlocks.length
        ? sortedBlocks
            .map(
              (b) => `
            <span class="block-tag" data-block-id="${b.id}">
              ${b.start} – ${b.end}
              <button class="block-tag__remove" data-day="${day.id}" data-block="${b.id}" title="Eliminar bloque">×</button>
            </span>`
            )
            .join("")
        : '<span class="empty-msg">Sin bloques</span>';

      const rangeLabel =
        sortedBlocks.length > 0
          ? `${sortedBlocks[0].start} – ${sortedBlocks[sortedBlocks.length - 1].end} · ${sortedBlocks.length} bloques`
          : "";

      card.innerHTML = `
        <div class="day-card__header">
          <div>
            <span class="day-card__title">${escapeHtml(day.label)}</span>
            <span class="day-card__weekday">${day.weekday}</span>
            ${rangeLabel ? `<div class="day-card__range">${rangeLabel}</div>` : ""}
          </div>
          <button class="btn btn--small btn--danger" data-remove-day="${day.id}">Eliminar día</button>
        </div>
        <div class="blocks-list">${blocksHtml}</div>
      `;

      els.daysList.appendChild(card);
    }

    els.daysList.querySelectorAll("[data-remove-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        days = days.filter((d) => d.id !== btn.dataset.removeDay);
        renderDays();
        updateSummary();
      });
    });

    els.daysList.querySelectorAll(".block-tag__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const day = days.find((d) => d.id === btn.dataset.day);
        if (day) {
          day.blocks = day.blocks.filter((b) => b.id !== btn.dataset.block);
          renderDays();
          updateSummary();
        }
      });
    });
  }

  function renderCalendar(pendingOnly = false, interactive = false) {
    els.calendar.innerHTML = "";
    const sortedDays = [...days].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    for (const day of sortedDays) {
      const calDay = document.createElement("div");
      calDay.className = "cal-day";
      calDay.dataset.dayId = day.id;

      const sortedBlocks = [...day.blocks].sort((a, b) => a.start.localeCompare(b.start));

      const blocksHtml = sortedBlocks
        .map((block) => {
          const assign = assignments.find(
            (a) => a.dayId === day.id && a.blockId === block.id
          );
          const occupied = !!assign;
          const classes = ["cal-block"];
          if (occupied) {
            classes.push("cal-block--occupied");
            if (interactive) classes.push("cal-block--draggable");
          } else {
            classes.push("cal-block--free");
          }

          const groupHtml = occupied
            ? `<span class="cal-block__group">${escapeHtml(assign.groupName)}</span>`
            : `<span class="cal-block__group cal-block__group--pending">Disponible</span>`;
          const orderHtml = occupied
            ? `<span class="cal-block__order">${assign.order}</span>`
            : "";
          const draggable = occupied && interactive ? 'draggable="true"' : "";

          return `
            <div class="${classes.join(" ")}" data-block-id="${block.id}" ${draggable}>
              <div>
                <div class="cal-block__time">${block.start} – ${block.end}</div>
                ${groupHtml}
              </div>
              ${orderHtml}
            </div>`;
        })
        .join("");

      calDay.innerHTML = `
        <div class="cal-day__header">
          <div class="cal-day__date">${escapeHtml(day.label)}</div>
          <div class="cal-day__weekday">${day.weekday}</div>
        </div>
        <div class="cal-day__blocks">${blocksHtml}</div>
      `;

      els.calendar.appendChild(calDay);
    }

    if (interactive) bindCalendarDragDrop();
  }

  function swapAssignments(srcDayId, srcBlockId, tgtDayId, tgtBlockId) {
    const src = assignments.find((a) => a.dayId === srcDayId && a.blockId === srcBlockId);
    const tgt = assignments.find((a) => a.dayId === tgtDayId && a.blockId === tgtBlockId);
    if (!src || !tgt) return;

    const tmpId = src.groupId;
    const tmpName = src.groupName;
    src.groupId = tgt.groupId;
    src.groupName = tgt.groupName;
    tgt.groupId = tmpId;
    tgt.groupName = tmpName;
  }

  function clearDragOverStyles() {
    els.calendar.querySelectorAll(".cal-block--drag-over").forEach((el) => {
      el.classList.remove("cal-block--drag-over");
    });
  }

  function bindCalendarDragDrop() {
    const blocks = els.calendar.querySelectorAll(".cal-block--draggable");

    blocks.forEach((block) => {
      block.addEventListener("dragstart", (e) => {
        const dayEl = block.closest("[data-day-id]");
        dragSource = {
          dayId: dayEl.dataset.dayId,
          blockId: block.dataset.blockId,
        };
        block.classList.add("cal-block--dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", dragSource.blockId);
      });

      block.addEventListener("dragend", () => {
        block.classList.remove("cal-block--dragging");
        clearDragOverStyles();
        dragSource = null;
      });

      block.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragSource) return;

        const dayEl = block.closest("[data-day-id]");
        const isSame =
          dragSource.dayId === dayEl.dataset.dayId &&
          dragSource.blockId === block.dataset.blockId;

        clearDragOverStyles();
        if (!isSame) block.classList.add("cal-block--drag-over");
      });

      block.addEventListener("dragleave", (e) => {
        if (!block.contains(e.relatedTarget)) {
          block.classList.remove("cal-block--drag-over");
        }
      });

      block.addEventListener("drop", (e) => {
        e.preventDefault();
        block.classList.remove("cal-block--drag-over");
        if (!dragSource) return;

        const dayEl = block.closest("[data-day-id]");
        const tgtDayId = dayEl.dataset.dayId;
        const tgtBlockId = block.dataset.blockId;

        if (dragSource.dayId === tgtDayId && dragSource.blockId === tgtBlockId) return;

        swapAssignments(dragSource.dayId, dragSource.blockId, tgtDayId, tgtBlockId);
        dragSource = null;
        renderCalendar(false, true);
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runTombolaDraw() {
    sorteoRunning = true;
    assignments = [];
    els.btnSorteo.disabled = true;
    els.btnReset.hidden = true;
    els.calendarSection.hidden = false;
    renderCalendar(true);

    const slots = allSlots();
    const shuffledGroups = shuffle(groups);

    els.tombola.hidden = false;
    els.tombolaOrder.innerHTML = "";
    els.drumRing.className = "tombola__drum-ring";
    els.tombolaStatus.textContent = "¡Girando la tómbola!";

    const drawOrder = [];

    for (let i = 0; i < shuffledGroups.length; i++) {
      const target = shuffledGroups[i];
      const pool = groups.filter((g) => !drawOrder.find((d) => d.id === g.id));

      els.tombolaStatus.textContent = `Sacando el grupo #${i + 1} de ${shuffledGroups.length}…`;

      await spinTombola(pool, target, i === shuffledGroups.length - 1);

      drawOrder.push(target);

      const chip = document.createElement("span");
      chip.className = "order-chip";
      chip.innerHTML = `<span class="order-num">${i + 1}°</span>${escapeHtml(target.name)}`;
      els.tombolaOrder.appendChild(chip);
    }

    els.tombolaStatus.textContent = "¡Orden definido! Asignando al calendario…";
    els.drumRing.classList.add("stop");
    await wait(800);

    els.tombola.hidden = true;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const group = drawOrder[i];

      assignments.push({
        dayId: slot.dayId,
        blockId: slot.blockId,
        groupId: group.id,
        groupName: group.name,
        order: i + 1,
      });

      const blockEl = document.querySelector(
        `[data-day-id="${slot.dayId}"] [data-block-id="${slot.blockId}"]`
      );
      if (blockEl) {
        blockEl.classList.remove("cal-block--free");
        blockEl.classList.add("cal-block--occupied");

        const groupEl = blockEl.querySelector(".cal-block__group");
        groupEl.textContent = group.name;
        groupEl.classList.remove("cal-block__group--pending");

        const orderSpan = document.createElement("span");
        orderSpan.className = "cal-block__order";
        orderSpan.textContent = i + 1;
        blockEl.appendChild(orderSpan);

        blockEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      await wait(700);
    }

    sorteoRunning = false;
    els.btnReset.hidden = false;
    els.calendarHint.hidden = false;
    renderCalendar(false, true);
    updateSummary();
  }

  async function spinTombola(pool, target, isLast) {
    const totalTicks = isLast ? 28 : 18 + Math.floor(Math.random() * 10);
    let delay = 40;

    for (let t = 0; t < totalTicks; t++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      els.tombolaName.textContent = pick.name;

      if (t > totalTicks * 0.6) {
        els.drumRing.classList.add("slow");
        delay += 12;
      }

      await wait(delay);
    }

    els.tombolaName.textContent = target.name;
    els.tombolaName.classList.remove("pop");
    void els.tombolaName.offsetWidth;
    els.tombolaName.classList.add("pop");

    await wait(450);
    els.drumRing.classList.remove("slow");
  }

  function resetSorteo() {
    assignments = [];
    dragSource = null;
    els.calendarSection.hidden = true;
    els.calendarHint.hidden = true;
    els.btnReset.hidden = true;
    updateSummary();
  }

  els.formGroup.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.inputGroup.value.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      showToast("Ese grupo ya existe");
      return;
    }
    groups.push({ id: uid(), name });
    els.inputGroup.value = "";
    renderGroups();
    updateSummary();
  });

  els.formDay.addEventListener("submit", (e) => {
    e.preventDefault();
    const dateStr = els.inputDay.value;
    const start = els.inputStart.value;
    const end = els.inputEnd.value;

    if (!dateStr || !start || !end) return;

    if (days.some((d) => d.sortKey === dateStr)) {
      showToast("Ese día ya fue agregado");
      return;
    }

    if (start >= end) {
      showToast("La hora de inicio debe ser anterior a la de fin");
      return;
    }

    const blocks = generateBlocks(start, end);
    if (!blocks) {
      showToast(`El horario debe tener al menos ${BLOCK_DURATION} minutos`);
      return;
    }

    const { label, weekday, sortKey } = formatDate(dateStr);
    days.push({ id: uid(), label, weekday, sortKey, blocks });
    els.inputDay.value = "";
    renderDays();
    updateSummary();
  });

  els.btnSorteo.addEventListener("click", () => {
    if (groups.length !== totalBlocks()) return;
    runTombolaDraw();
  });

  els.btnReset.addEventListener("click", resetSorteo);

  const today = new Date().toISOString().slice(0, 10);
  els.inputDay.min = today;

  renderGroups();
  renderDays();
  updateSummary();
})();
