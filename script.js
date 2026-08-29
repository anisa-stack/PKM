/* =========================================================
   PKM — Program Kreatifitas Mahasiswa
   Logika aplikasi. Database: localStorage (client-side saja).
   ========================================================= */

(function () {
  "use strict";

  /* ============================================================
     0. STORE — wrapper localStorage
  ============================================================ */
  const LS_KEY = "pkm_app_data_v1";

  function defaultData() {
    return {
      anggota: [],        // {id, nama, nim, telp}
      projects: [],        // {id, namaMitra, kendala, solusi, kesulitan, linkPendukung, catatan, progress:{}}
      tasks: [],            // {id, nama, assigneeId}
      dokumentasi: [],       // {id, caption, file:{name,type,dataUrl}, createdAt}
      trash: [],             // {id, type, data, deletedAt}
      activeProjectId: null
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      const merged = Object.assign(defaultData(), parsed);
      // backward-compat: pastikan field baru ada di data lama
      merged.projects.forEach(p => {
        if (p.linkPendukung === undefined) p.linkPendukung = "";
        if (p.catatan === undefined) p.catatan = "";
      });
      if (!Array.isArray(merged.dokumentasi)) merged.dokumentasi = [];
      return merged;
    } catch (e) {
      console.error("Gagal membaca data lokal:", e);
      return defaultData();
    }
  }

  let DATA = loadData();

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(DATA));
    } catch (e) {
      console.error(e);
      toast("Gagal menyimpan data (penyimpanan lokal penuh). Coba hapus file yang tidak perlu.", "danger");
    }
    if (typeof renderDashboard === "function") renderDashboard();
  }

  /* ============================================================
     1. UTIL
  ============================================================ */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtDate(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function waLink(phone) {
    let p = (phone || "").replace(/[^\d+]/g, "");
    if (p.startsWith("0")) p = "62" + p.slice(1);
    p = p.replace(/^\+/, "");
    return "https://wa.me/" + p;
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function extFromName(name) {
    if (!name) return "";
    const parts = name.split(".");
    return parts.length > 1 ? "." + parts.pop() : "";
  }

  function slugify(str) {
    return (str || "berkas").toString().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "berkas";
  }

  function anggotaNama(id) {
    const a = DATA.anggota.find(x => x.id === id);
    return a ? a.nama : "(anggota terhapus)";
  }

  /* ============================================================
     2. TOAST
  ============================================================ */
  let toastTimer = null;
  function toast(message, type) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove("show"); }, 2600);
  }

  /* ============================================================
     3. MODAL
  ============================================================ */
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  function openModal(title, bodyHtml, onMount) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
    if (typeof onMount === "function") onMount(modalBody);
  }
  function closeModal() {
    modalOverlay.classList.remove("show");
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }
  modalCloseBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function confirmDialog(message, confirmLabel, onYes) {
    openModal("Konfirmasi", `
      <p style="font-size:14.5px;color:var(--ink-700);line-height:1.55;margin-bottom:4px;">${esc(message)}</p>
      <div class="form-actions">
        <button class="btn btn-ghost" id="cfNo">Batal</button>
        <button class="btn btn-outline-danger" id="cfYes">${esc(confirmLabel || "Hapus")}</button>
      </div>
    `, (root) => {
      root.querySelector("#cfNo").addEventListener("click", closeModal);
      root.querySelector("#cfYes").addEventListener("click", () => { closeModal(); onYes(); });
    });
  }

  /* ============================================================
     4. NAVIGATION
  ============================================================ */
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const sideNav = document.getElementById("sideNav");
  const navOverlay = document.getElementById("navOverlay");

  function goToTab(tabId) {
    navItems.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    tabPanels.forEach(p => p.classList.toggle("active", p.id === "tab-" + tabId));
    closeSideNav();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  navItems.forEach(btn => btn.addEventListener("click", () => goToTab(btn.dataset.tab)));

  function openSideNav() { sideNav.classList.add("open"); navOverlay.classList.add("show"); }
  function closeSideNav() { sideNav.classList.remove("open"); navOverlay.classList.remove("show"); }
  document.getElementById("hamburgerBtn").addEventListener("click", openSideNav);
  navOverlay.addEventListener("click", closeSideNav);

  /* ============================================================
     5. TRASH HELPERS
  ============================================================ */
  function sendToTrash(type, data) {
    DATA.trash.unshift({ id: uid(), type, data, deletedAt: Date.now() });
    save();
    renderTrash();
  }

  /* ============================================================
     6. TAB: ANGGOTA
  ============================================================ */
  const anggotaBody = document.getElementById("anggotaBody");
  const anggotaEmpty = document.getElementById("anggotaEmpty");

  function renderAnggota() {
    anggotaBody.innerHTML = "";
    anggotaEmpty.classList.toggle("show", DATA.anggota.length === 0);
    DATA.anggota.forEach((a, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esc(a.nama)}</td>
        <td>${esc(a.nim)}</td>
        <td><a class="wa-link" href="${waLink(a.telp)}" target="_blank" rel="noopener">
              <svg class="ic"><use href="#i-link"></use></svg>${esc(a.telp)}
            </a></td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" title="Edit" data-edit="${a.id}"><svg class="ic"><use href="#i-edit"></use></svg></button>
            <button class="btn-icon danger" title="Hapus" data-del="${a.id}"><svg class="ic"><use href="#i-trash"></use></svg></button>
          </div>
        </td>`;
      anggotaBody.appendChild(tr);
    });
    // re-render dependent views
    renderSpinWheel();
    renderTaskList();
    renderCertOptionsIfOpenElsewhere();
  }

  anggotaBody.addEventListener("click", (e) => {
    const editId = e.target.closest("[data-edit]")?.dataset.edit;
    const delId = e.target.closest("[data-del]")?.dataset.del;
    if (editId) openAnggotaModal(DATA.anggota.find(a => a.id === editId));
    if (delId) {
      const a = DATA.anggota.find(x => x.id === delId);
      confirmDialog(`Hapus anggota "${a.nama}"? Data akan dipindahkan ke Sampah.`, "Hapus", () => {
        DATA.anggota = DATA.anggota.filter(x => x.id !== delId);
        save();
        renderAnggota();
        sendToTrash("anggota", a);
        toast("Anggota dipindahkan ke Sampah.");
      });
    }
  });

  function openAnggotaModal(existing) {
    const isEdit = !!existing;
    openModal(isEdit ? "Edit Anggota" : "Tambah Anggota", `
      <form id="formAnggota">
        <div class="form-group">
          <label>Nama Lengkap</label>
          <input type="text" id="fNama" required value="${esc(existing?.nama || "")}" placeholder="mis. Siti Aminah">
        </div>
        <div class="form-group">
          <label>NIM</label>
          <input type="text" id="fNim" required value="${esc(existing?.nim || "")}" placeholder="mis. 2311xxxxxx">
        </div>
        <div class="form-group">
          <label>No. Telepon (WhatsApp)</label>
          <input type="tel" id="fTelp" required value="${esc(existing?.telp || "")}" placeholder="mis. 081234567890">
          <p class="hint">Nomor akan otomatis terhubung ke WhatsApp pada tabel.</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">${isEdit ? "Simpan Perubahan" : "Tambah Anggota"}</button>
        </div>
      </form>
    `, (root) => {
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#formAnggota").addEventListener("submit", (e) => {
        e.preventDefault();
        const nama = root.querySelector("#fNama").value.trim();
        const nim = root.querySelector("#fNim").value.trim();
        const telp = root.querySelector("#fTelp").value.trim();
        if (!nama || !nim || !telp) return;
        if (isEdit) {
          existing.nama = nama; existing.nim = nim; existing.telp = telp;
          toast("Data anggota diperbarui.", "success");
        } else {
          DATA.anggota.push({ id: uid(), nama, nim, telp });
          toast("Anggota ditambahkan.", "success");
        }
        save();
        renderAnggota();
        closeModal();
      });
    });
  }
  document.getElementById("btnTambahAnggota").addEventListener("click", () => openAnggotaModal(null));

  /* ============================================================
     7. TAB: RENCANA PROJECT
  ============================================================ */
  const rencanaGrid = document.getElementById("rencanaGrid");
  const rencanaEmpty = document.getElementById("rencanaEmpty");

  function ensureProgress(p) {
    if (!p.progress) {
      p.progress = {
        pendaftaran: null, proposal: null, laporanAkhir: null,
        pressRelease: null, jurnal: null, sertifikat: null
      };
    }
    return p.progress;
  }

  function renderRencana() {
    rencanaGrid.innerHTML = "";
    rencanaEmpty.classList.toggle("show", DATA.projects.length === 0);
    DATA.projects.forEach(p => {
      ensureProgress(p);
      const isSel = DATA.activeProjectId === p.id;
      const card = document.createElement("div");
      card.className = "card project-card" + (isSel ? " is-selected" : "");
      card.innerHTML = `
        <div class="project-card-top">
          <h3>${esc(p.namaMitra)}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            ${isSel ? '<span class="badge badge-selected">Dipilih</span>' : ""}
            <span class="badge badge-diff-${p.kesulitan}">Tingkat ${p.kesulitan}/5</span>
          </div>
        </div>
        <div class="project-field"><b>Kendala</b><span>${esc(p.kendala)}</span></div>
        <div class="project-field"><b>Solusi</b><span>${esc(p.solusi)}</span></div>
        ${p.linkPendukung ? `<div class="project-field"><b>Link Pendukung</b><span><a href="${esc(p.linkPendukung)}" target="_blank" rel="noopener">${esc(p.linkPendukung)}</a></span></div>` : ""}
        ${p.catatan ? `<div class="project-field"><b>Catatan Kekurangan</b><span>${esc(p.catatan)}</span></div>` : ""}
        <div class="project-card-actions">
          <button class="btn ${isSel ? "btn-secondary" : "btn-primary"} btn-sm" data-pilih="${p.id}">
            <svg class="ic"><use href="#i-check"></use></svg> ${isSel ? "Batal Pilih" : "Pilih"}
          </button>
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button>
          <button class="btn btn-outline-danger btn-sm" data-del="${p.id}"><svg class="ic"><use href="#i-trash"></use></svg> Hapus</button>
        </div>
      `;
      rencanaGrid.appendChild(card);
    });
    renderProgres();
  }

  rencanaGrid.addEventListener("click", (e) => {
    const pilihId = e.target.closest("[data-pilih]")?.dataset.pilih;
    const editId = e.target.closest("[data-edit]")?.dataset.edit;
    const delId = e.target.closest("[data-del]")?.dataset.del;

    if (pilihId) {
      DATA.activeProjectId = DATA.activeProjectId === pilihId ? null : pilihId;
      save();
      renderRencana();
      if (DATA.activeProjectId) { toast("Project dipilih. Buka tab Progres."); }
    }
    if (editId) openRencanaModal(DATA.projects.find(p => p.id === editId));
    if (delId) {
      const p = DATA.projects.find(x => x.id === delId);
      confirmDialog(`Hapus referensi project "${p.namaMitra}"? Data (termasuk progres) akan dipindahkan ke Sampah.`, "Hapus", () => {
        DATA.projects = DATA.projects.filter(x => x.id !== delId);
        if (DATA.activeProjectId === delId) DATA.activeProjectId = null;
        save();
        renderRencana();
        sendToTrash("project", p);
        toast("Referensi project dipindahkan ke Sampah.");
      });
    }
  });

  function openRencanaModal(existing) {
    const isEdit = !!existing;
    openModal(isEdit ? "Edit Referensi Project" : "Tambah Referensi Project", `
      <form id="formRencana">
        <div class="form-group">
          <label>Nama Mitra</label>
          <input type="text" id="fMitra" required value="${esc(existing?.namaMitra || "")}" placeholder="mis. UMKM Kopi Sejahtera">
        </div>
        <div class="form-group">
          <label>Kendala</label>
          <textarea id="fKendala" required placeholder="Kendala yang dihadapi mitra...">${esc(existing?.kendala || "")}</textarea>
        </div>
        <div class="form-group">
          <label>Solusi</label>
          <textarea id="fSolusi" required placeholder="Solusi yang ditawarkan...">${esc(existing?.solusi || "")}</textarea>
        </div>
        <div class="form-group">
          <label>Range Tingkat Kesulitan</label>
          <div class="range-row">
            <input type="range" id="fKesulitan" min="1" max="5" step="1" value="${existing?.kesulitan || 3}">
            <span class="range-value" id="fKesulitanVal">${existing?.kesulitan || 3}</span>
          </div>
        </div>
        <div class="form-group">
          <label>Link Pendukung untuk Solusi (opsional)</label>
          <input type="url" id="fLinkPendukung" value="${esc(existing?.linkPendukung || "")}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>Catatan (opsional)</label>
          <textarea id="fCatatan" placeholder="Catat apa yang masih kurang / perlu ditindaklanjuti...">${esc(existing?.catatan || "")}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">${isEdit ? "Simpan Perubahan" : "Tambah Referensi"}</button>
        </div>
      </form>
    `, (root) => {
      const range = root.querySelector("#fKesulitan");
      const rangeVal = root.querySelector("#fKesulitanVal");
      range.addEventListener("input", () => rangeVal.textContent = range.value);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#formRencana").addEventListener("submit", (e) => {
        e.preventDefault();
        const namaMitra = root.querySelector("#fMitra").value.trim();
        const kendala = root.querySelector("#fKendala").value.trim();
        const solusi = root.querySelector("#fSolusi").value.trim();
        const kesulitan = parseInt(range.value, 10);
        const linkPendukung = root.querySelector("#fLinkPendukung").value.trim();
        const catatan = root.querySelector("#fCatatan").value.trim();
        if (!namaMitra || !kendala || !solusi) return;
        if (isEdit) {
          existing.namaMitra = namaMitra; existing.kendala = kendala;
          existing.solusi = solusi; existing.kesulitan = kesulitan;
          existing.linkPendukung = linkPendukung; existing.catatan = catatan;
          toast("Referensi project diperbarui.", "success");
        } else {
          DATA.projects.push({
            id: uid(), namaMitra, kendala, solusi, kesulitan, linkPendukung, catatan,
            progress: { pendaftaran: null, proposal: null, laporanAkhir: null, pressRelease: null, jurnal: null, sertifikat: null }
          });
          toast("Referensi project ditambahkan.", "success");
        }
        save();
        renderRencana();
        closeModal();
      });
    });
  }
  document.getElementById("btnTambahReferensi").addEventListener("click", () => openRencanaModal(null));

  /* ============================================================
     8. TAB: SPIN
  ============================================================ */
  const taskList = document.getElementById("taskList");
  const taskEmpty = document.getElementById("taskEmpty");
  const taskPicker = document.getElementById("taskPicker");
  const wheelSvg = document.getElementById("wheelSvg");
  const leverBtn = document.getElementById("leverBtn");
  const wheelHint = document.getElementById("wheelHint");
  const hasilSpinBody = document.getElementById("hasilSpinBody");
  const hasilSpinEmpty = document.getElementById("hasilSpinEmpty");

  let selectedTaskId = null;
  let wheelRotation = 0;
  let isSpinning = false;

  document.getElementById("formTambahTugas").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("inputTugasBaru");
    const nama = input.value.trim();
    if (!nama) return;
    DATA.tasks.push({ id: uid(), nama, assigneeId: null });
    input.value = "";
    save();
    renderTaskList();
    toast("Tugas ditambahkan.");
  });

  function renderTaskList() {
    taskList.innerHTML = "";
    taskEmpty.classList.toggle("show", DATA.tasks.length === 0);
    DATA.tasks.forEach(t => {
      const li = document.createElement("li");
      li.className = t.assigneeId ? "done" : "";
      li.innerHTML = `
        <span class="task-name">${esc(t.nama)}</span>
        ${t.assigneeId ? `<span class="task-assignee">${esc(anggotaNama(t.assigneeId))}</span>` : ""}
        <button class="btn-icon danger" style="width:26px;height:26px;" title="Hapus tugas" data-deltask="${t.id}">
          <svg class="ic" style="width:14px;height:14px;"><use href="#i-x"></use></svg>
        </button>
      `;
      taskList.appendChild(li);
    });
    renderTaskPicker();
    renderHasilSpin();
  }

  taskList.addEventListener("click", (e) => {
    const id = e.target.closest("[data-deltask]")?.dataset.deltask;
    if (!id) return;
    DATA.tasks = DATA.tasks.filter(t => t.id !== id);
    if (selectedTaskId === id) selectedTaskId = null;
    save();
    renderTaskList();
  });

  function renderTaskPicker() {
    const pending = DATA.tasks.filter(t => !t.assigneeId);
    if (!selectedTaskId || !pending.find(t => t.id === selectedTaskId)) {
      selectedTaskId = pending.length ? pending[0].id : null;
    }
    taskPicker.innerHTML = "";
    DATA.tasks.forEach(t => {
      const btn = document.createElement("button");
      btn.className = "task-pick-btn" + (t.id === selectedTaskId ? " active" : "");
      btn.textContent = t.nama;
      btn.disabled = !!t.assigneeId;
      btn.addEventListener("click", () => {
        if (t.assigneeId) return;
        selectedTaskId = t.id;
        renderTaskPicker();
      });
      taskPicker.appendChild(btn);
    });
    updateWheelHint();
    updateLeverState();
  }

  function updateWheelHint() {
    if (DATA.anggota.length === 0) {
      wheelHint.textContent = "Tambahkan anggota terlebih dahulu di tab Anggota.";
    } else if (DATA.tasks.length === 0) {
      wheelHint.textContent = "Tambahkan tugas untuk mulai membagi.";
    } else if (!selectedTaskId) {
      wheelHint.textContent = "Semua tugas sudah dibagikan. Tambah tugas baru atau reset hasil.";
    } else {
      const t = DATA.tasks.find(x => x.id === selectedTaskId);
      wheelHint.textContent = `Siap memutar untuk tugas: "${t ? t.nama : ""}"`;
    }
  }

  function updateLeverState() {
    leverBtn.disabled = isSpinning || DATA.anggota.length === 0 || !selectedTaskId;
  }

  const WHEEL_COLORS = ["#7d1c2a", "#932334", "#4a0f18", "#b8863b", "#641621", "#a5701f"];

  function renderSpinWheel() {
    const n = DATA.anggota.length;
    wheelSvg.innerHTML = "";
    if (n === 0) {
      wheelSvg.innerHTML = `<circle cx="150" cy="150" r="140" fill="#f3ebe8" stroke="#e7d9d6" stroke-width="2"/>
        <text x="150" y="155" text-anchor="middle" font-size="14" fill="#7a6468" font-family="Work Sans">Belum ada anggota</text>`;
      updateLeverState();
      return;
    }
    const cx = 150, cy = 150, r = 145;
    const segAngle = 360 / n;
    const ns = "http://www.w3.org/2000/svg";
    DATA.anggota.forEach((a, i) => {
      const startDeg = i * segAngle - 90;
      const endDeg = (i + 1) * segAngle - 90;
      const startRad = startDeg * Math.PI / 180;
      const endRad = endDeg * Math.PI / 180;
      const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
      const largeArc = segAngle > 180 ? 1 : 0;
      const path = document.createElementNS(ns, "path");
      const d = n === 1
        ? `M ${cx} ${cy} m -${r},0 a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      path.setAttribute("d", d);
      path.setAttribute("fill", WHEEL_COLORS[i % WHEEL_COLORS.length]);
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "1.5");
      wheelSvg.appendChild(path);

      // label
      const midDeg = (startDeg + endDeg) / 2;
      const midRad = midDeg * Math.PI / 180;
      const labelR = n === 1 ? 0 : r * 0.62;
      const lx = cx + labelR * Math.cos(midRad);
      const ly = cy + labelR * Math.sin(midRad);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", lx);
      text.setAttribute("y", ly);
      text.setAttribute("fill", "#fff");
      text.setAttribute("font-size", n > 8 ? "9" : "11.5");
      text.setAttribute("font-family", "Work Sans, sans-serif");
      text.setAttribute("font-weight", "600");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      if (n > 1) text.setAttribute("transform", `rotate(${midDeg + 90} ${lx} ${ly})`);
      let short = a.nama.length > 12 ? a.nama.slice(0, 11) + "…" : a.nama;
      text.textContent = short;
      wheelSvg.appendChild(text);
    });
    updateLeverState();
  }

  leverBtn.addEventListener("click", () => {
    if (leverBtn.disabled) return;
    const n = DATA.anggota.length;
    if (n === 0 || !selectedTaskId) return;
    isSpinning = true;
    updateLeverState();
    leverBtn.classList.add("pulled");
    setTimeout(() => leverBtn.classList.remove("pulled"), 350);

    // Fair weighted pick: fewer current assignments => higher chance
    const counts = DATA.anggota.map(a => DATA.tasks.filter(t => t.assigneeId === a.id).length);
    const maxCount = Math.max(...counts, 0);
    const weights = counts.map(c => (maxCount - c) + 1);
    const totalW = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * totalW;
    let winnerIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { winnerIdx = i; break; }
    }

    const segAngle = 360 / n;
    const centerAngle = (winnerIdx + 0.5) * segAngle; // from top, clockwise
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const target = extraSpins * 360 + (360 - centerAngle) % 360;
    wheelRotation += target; // always add, so it keeps spinning forward
    wheelSvg.style.transform = `rotate(${wheelRotation}deg)`;

    setTimeout(() => {
      const winner = DATA.anggota[winnerIdx];
      const task = DATA.tasks.find(t => t.id === selectedTaskId);
      if (task) {
        task.assigneeId = winner.id;
        save();
        renderTaskList();
        toast(`"${task.nama}" ditugaskan ke ${winner.nama}!`, "success");
      }
      isSpinning = false;
      updateLeverState();
    }, 3300);
  });

  function renderHasilSpin() {
    const assigned = DATA.tasks.filter(t => t.assigneeId);
    hasilSpinBody.innerHTML = "";
    hasilSpinEmpty.classList.toggle("show", assigned.length === 0);
    assigned.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(t.nama)}</td><td>${esc(anggotaNama(t.assigneeId))}</td>`;
      hasilSpinBody.appendChild(tr);
    });
  }

  document.getElementById("btnResetHasil").addEventListener("click", () => {
    if (!DATA.tasks.some(t => t.assigneeId)) return;
    confirmDialog("Reset semua hasil pembagian tugas? Tugas akan kembali menjadi belum ditugaskan.", "Reset", () => {
      DATA.tasks.forEach(t => t.assigneeId = null);
      save();
      renderTaskList();
      toast("Hasil pembagian direset.");
    });
  });

  function renderCertOptionsIfOpenElsewhere() { /* placeholder hook, cert modal reloads fresh each open */ }

  /* ============================================================
     9. TAB: PROGRES
  ============================================================ */
  const progresStepper = document.getElementById("progresStepper");
  const progresEmpty = document.getElementById("progresEmpty");
  const progresActiveInfo = document.getElementById("progresActiveInfo");

  const STEP_DEFS = [
    { key: "pendaftaran", label: "Pendaftaran" },
    { key: "proposal", label: "Submit Proposal" },
    { key: "laporanAkhir", label: "Submit Laporan Akhir" },
    { key: "pressRelease", label: "Submit Press Release" },
    { key: "jurnal", label: "Submit Jurnal" },
    { key: "sertifikat", label: "Sertifikat" }
  ];

  function activeProject() {
    return DATA.projects.find(p => p.id === DATA.activeProjectId) || null;
  }

  function renderProgres() {
    const proj = activeProject();
    progresStepper.innerHTML = "";
    if (!proj) {
      progresEmpty.classList.add("show");
      progresActiveInfo.style.display = "none";
      return;
    }
    progresEmpty.classList.remove("show");
    progresActiveInfo.style.display = "flex";
    ensureProgress(proj);
    progresActiveInfo.innerHTML = `
      <div>
        <h3>${esc(proj.namaMitra)}</h3>
        <p>Tingkat kesulitan ${proj.kesulitan}/5 · ${completedCount(proj)} dari ${STEP_DEFS.length} tahap selesai</p>
      </div>
      <span class="badge badge-selected">Project Aktif</span>
    `;

    STEP_DEFS.forEach((def, i) => {
      const entry = proj.progress[def.key];
      const done = entry && entry.status === "done";
      const step = document.createElement("div");
      step.className = "step" + (done ? " completed" : " active");
      step.innerHTML = `
        <div class="step-rail">
          <div class="step-dot">${done ? '<svg class="ic" style="width:16px;height:16px;"><use href="#i-check"></use></svg>' : (i + 1)}</div>
          ${i < STEP_DEFS.length - 1 ? '<div class="step-line"></div>' : ""}
        </div>
        <div class="step-body">
          <div class="step-card" data-step="${def.key}">
            <div class="step-card-head">
              <h3>${def.label}</h3>
              <span class="step-status ${done ? "done" : "pending"}">${done ? "Selesai" : "Belum diisi"}</span>
            </div>
            ${done ? renderStepSummary(def.key, entry, proj) : `<p style="font-size:13px;color:var(--ink-500);margin-top:8px;">Klik untuk mengisi tahap ini.</p>`}
          </div>
        </div>
      `;
      progresStepper.appendChild(step);
    });

    // attach click handlers
    progresStepper.querySelectorAll(".step-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return; // handled separately
        openStepModal(card.dataset.step, proj);
      });
    });
    progresStepper.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleStepAction(btn.dataset.action, btn.dataset.step, proj, btn);
      });
    });
  }

  function completedCount(proj) {
    return STEP_DEFS.filter(d => proj.progress[d.key]?.status === "done").length;
  }

  function renderStepSummary(key, entry, proj) {
    if (key === "pendaftaran") {
      return `<div class="step-summary">
        <div class="kv"><b>File:</b> ${esc(entry.file?.name || "-")}</div>
        <div class="kv"><b>Dikirim:</b> ${fmtDate(entry.submittedAt)}</div>
        <div class="step-summary-actions">
          <button class="btn btn-secondary btn-sm" data-action="download-pendaftaran" data-step="pendaftaran"><svg class="ic"><use href="#i-download"></use></svg> Unduh</button>
          <button class="btn btn-ghost btn-sm" data-action="edit" data-step="pendaftaran"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button>
        </div>
      </div>`;
    }
    if (key === "proposal") {
      return `<div class="step-summary">
        <div class="kv"><b>Judul:</b> ${esc(entry.judul)}</div>
        <div class="kv"><b>Tema PKM:</b> ${esc(entry.tema)}</div>
        <div class="kv"><b>File:</b> ${esc(entry.file?.name || "-")}</div>
        <div class="step-summary-actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-step="proposal"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button></div>
      </div>`;
    }
    if (key === "laporanAkhir") {
      return `<div class="step-summary">
        <div class="kv"><b>Judul Laporan:</b> ${esc(entry.judul)}</div>
        <div class="kv"><b>File:</b> ${esc(entry.file?.name || "-")}</div>
        <div class="step-summary-actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-step="laporanAkhir"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button></div>
      </div>`;
    }
    if (key === "pressRelease") {
      return `<div class="step-summary">
        <div class="kv"><b>Judul:</b> ${esc(entry.judul)}</div>
        <div class="kv"><b>Bukti:</b> ${esc(entry.bukti?.name || "-")}</div>
        <div class="kv copy-link-row"><b>Link:</b>
          <a href="${esc(entry.link)}" target="_blank" rel="noopener">${esc(entry.link)}</a>
          <button class="btn-icon" style="width:26px;height:26px;" title="Salin link" data-action="copy-link" data-step="pressRelease"><svg class="ic" style="width:14px;height:14px;"><use href="#i-copy"></use></svg></button>
        </div>
        <div class="step-summary-actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-step="pressRelease"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button></div>
      </div>`;
    }
    if (key === "jurnal") {
      return `<div class="step-summary">
        <div class="kv"><b>Judul Jurnal:</b> ${esc(entry.judul)}</div>
        <div class="kv"><b>File Jurnal:</b> ${esc(entry.fileJurnal?.name || "-")}</div>
        <div class="kv"><b>File LOA:</b> ${esc(entry.fileLOA?.name || "-")}</div>
        <div class="kv"><b>File Turnitin:</b> ${esc(entry.fileTurnitin?.name || "-")}</div>
        <div class="kv"><b>Link Jurnal:</b> <a href="${esc(entry.link)}" target="_blank" rel="noopener">${esc(entry.link)}</a></div>
        <div class="step-summary-actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-step="jurnal"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button></div>
      </div>`;
    }
    if (key === "sertifikat") {
      const items = entry.items || [];
      return `<div class="step-summary">
        <div class="kv"><b>Total diunggah:</b> ${items.length} sertifikat</div>
        ${items.map(it => `<div class="kv">• ${esc(anggotaNama(it.anggotaId))} — ${esc(it.file?.name || "-")}</div>`).join("")}
        <div class="step-summary-actions"><button class="btn btn-ghost btn-sm" data-action="edit" data-step="sertifikat"><svg class="ic"><use href="#i-edit"></use></svg> Edit</button></div>
      </div>`;
    }
    return "";
  }

  function handleStepAction(action, key, proj, btn) {
    const entry = proj.progress[key];
    if (action === "edit") { openStepModal(key, proj); return; }
    if (action === "download-pendaftaran") {
      const f = entry.file;
      if (!f) return;
      const fname = `pendaftaran_${slugify(proj.namaMitra)}${extFromName(f.name)}`;
      downloadDataUrl(f.dataUrl, fname);
      toast("File pendaftaran diunduh.");
    }
    if (action === "copy-link") {
      navigator.clipboard.writeText(entry.link || "").then(() => toast("Link disalin!", "success"))
        .catch(() => toast("Gagal menyalin link.", "danger"));
    }
  }

  function fileDropField(id, label, opts) {
    opts = opts || {};
    return `
      <div class="form-group">
        <label>${label}${opts.required !== false ? "" : " (opsional)"}</label>
        <label class="file-drop" id="drop-${id}">
          <svg class="ic"><use href="#i-upload"></use></svg>
          <div id="dropLabel-${id}">${opts.existing ? "Ganti file" : "Klik untuk pilih file"}</div>
          <input type="file" id="input-${id}" ${opts.accept ? `accept="${opts.accept}"` : ""}>
        </label>
        <div id="chip-${id}">${opts.existing ? fileChipHtml(opts.existing) : ""}</div>
      </div>`;
  }
  function fileChipHtml(f) {
    return `<div class="file-chip"><svg class="ic"><use href="#i-file"></use></svg><span>${esc(f.name)}</span></div>`;
  }
  function wireFileDrop(root, id, onPicked) {
    const input = root.querySelector("#input-" + id);
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const dataUrl = await readFileAsDataURL(file);
      const fileObj = { name: file.name, type: file.type, dataUrl };
      root.querySelector("#chip-" + id).innerHTML = fileChipHtml(fileObj);
      onPicked(fileObj);
    });
  }

  function openStepModal(key, proj) {
    ensureProgress(proj);
    const entry = proj.progress[key];
    if (key === "pendaftaran") return openPendaftaranModal(entry, proj);
    if (key === "proposal") return openProposalModal(entry, proj);
    if (key === "laporanAkhir") return openLaporanModal(entry, proj);
    if (key === "pressRelease") return openPressReleaseModal(entry, proj);
    if (key === "jurnal") return openJurnalModal(entry, proj);
    if (key === "sertifikat") return openSertifikatModal(entry, proj);
  }

  function saveStepAndRefresh(proj, key, data) {
    proj.progress[key] = Object.assign({ status: "done", submittedAt: Date.now() }, data);
    save();
    renderProgres();
    closeModal();
    toast("Tahap berhasil disimpan.", "success");
  }

  /* --- 9.1 Pendaftaran --- */
  function openPendaftaranModal(entry, proj) {
    let file = entry?.file || null;
    openModal(entry ? "Edit Pendaftaran" : "Isi Pendaftaran", `
      <form id="fStep">
        ${fileDropField("pendaftaran", "Upload File Pendaftaran", { existing: file })}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      wireFileDrop(root, "pendaftaran", (f) => file = f);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!file) { toast("Silakan upload file pendaftaran.", "danger"); return; }
        saveStepAndRefresh(proj, "pendaftaran", { file });
      });
    });
  }

  /* --- 9.2 Proposal --- */
  function openProposalModal(entry, proj) {
    let file = entry?.file || null;
    openModal(entry ? "Edit Submit Proposal" : "Submit Proposal", `
      <form id="fStep">
        <div class="form-group"><label>Judul</label><input type="text" id="fJudul" required value="${esc(entry?.judul || "")}"></div>
        <div class="form-group"><label>Tema PKM</label><input type="text" id="fTema" required value="${esc(entry?.tema || "")}"></div>
        ${fileDropField("proposal", "Upload Proposal (IA)", { existing: file })}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      wireFileDrop(root, "proposal", (f) => file = f);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        const judul = root.querySelector("#fJudul").value.trim();
        const tema = root.querySelector("#fTema").value.trim();
        if (!judul || !tema) return;
        if (!file) { toast("Silakan upload file proposal.", "danger"); return; }
        saveStepAndRefresh(proj, "proposal", { judul, tema, file });
      });
    });
  }

  /* --- 9.3 Laporan Akhir --- */
  function openLaporanModal(entry, proj) {
    let file = entry?.file || null;
    openModal(entry ? "Edit Laporan Akhir" : "Submit Laporan Akhir", `
      <form id="fStep">
        <div class="form-group"><label>Judul Laporan</label><input type="text" id="fJudul" required value="${esc(entry?.judul || "")}"></div>
        ${fileDropField("laporan", "Upload File Laporan", { existing: file })}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      wireFileDrop(root, "laporan", (f) => file = f);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        const judul = root.querySelector("#fJudul").value.trim();
        if (!judul) return;
        if (!file) { toast("Silakan upload file laporan.", "danger"); return; }
        saveStepAndRefresh(proj, "laporanAkhir", { judul, file });
      });
    });
  }

  /* --- 9.4 Press Release --- */
  function openPressReleaseModal(entry, proj) {
    let bukti = entry?.bukti || null;
    openModal(entry ? "Edit Press Release" : "Submit Press Release", `
      <form id="fStep">
        <div class="form-group"><label>Judul Press Release</label><input type="text" id="fJudul" required value="${esc(entry?.judul || "")}"></div>
        ${fileDropField("bukti", "Upload Bukti", { existing: bukti })}
        <div class="form-group"><label>Link Press Release</label><input type="url" id="fLink" required value="${esc(entry?.link || "")}" placeholder="https://..."></div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      wireFileDrop(root, "bukti", (f) => bukti = f);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        const judul = root.querySelector("#fJudul").value.trim();
        const link = root.querySelector("#fLink").value.trim();
        if (!judul || !link) return;
        if (!bukti) { toast("Silakan upload bukti press release.", "danger"); return; }
        saveStepAndRefresh(proj, "pressRelease", { judul, bukti, link });
      });
    });
  }

  /* --- 9.5 Jurnal --- */
  function openJurnalModal(entry, proj) {
    let fileJurnal = entry?.fileJurnal || null;
    let fileLOA = entry?.fileLOA || null;
    let fileTurnitin = entry?.fileTurnitin || null;
    openModal(entry ? "Edit Submit Jurnal" : "Submit Jurnal", `
      <form id="fStep">
        <div class="form-group"><label>Judul Jurnal</label><input type="text" id="fJudul" required value="${esc(entry?.judul || "")}"></div>
        ${fileDropField("fileJurnal", "File Jurnal", { existing: fileJurnal })}
        ${fileDropField("fileLOA", "File LOA", { existing: fileLOA })}
        ${fileDropField("fileTurnitin", "File Turnitin", { existing: fileTurnitin })}
        <div class="form-group"><label>Link Jurnal</label><input type="url" id="fLink" required value="${esc(entry?.link || "")}" placeholder="https://..."></div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      wireFileDrop(root, "fileJurnal", (f) => fileJurnal = f);
      wireFileDrop(root, "fileLOA", (f) => fileLOA = f);
      wireFileDrop(root, "fileTurnitin", (f) => fileTurnitin = f);
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        const judul = root.querySelector("#fJudul").value.trim();
        const link = root.querySelector("#fLink").value.trim();
        if (!judul || !link) return;
        if (!fileJurnal || !fileLOA || !fileTurnitin) { toast("Lengkapi semua file (Jurnal, LOA, Turnitin).", "danger"); return; }
        saveStepAndRefresh(proj, "jurnal", { judul, fileJurnal, fileLOA, fileTurnitin, link });
      });
    });
  }

  /* --- 9.6 Sertifikat --- */
  function openSertifikatModal(entry, proj) {
    const maxRows = Math.max(DATA.anggota.length, 1);
    let items = entry?.items ? entry.items.map(it => ({ ...it })) : [];
    if (items.length === 0 && DATA.anggota.length > 0) items = [{ anggotaId: "", file: null }];

    function rowsHtml() {
      return items.map((it, i) => `
        <div class="cert-row" data-row="${i}">
          <select data-role="anggota" data-idx="${i}">
            <option value="">Pilih anggota</option>
            ${DATA.anggota.map(a => `<option value="${a.id}" ${it.anggotaId === a.id ? "selected" : ""}>${esc(a.nama)}</option>`).join("")}
          </select>
          <label class="file-drop" id="drop-cert-${i}" style="margin:0;">
            <svg class="ic"><use href="#i-upload"></use></svg>
            <div>${it.file ? esc(it.file.name) : "Pilih file sertifikat"}</div>
            <input type="file" id="input-cert-${i}" data-idx="${i}">
          </label>
          <button type="button" class="btn-icon danger" data-remove-row="${i}" title="Hapus baris"><svg class="ic"><use href="#i-x"></use></svg></button>
        </div>
      `).join("");
    }

    function render(root) {
      root.querySelector("#certRows").innerHTML = rowsHtml();
      root.querySelectorAll('[data-role="anggota"]').forEach(sel => {
        sel.addEventListener("change", () => { items[+sel.dataset.idx].anggotaId = sel.value; });
      });
      root.querySelectorAll('[id^="input-cert-"]').forEach(inp => {
        inp.addEventListener("change", async () => {
          const idx = +inp.dataset.idx;
          const file = inp.files[0];
          if (!file) return;
          const dataUrl = await readFileAsDataURL(file);
          items[idx].file = { name: file.name, type: file.type, dataUrl };
          render(root);
        });
      });
      root.querySelectorAll("[data-remove-row]").forEach(btn => {
        btn.addEventListener("click", () => {
          items.splice(+btn.dataset.removeRow, 1);
          render(root);
        });
      });
      root.querySelector("#btnAddCertRow").disabled = items.length >= maxRows || DATA.anggota.length === 0;
    }

    openModal(entry ? "Edit Sertifikat" : "Upload Sertifikat", `
      <form id="fStep">
        <p class="hint" style="margin-bottom:12px;">Unggah sertifikat untuk setiap anggota (maks. ${maxRows} sesuai jumlah anggota).</p>
        <div id="certRows" class="cert-list"></div>
        <button type="button" class="btn btn-secondary btn-sm btn-block" id="btnAddCertRow"><svg class="ic"><use href="#i-plus"></use></svg> Tambah Sertifikat</button>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (root) => {
      render(root);
      root.querySelector("#btnAddCertRow").addEventListener("click", () => {
        if (items.length >= maxRows) return;
        items.push({ anggotaId: "", file: null });
        render(root);
      });
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#fStep").addEventListener("submit", (e) => {
        e.preventDefault();
        const valid = items.filter(it => it.anggotaId && it.file);
        if (valid.length === 0) { toast("Lengkapi minimal satu sertifikat (anggota + file).", "danger"); return; }
        if (valid.length !== items.length) { toast("Ada baris yang belum lengkap (anggota/file).", "danger"); return; }
        saveStepAndRefresh(proj, "sertifikat", { items: valid });
      });
    });
  }

  /* ============================================================
     9.5 TAB: DOKUMENTASI
  ============================================================ */
  const dokumentasiGrid = document.getElementById("dokumentasiGrid");
  const dokumentasiEmpty = document.getElementById("dokumentasiEmpty");

  function renderDokumentasi() {
    dokumentasiGrid.innerHTML = "";
    dokumentasiEmpty.classList.toggle("show", DATA.dokumentasi.length === 0);
    DATA.dokumentasi.forEach(doc => {
      const card = document.createElement("div");
      card.className = "doc-card";
      card.innerHTML = `
        <img src="${doc.file.dataUrl}" alt="${esc(doc.caption || doc.file.name)}" loading="lazy">
        <div class="doc-card-body">
          <p class="doc-caption ${doc.caption ? "" : "empty"}">${doc.caption ? esc(doc.caption) : "Tanpa caption"}</p>
          <p class="doc-meta">${fmtDate(doc.createdAt)}</p>
          <div class="doc-actions">
            <button class="btn-icon" title="Edit" data-docedit="${doc.id}"><svg class="ic"><use href="#i-edit"></use></svg></button>
            <button class="btn-icon success" title="Download" data-docdownload="${doc.id}"><svg class="ic"><use href="#i-download"></use></svg></button>
            <button class="btn-icon danger" title="Hapus" data-docdel="${doc.id}"><svg class="ic"><use href="#i-trash"></use></svg></button>
          </div>
        </div>
      `;
      dokumentasiGrid.appendChild(card);
    });
  }

  dokumentasiGrid.addEventListener("click", (e) => {
    const editId = e.target.closest("[data-docedit]")?.dataset.docedit;
    const delId = e.target.closest("[data-docdel]")?.dataset.docdel;
    const dlId = e.target.closest("[data-docdownload]")?.dataset.docdownload;

    if (editId) openDokumentasiModal(DATA.dokumentasi.find(d => d.id === editId));
    if (dlId) {
      const doc = DATA.dokumentasi.find(d => d.id === dlId);
      if (doc) { downloadDataUrl(doc.file.dataUrl, doc.file.name); toast("Dokumentasi diunduh."); }
    }
    if (delId) {
      const doc = DATA.dokumentasi.find(d => d.id === delId);
      confirmDialog(`Hapus dokumentasi ini? Data akan dipindahkan ke Sampah.`, "Hapus", () => {
        DATA.dokumentasi = DATA.dokumentasi.filter(d => d.id !== delId);
        save();
        renderDokumentasi();
        sendToTrash("dokumentasi", doc);
        toast("Dokumentasi dipindahkan ke Sampah.");
      });
    }
  });

  function openDokumentasiModal(existing) {
    const isEdit = !!existing;
    let file = existing?.file || null;
    openModal(isEdit ? "Edit Dokumentasi" : "Upload Dokumentasi", `
      <form id="formDokumentasi">
        <div class="form-group">
          <label>Foto${isEdit ? " (opsional, biarkan kosong jika tidak diganti)" : ""}</label>
          <label class="file-drop" id="drop-doc">
            <svg class="ic"><use href="#i-upload"></use></svg>
            <div id="dropLabel-doc">${file ? "Ganti foto" : "Klik untuk pilih foto (landscape / potrait bebas)"}</div>
            <input type="file" id="input-doc" accept="image/*">
          </label>
          <div id="chip-doc">${file ? `<div class="file-chip"><svg class="ic"><use href="#i-file"></use></svg><span>${esc(file.name)}</span></div>` : ""}</div>
        </div>
        <div class="form-group">
          <label>Caption (opsional)</label>
          <textarea id="fCaption" placeholder="Lagi ngapain nih? mis. Survei lokasi mitra bareng tim...">${esc(existing?.caption || "")}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="cancelBtn">Batal</button>
          <button type="submit" class="btn btn-primary">${isEdit ? "Simpan Perubahan" : "Upload"}</button>
        </div>
      </form>
    `, (root) => {
      const input = root.querySelector("#input-doc");
      input.addEventListener("change", async () => {
        const f = input.files[0];
        if (!f) return;
        const dataUrl = await readFileAsDataURL(f);
        file = { name: f.name, type: f.type, dataUrl };
        root.querySelector("#chip-doc").innerHTML = `<div class="file-chip"><svg class="ic"><use href="#i-file"></use></svg><span>${esc(f.name)}</span></div>`;
      });
      root.querySelector("#cancelBtn").addEventListener("click", closeModal);
      root.querySelector("#formDokumentasi").addEventListener("submit", (e) => {
        e.preventDefault();
        const caption = root.querySelector("#fCaption").value.trim();
        if (!file) { toast("Silakan pilih foto terlebih dahulu.", "danger"); return; }
        if (isEdit) {
          existing.caption = caption;
          existing.file = file;
          toast("Dokumentasi diperbarui.", "success");
        } else {
          DATA.dokumentasi.unshift({ id: uid(), caption, file, createdAt: Date.now() });
          toast("Dokumentasi diunggah.", "success");
        }
        save();
        renderDokumentasi();
        closeModal();
      });
    });
  }
  document.getElementById("btnTambahDokumentasi").addEventListener("click", () => openDokumentasiModal(null));

  /* ============================================================
     10. TAB: SAMPAH
  ============================================================ */
  const sampahGrid = document.getElementById("sampahGrid");
  const sampahEmpty = document.getElementById("sampahEmpty");

  function trashLabel(item) {
    if (item.type === "anggota") return { title: item.data.nama, sub: `NIM ${item.data.nim}`, type: "Anggota" };
    if (item.type === "project") return { title: item.data.namaMitra, sub: `Tingkat kesulitan ${item.data.kesulitan}/5`, type: "Rencana Project" };
    if (item.type === "dokumentasi") {
      const cap = item.data.caption ? (item.data.caption.length > 40 ? item.data.caption.slice(0, 40) + "…" : item.data.caption) : item.data.file?.name;
      return { title: cap || "Dokumentasi", sub: item.data.file?.name || "", type: "Dokumentasi" };
    }
    return { title: "Item", sub: "", type: item.type };
  }

  function renderTrash() {
    sampahGrid.innerHTML = "";
    sampahEmpty.classList.toggle("show", DATA.trash.length === 0);
    DATA.trash.forEach(item => {
      const info = trashLabel(item);
      const card = document.createElement("div");
      card.className = "card trash-card";
      card.innerHTML = `
        <div class="trash-card-top">
          <div>
            <span class="trash-type">${esc(info.type)}</span>
            <h3 style="font-size:16px;margin-top:4px;">${esc(info.title)}</h3>
          </div>
        </div>
        <p class="trash-meta">${esc(info.sub)}</p>
        <p class="trash-meta">Dihapus: ${fmtDate(item.deletedAt)}</p>
        <div class="trash-actions">
          <button class="btn btn-secondary btn-sm" data-restore="${item.id}"><svg class="ic"><use href="#i-restore"></use></svg> Pulihkan</button>
          <button class="btn btn-outline-danger btn-sm" data-purge="${item.id}"><svg class="ic"><use href="#i-trash"></use></svg> Hapus Permanen</button>
        </div>
      `;
      sampahGrid.appendChild(card);
    });
  }

  sampahGrid.addEventListener("click", (e) => {
    const restoreId = e.target.closest("[data-restore]")?.dataset.restore;
    const purgeId = e.target.closest("[data-purge]")?.dataset.purge;
    if (restoreId) {
      const item = DATA.trash.find(t => t.id === restoreId);
      if (!item) return;
      if (item.type === "anggota") DATA.anggota.push(item.data);
      if (item.type === "project") { ensureProgress(item.data); DATA.projects.push(item.data); }
      if (item.type === "dokumentasi") DATA.dokumentasi.unshift(item.data);
      DATA.trash = DATA.trash.filter(t => t.id !== restoreId);
      save();
      renderAnggota(); renderRencana(); renderDokumentasi(); renderTrash();
      toast("Data berhasil dipulihkan.", "success");
    }
    if (purgeId) {
      confirmDialog("Hapus permanen item ini? Tindakan tidak dapat dibatalkan.", "Hapus Permanen", () => {
        DATA.trash = DATA.trash.filter(t => t.id !== purgeId);
        save();
        renderTrash();
        toast("Item dihapus permanen.");
      });
    }
  });

  document.getElementById("btnKosongkanSampah").addEventListener("click", () => {
    if (DATA.trash.length === 0) return;
    confirmDialog("Kosongkan seluruh sampah? Semua data di sampah akan dihapus permanen.", "Kosongkan", () => {
      DATA.trash = [];
      save();
      renderTrash();
      toast("Sampah dikosongkan.");
    });
  });

  /* ============================================================
     11. TAB: DASHBOARD
  ============================================================ */
  const dashboardRoot = document.getElementById("dashboardRoot");

  function renderDashboard() {
    if (!dashboardRoot) return;

    const totalAnggota = DATA.anggota.length;
    const totalProject = DATA.projects.length;
    const totalDok = DATA.dokumentasi.length;
    const totalSampah = DATA.trash.length;

    const proj = activeProject();
    const totalTugas = DATA.tasks.length;
    const tugasTerbagi = DATA.tasks.filter(t => t.assigneeId).length;
    const spinPct = totalTugas ? Math.round((tugasTerbagi / totalTugas) * 100) : 0;

    let projectCardHtml;
    if (proj) {
      ensureProgress(proj);
      const done = completedCount(proj);
      const pct = Math.round((done / STEP_DEFS.length) * 100);
      projectCardHtml = `
        <div class="card">
          <div class="dash-card-title">
            <h3>Project Aktif</h3>
            <span class="badge badge-diff-${proj.kesulitan}">Tingkat ${proj.kesulitan}/5</span>
          </div>
          <p style="font-size:15px;font-weight:600;color:var(--maroon-900);">${esc(proj.namaMitra)}</p>
          <div class="progress-bar-track" style="margin-top:10px;"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
          <div class="progress-bar-label"><span>${done} dari ${STEP_DEFS.length} tahap selesai</span><span>${pct}%</span></div>
          <div class="mini-stepper">
            ${STEP_DEFS.map(d => {
              const isDone = proj.progress[d.key]?.status === "done";
              return `<div class="mini-step ${isDone ? "done" : ""}">
                <span class="mini-step-dot">${isDone ? '<svg class="ic" style="width:12px;height:12px;"><use href="#i-check"></use></svg>' : ""}</span>
                <span>${d.label}</span>
              </div>`;
            }).join("")}
          </div>
          <button class="btn btn-secondary btn-sm btn-block" style="margin-top:16px;" id="dashGoProgres">Buka Tab Progres</button>
        </div>`;
    } else {
      projectCardHtml = `
        <div class="card">
          <div class="dash-card-title"><h3>Project Aktif</h3></div>
          <p class="dash-empty-mini">Belum ada project yang dipilih. Buka tab Rencana Project lalu klik "Pilih".</p>
          <button class="btn btn-secondary btn-sm btn-block" id="dashGoRencana">Buka Rencana Project</button>
        </div>`;
    }

    const recentDocs = DATA.dokumentasi.slice(0, 6);
    const docPreviewHtml = recentDocs.length
      ? `<div class="doc-preview-strip">${recentDocs.map(d => `<img class="doc-preview-thumb" src="${d.file.dataUrl}" alt="${esc(d.caption || "dokumentasi")}">`).join("")}</div>`
      : `<p class="doc-preview-empty">Belum ada dokumentasi diunggah.</p>`;

    dashboardRoot.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-icon"><svg class="ic"><use href="#i-users"></use></svg></span>
          <span class="stat-value">${totalAnggota}</span>
          <span class="stat-label">Anggota Tim</span>
        </div>
        <div class="stat-card accent-gold">
          <span class="stat-icon"><svg class="ic"><use href="#i-doc"></use></svg></span>
          <span class="stat-value">${totalProject}</span>
          <span class="stat-label">Referensi Project</span>
        </div>
        <div class="stat-card accent-success">
          <span class="stat-icon"><svg class="ic"><use href="#i-image"></use></svg></span>
          <span class="stat-value">${totalDok}</span>
          <span class="stat-label">Dokumentasi Tersimpan</span>
        </div>
        <div class="stat-card accent-danger">
          <span class="stat-icon"><svg class="ic"><use href="#i-trash"></use></svg></span>
          <span class="stat-value">${totalSampah}</span>
          <span class="stat-label">Item di Sampah</span>
        </div>
      </div>

      <div class="dash-two-col">
        ${projectCardHtml}
        <div class="card">
          <div class="dash-card-title"><h3>Pembagian Tugas (Spin)</h3></div>
          ${totalTugas === 0 ? `<p class="dash-empty-mini">Belum ada tugas dibuat di tab Spin Tugas.</p>` : `
            <div class="spin-summary-row">
              <div>
                <div class="spin-summary-num">${tugasTerbagi}/${totalTugas}</div>
                <div class="spin-summary-sub">Tugas sudah dibagikan</div>
              </div>
            </div>
            <div class="progress-bar-track" style="margin-top:14px;"><div class="progress-bar-fill" style="width:${spinPct}%;"></div></div>
            <div class="progress-bar-label"><span>Progres pembagian</span><span>${spinPct}%</span></div>
          `}
          <button class="btn btn-secondary btn-sm btn-block" style="margin-top:16px;" id="dashGoSpin">Buka Tab Spin</button>
        </div>
      </div>

      <div class="card">
        <div class="dash-card-title">
          <h3>Dokumentasi Terbaru</h3>
          <button class="btn btn-ghost btn-sm" id="dashGoDok">Lihat Semua</button>
        </div>
        ${docPreviewHtml}
      </div>
    `;

    dashboardRoot.querySelector("#dashGoProgres")?.addEventListener("click", () => goToTab("progres"));
    dashboardRoot.querySelector("#dashGoRencana")?.addEventListener("click", () => goToTab("rencana"));
    dashboardRoot.querySelector("#dashGoSpin")?.addEventListener("click", () => goToTab("spin"));
    dashboardRoot.querySelector("#dashGoDok")?.addEventListener("click", () => goToTab("dokumentasi"));
  }

  /* ============================================================
     12. INIT
  ============================================================ */
  function renderAll() {
    renderAnggota();
    renderRencana();
    renderSpinWheel();
    renderTaskList();
    renderProgres();
    renderDokumentasi();
    renderTrash();
    renderDashboard();
  }

  renderAll();
})();