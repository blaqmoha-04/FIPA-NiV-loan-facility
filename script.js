(() => {
  "use strict";

  const STORAGE_KEY = "niv_fund_data_v1";
  const INTEREST_RATE = 0.10;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { applications: [] };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.applications)) return { applications: [] };
      return parsed;
    } catch (e) {
      console.error("Could not read saved data:", e);
      return { applications: [] };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Could not save data:", e);
      showToast("Could not save — storage may be full.");
    }
  }

  let state = loadData();

  function uid() {
    return "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function money(n) {
    return "GH₵" + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function computeLoanTerms(amount, duration) {
    const interest = amount * INTEREST_RATE;
    const total = amount + interest;
    const monthly = total / duration;
    return { interest, total, monthly };
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  const routes = ["home", "about", "eligibility", "apply", "calculator", "dashboard", "repayment", "stories", "partners", "contact"];

  function navigate(route) {
    if (!routes.includes(route)) route = "home";
    routes.forEach(r => {
      document.getElementById("page-" + r).classList.toggle("active", r === route);
    });
    document.querySelectorAll(".nav-list a").forEach(a => {
      a.classList.toggle("active", a.dataset.route === route);
    });
    document.getElementById("navList").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (route === "dashboard") renderDashboard();
    if (route === "apply") renderRecentApplications();
    if (route === "repayment") renderRepaymentPage();
    if (route === "home") renderHomeStats();
  }

  function routeFromHash() {
    const h = window.location.hash.replace("#", "");
    navigate(h || "home");
  }

  window.addEventListener("hashchange", routeFromHash);
  document.getElementById("navToggle").addEventListener("click", () => {
    document.getElementById("navList").classList.toggle("open");
  });

  function renderHomeStats() {
    const apps = state.applications;
    const groups = new Set(apps.map(a => a.groupName.trim().toLowerCase())).size;
    const beneficiaries = apps.length;
    const active = apps.filter(a => a.status === "active").length;
    const completed = apps.filter(a => a.status === "completed").length;

    const el = document.getElementById("homeStats");
    el.innerHTML = `
      <div class="stat-box"><span class="stat-num">${groups}</span><span class="stat-label">Groups supported</span></div>
      <div class="stat-box"><span class="stat-num">${beneficiaries}</span><span class="stat-label">Beneficiaries</span></div>
      <div class="stat-box"><span class="stat-num">${active}</span><span class="stat-label">Active loans</span></div>
      <div class="stat-box"><span class="stat-num">${completed}</span><span class="stat-label">Completed loans</span></div>
    `;
  }

  const applyForm = document.getElementById("applyForm");
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");
  let pendingPhotoData = null;

  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) { pendingPhotoData = null; photoPreview.hidden = true; return; }
    const reader = new FileReader();
    reader.onload = () => {
      pendingPhotoData = reader.result;
      photoPreview.src = pendingPhotoData;
      photoPreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  applyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(applyForm);
    const amount = Number(fd.get("loanAmount"));
    const duration = Number(fd.get("loanDuration"));
    const terms = computeLoanTerms(amount, duration);

    const record = {
      id: uid(),
      fullName: fd.get("fullName").trim(),
      phone: fd.get("phone").trim(),
      community: fd.get("community").trim(),
      ghanaCard: fd.get("ghanaCard").trim(),
      business: fd.get("business").trim(),
      businessYears: fd.get("businessYears"),
      groupName: fd.get("groupName").trim(),
      groupSize: fd.get("groupSize"),
      returningGroup: fd.get("returningGroup") === "on",
      photo: pendingPhotoData,
      loanAmount: amount,
      loanDuration: duration,
      assessmentNotes: fd.get("assessmentNotes").trim(),
      businessConfirmed: fd.get("businessConfirmed"),
      status: "active",
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      interest: terms.interest,
      total: terms.total,
      monthly: terms.monthly,
      balance: terms.total,
      payments: []
    };

    state.applications.push(record);
    saveData(state);
    applyForm.reset();
    document.getElementById("photoPreview").hidden = true;
    document.querySelector('input[name="loanAmount"]').value = 500;
    document.querySelector('input[name="loanDuration"]').value = 6;
    pendingPhotoData = null;

    showToast(`${record.fullName}'s loan approved.`);
    renderRecentApplications();
    renderDashboard();
    renderRepaymentPage();
    renderHomeStats();
  });

  function renderRecentApplications() {
    const list = document.getElementById("recentAppsList");
    const apps = state.applications;
    if (apps.length === 0) {
      list.innerHTML = `<p class="record-empty">No applications yet.</p>`;
      return;
    }
    list.innerHTML = apps.slice().reverse().slice(0, 10).map(a => `
      <div class="record-item">
        <div>
          <div class="record-main">${escapeHtml(a.fullName)} — ${escapeHtml(a.groupName)}</div>
          <div class="record-sub">${escapeHtml(a.business)} · ${money(a.loanAmount)} / ${a.loanDuration} mo</div>
        </div>
        <span class="badge badge-${a.status}">${a.status}</span>
      </div>
    `).join("");
  }

  const calcAmount = document.getElementById("calcAmount");
  const calcDuration = document.getElementById("calcDuration");

  function renderCalculator() {
    const amount = Number(calcAmount.value);
    const duration = Number(calcDuration.value);
    const terms = computeLoanTerms(amount, duration);

    document.getElementById("calcAmountVal").textContent = money(amount);
    document.getElementById("calcDurationVal").textContent = duration + (duration === 1 ? " month" : " months");
    document.getElementById("resPrincipal").textContent = money(amount);
    document.getElementById("resInterest").textContent = money(terms.interest);
    document.getElementById("resTotal").textContent = money(terms.total);
    document.getElementById("resMonthly").textContent = money(terms.monthly);
  }
  calcAmount.addEventListener("input", renderCalculator);
  calcDuration.addEventListener("input", renderCalculator);

  function renderDashboard() {
    const apps = state.applications;
    const groups = new Set(apps.map(a => a.groupName.trim().toLowerCase())).size;
    const beneficiaries = apps.length;
    const activeLoans = apps.filter(a => a.status === "active");
    const completedLoans = apps.filter(a => a.status === "completed");
    const outstandingBalance = activeLoans.reduce((sum, a) => sum + (a.balance || 0), 0);
    const amountPaid = apps.reduce((sum, a) => sum + (a.payments || []).reduce((s, p) => s + p.amount, 0), 0);

    const cards = [
      { num: groups, label: "Groups supported" },
      { num: beneficiaries, label: "Beneficiaries" },
      { num: activeLoans.length, label: "Active loans" },
      { num: completedLoans.length, label: "Completed loans" },
      { num: activeLoans.length, label: "Outstanding loans" },
      { num: money(amountPaid), label: "Amount paid" },
      { num: money(outstandingBalance), label: "Remaining balance" }
    ];

    document.getElementById("dashGrid").innerHTML = cards.map(c => `
      <div class="dash-card">
        <span class="dash-num">${c.num}</span>
        <span class="dash-label">${c.label}</span>
      </div>
    `).join("");

    const appsList = document.getElementById("dashApplications");
    if (apps.length === 0) {
      appsList.innerHTML = `<p class="record-empty">No applications recorded yet.</p>`;
    } else {
      appsList.innerHTML = apps.slice().reverse().map(a => `
        <div class="record-item">
          <div>
            <div class="record-main">${escapeHtml(a.fullName)}</div>
            <div class="record-sub">${escapeHtml(a.groupName)} · ${money(a.loanAmount)}</div>
          </div>
          <span class="badge badge-${a.status}">${a.status}</span>
        </div>
      `).join("");
    }

    const allPayments = apps.flatMap(a => (a.payments || []).map(p => ({ ...p, borrower: a.fullName })));
    allPayments.sort((x, y) => new Date(y.date) - new Date(x.date));
    const recentList = document.getElementById("dashRecentPayments");
    if (allPayments.length === 0) {
      recentList.innerHTML = `<p class="record-empty">No repayments recorded yet.</p>`;
    } else {
      recentList.innerHTML = allPayments.slice(0, 8).map(p => `
        <div class="record-item">
          <div>
            <div class="record-main">${escapeHtml(p.borrower)}</div>
            <div class="record-sub">${p.date}</div>
          </div>
          <span class="record-main">${money(p.amount)}</span>
        </div>
      `).join("");
    }
  }

  const loanSelect = document.getElementById("loanSelect");
  const paymentForm = document.getElementById("paymentForm");

  function renderRepaymentPage() {
    const activeLoans = state.applications.filter(a => a.status === "active" || a.status === "completed");
    if (activeLoans.length === 0) {
      loanSelect.innerHTML = `<option value="">No approved loans yet</option>`;
      document.getElementById("loanSummary").innerHTML = "";
      document.getElementById("paymentHistory").innerHTML = `<p class="record-empty">Approve an application first.</p>`;
      return;
    }
    const prevSelected = loanSelect.value;
    loanSelect.innerHTML = activeLoans.map(a =>
      `<option value="${a.id}">${escapeHtml(a.fullName)} — ${escapeHtml(a.groupName)} (${a.status})</option>`
    ).join("");
    if (prevSelected && activeLoans.some(a => a.id === prevSelected)) {
      loanSelect.value = prevSelected;
    }
    renderLoanSummary();
  }

  function currentLoan() {
    return state.applications.find(a => a.id === loanSelect.value);
  }

  function renderLoanSummary() {
    const loan = currentLoan();
    const summary = document.getElementById("loanSummary");
    const history = document.getElementById("paymentHistory");
    if (!loan) { summary.innerHTML = ""; history.innerHTML = ""; return; }

    summary.innerHTML = `
      <div>Principal: ${money(loan.loanAmount)}</div>
      <div>Total repayable: ${money(loan.total)}</div>
      <div>Monthly installment: ${money(loan.monthly)}</div>
      <div>Remaining balance: ${money(loan.balance)}</div>
      <div>Status: <span class="badge badge-${loan.status}">${loan.status}</span></div>
    `;

    const payments = loan.payments || [];
    if (payments.length === 0) {
      history.innerHTML = `<p class="record-empty">No payments recorded yet.</p>`;
    } else {
      history.innerHTML = payments.slice().reverse().map(p => `
        <div class="record-item">
          <div>
            <div class="record-main">${money(p.amount)}</div>
            <div class="record-sub">${p.date}</div>
          </div>
        </div>
      `).join("");
    }
  }

  loanSelect.addEventListener("change", renderLoanSummary);

  paymentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const loan = currentLoan();
    if (!loan) { showToast("Select a loan first."); return; }
    const fd = new FormData(paymentForm);
    const amount = Number(fd.get("amountPaid"));
    const date = fd.get("paymentDate");
    if (!amount || amount <= 0) { showToast("Enter a payment amount."); return; }

    loan.payments = loan.payments || [];
    loan.payments.push({ date, amount });
    loan.balance = Math.max(0, Number((loan.balance - amount).toFixed(2)));
    if (loan.balance === 0) loan.status = "completed";

    saveData(state);
    paymentForm.reset();
    showToast("Payment recorded.");
    renderLoanSummary();
    renderRepaymentPage();
    renderDashboard();
    renderHomeStats();
  });

  document.getElementById("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.target.reset();
    showToast("Message sent — NiV will get back to you.");
  });

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  renderCalculator();
  routeFromHash();
  renderHomeStats();
})();

