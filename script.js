(() => {
  "use strict";

  const STORAGE_KEY = "niv_fund_data_v1";
  const INTEREST_RATE = 0.10;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { applications: [], applicants: [], groups: [] };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.applications)) parsed.applications = [];
      if (!Array.isArray(parsed.applicants)) parsed.applicants = [];
      if (!Array.isArray(parsed.groups)) parsed.groups = [];
      return parsed;
    } catch (e) {
      console.error("Could not read saved data:", e);
      return { applications: [], applicants: [], groups: [] };
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
  function uidApplicant() {
    return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function uidGroup() {
    return "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function money(n) {
    return "GH₵" + Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function computeLoanTerms(amount, duration) {
    const interest = amount * INTEREST_RATE;
    const total = amount + interest;
    const monthly = total / duration;
    return { interest, total, monthly };
  }

  function addMonths(iso, months) {
    const d = new Date(iso);
    d.setMonth(d.getMonth() + Number(months || 0));
    return d.toISOString();
  }

  const GROUP_CAP = 10;

  
  function migrateData() {
    let changed = false;

    if (state.applicants.length === 0 && state.applications.length > 0) {
      const byCard = new Map();
      state.applications.forEach(app => {
        const key = (app.ghanaCard || app.fullName || "").trim().toLowerCase();
        if (!byCard.has(key)) {
          const applicant = {
            id: uidApplicant(),
            fullName: app.fullName,
            phone: app.phone,
            community: app.community,
            ghanaCard: app.ghanaCard,
            business: app.business,
            businessYears: app.businessYears,
            photo: app.photo || null,
            groupId: null,
            createdAt: app.createdAt || app.submittedAt || new Date().toISOString()
          };
          state.applicants.push(applicant);
          byCard.set(key, applicant);
        }
        app.applicantId = byCard.get(key).id;
      });
      changed = true;
    }

    if (state.groups.length === 0 && state.applications.length > 0) {
      const byName = new Map();
      state.applications.forEach(app => {
        const key = (app.groupName || "Unnamed group").trim();
        if (!byName.has(key)) {
          const group = {
            id: uidGroup(),
            name: key,
            memberIds: [],
            returning: !!app.returningGroup,
            createdAt: app.createdAt || new Date().toISOString()
          };
          state.groups.push(group);
          byName.set(key, group);
        }
        const group = byName.get(key);
        app.groupId = group.id;
        const applicant = state.applicants.find(a => a.id === app.applicantId);
        if (applicant) {
          applicant.groupId = group.id;
          if (!group.memberIds.includes(applicant.id) && group.memberIds.length < GROUP_CAP) {
            group.memberIds.push(applicant.id);
          }
        }
      });
      changed = true;
    }


    state.applications.forEach(app => {
      if (app.status === "active" && !app.disbursedAt) {
        app.disbursedAt = app.approvedAt || app.submittedAt || app.createdAt;
        app.dueDate = addMonths(app.disbursedAt, app.loanDuration || 6);
        changed = true;
      }
    });

    if (changed) saveData(state);
  }
  migrateData();

  function findOrCreateApplicant(fields) {
    let applicant = null;
    if (fields.ghanaCard) {
      applicant = state.applicants.find(a => (a.ghanaCard || "").trim().toLowerCase() === fields.ghanaCard.trim().toLowerCase());
    }
    if (!applicant) {
      applicant = {
        id: uidApplicant(),
        fullName: fields.fullName,
        phone: fields.phone,
        community: fields.community,
        ghanaCard: fields.ghanaCard,
        business: fields.business,
        businessYears: fields.businessYears,
        photo: fields.photo || null,
        groupId: null,
        createdAt: new Date().toISOString()
      };
      state.applicants.push(applicant);
    } else {
      Object.assign(applicant, {
        fullName: fields.fullName || applicant.fullName,
        phone: fields.phone || applicant.phone,
        community: fields.community || applicant.community,
        business: fields.business || applicant.business,
        businessYears: fields.businessYears || applicant.businessYears,
        photo: fields.photo || applicant.photo
      });
    }
    return applicant;
  }

  function findOrCreateGroup(name, returning, applicantId) {
    const key = (name || "Unnamed group").trim();
    let group = state.groups.find(g => g.name.trim().toLowerCase() === key.toLowerCase());
    if (!group) {
      group = { id: uidGroup(), name: key, memberIds: [], returning: !!returning, createdAt: new Date().toISOString() };
      state.groups.push(group);
    }
    if (applicantId && !group.memberIds.includes(applicantId) && group.memberIds.length < GROUP_CAP) {
      group.memberIds.push(applicantId);
    }
    const applicant = state.applicants.find(a => a.id === applicantId);
    if (applicant) applicant.groupId = group.id;
    return group;
  }

  function getApplicant(id) { return state.applicants.find(a => a.id === id); }
  function getGroup(id) { return state.groups.find(g => g.id === id); }

  function isOverdue(app) {
    return app.status === "active" && !!app.dueDate && new Date(app.dueDate).getTime() < Date.now() && (app.balance || 0) > 0;
  }
  function displayStatus(app) {
    return isOverdue(app) ? "overdue" : app.status;
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  const ADMIN_SESSION_KEY = "niv_fipa_admin_auth";
  const ADMIN_CREDENTIALS = { username: "Hamza", password: "hamza123" };

  function isAdminAuthenticated() {
    return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
  }

  function setAdminAuthenticated(value) {
    if (value) {
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  function requireAdmin() {
    if (!isAdminAuthenticated()) {
      navigate("admin-login");
      return false;
    }
    return true;
  }

  const routes = ["home", "about", "eligibility", "apply", "calculator", "dashboard", "repayment", "stories", "partners", "contact", "admin-login", "admin-dashboard"];

  function navigate(route) {
    if (!routes.includes(route)) route = "home";
    if (route === "admin-dashboard" && !isAdminAuthenticated()) route = "admin-login";
    if (route === "admin-login" && isAdminAuthenticated()) route = "admin-dashboard";

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
    if (route === "admin-login") renderAdminLogin();
    if (route === "admin-dashboard") renderAdminDashboardPage();
    updateAdminBackLinks();
  }

  function updateAdminBackLinks() {
    const show = isAdminAuthenticated();
    document.querySelectorAll(".admin-back-link").forEach(el => { el.hidden = !show; });
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
    const pending = apps.filter(a => a.status === "pending").length;
    const active = apps.filter(a => a.status === "active").length;
    const completed = apps.filter(a => a.status === "completed").length;

    const el = document.getElementById("homeStats");
    el.innerHTML = `
      <div class="stat-box"><span class="stat-num">${groups}</span><span class="stat-label">Groups supported</span></div>
      <div class="stat-box"><span class="stat-num">${beneficiaries}</span><span class="stat-label">Beneficiaries</span></div>
      <div class="stat-box"><span class="stat-num">${pending}</span><span class="stat-label">Pending review</span></div>
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

    const fullName = fd.get("fullName").trim();
    const phone = fd.get("phone").trim();
    const community = fd.get("community").trim();
    const ghanaCard = fd.get("ghanaCard").trim();
    const business = fd.get("business").trim();
    const businessYears = fd.get("businessYears");
    const groupName = fd.get("groupName").trim();
    const returningGroup = fd.get("returningGroup") === "on";

    const applicant = findOrCreateApplicant({ fullName, phone, community, ghanaCard, business, businessYears, photo: pendingPhotoData });
    const group = findOrCreateGroup(groupName, returningGroup, applicant.id);

    const record = {
      id: uid(),
      applicantId: applicant.id,
      groupId: group.id,
      fullName,
      phone,
      community,
      ghanaCard,
      business,
      businessYears,
      groupName,
      groupSize: fd.get("groupSize"),
      returningGroup,
      photo: pendingPhotoData,
      loanAmount: amount,
      loanDuration: duration,
      assessmentNotes: fd.get("assessmentNotes").trim(),
      businessConfirmed: fd.get("businessConfirmed"),
      status: "pending",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      disbursedAt: null,
      dueDate: null,
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

    showToast(`${record.fullName}'s application is pending review.`);
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
    if (document.getElementById("adminDashGrid") && isAdminAuthenticated()) renderAdminStatCards();
  });

  document.getElementById("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.target.reset();
    showToast("Message sent — NiV will get back to you.");
  });

  function renderAdminLogin() {
    const form = document.getElementById("adminLoginForm");
    if (!form) return;
    form.reset();
  }

  // Tracks whichever admin section is currently on screen so mutating
  // actions (approve, disburse, record payment...) can redraw it in place.
  let currentAdminView = { title: "Application Review", render: () => renderApplicationReviewView() };

  function setAdminView(title, renderFn) {
    currentAdminView = { title, render: renderFn };
    renderAdminSection(title, renderFn());
  }
  function refreshAdminView() {
    renderAdminStatCards();
    if (currentAdminView) renderAdminSection(currentAdminView.title, currentAdminView.render());
  }

  function renderAdminStatCards() {
    const apps = state.applications;
    const pending = apps.filter(a => a.status === "pending").length;
    const approvedAwaiting = apps.filter(a => a.status === "approved").length;
    const active = apps.filter(a => a.status === "active" && !isOverdue(a)).length;
    const overdue = apps.filter(a => isOverdue(a)).length;
    const completed = apps.filter(a => a.status === "completed").length;
    const rejected = apps.filter(a => a.status === "rejected").length;
    const outstanding = apps.filter(a => a.status === "active").reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalPaid = apps.reduce((sum, a) => sum + (a.payments || []).reduce((s, p) => s + p.amount, 0), 0);

    document.getElementById("adminDashGrid").innerHTML = [
      { num: pending, label: "Pending review" },
      { num: approvedAwaiting, label: "Awaiting disbursement" },
      { num: active, label: "Active loans" },
      { num: overdue, label: "Overdue loans" },
      { num: completed, label: "Completed loans" },
      { num: rejected, label: "Rejected" },
      { num: state.groups.length, label: "Groups" },
      { num: state.applicants.length, label: "Registered borrowers" },
      { num: money(outstanding), label: "Outstanding balance" },
      { num: money(totalPaid), label: "Total repayments" }
    ].map(c => `
      <div class="dash-card admin-card-small">
        <span class="dash-num">${c.num}</span>
        <span class="dash-label">${c.label}</span>
      </div>
    `).join("");
  }

  function renderAdminDashboardPage() {
    if (!requireAdmin()) return;
    renderAdminStatCards();
    setAdminView("Application Review", () => renderApplicationReviewView());
    initAdminControls();
  }

  function renderAdminSection(title, html) {
    const content = document.getElementById("adminDashboardContent");
    if (!content) return;
    content.innerHTML = `
      <div class="admin-section">
        <div class="admin-section-header">
          <h2>${title}</h2>
          <div class="admin-section-meta">${state.applications.filter(a => a.status === "pending").length} pending · ${state.applications.filter(a => a.status === "approved").length} awaiting disbursement · ${state.applications.filter(a => isOverdue(a)).length} overdue</div>
        </div>
        <div class="admin-section-body">${html}</div>
      </div>
    `;
    attachAdminTableListeners();
  }

  // ---------------- Application Review ----------------
  function renderApplicationReviewView(filter = "", statusFilter = "all") {
    const apps = state.applications
      .filter(a => statusFilter === "all" || displayStatus(a) === statusFilter)
      .filter(a => {
        const term = filter.trim().toLowerCase();
        return term === "" || [a.fullName, a.groupName, a.business, a.phone, a.ghanaCard]
          .some(field => String(field || "").toLowerCase().includes(term));
      })
      .slice().sort((x, y) => new Date(y.submittedAt) - new Date(x.submittedAt));

    const rows = apps.length === 0
      ? `<p class="record-empty">No applications match the current filter.</p>`
      : `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Group</th>
              <th>Loan</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${apps.map(a => `
              <tr>
                <td>
                  <strong>${escapeHtml(a.fullName)}</strong><br>
                  ${escapeHtml(a.business)}<br>
                  ${escapeHtml(a.community)}
                </td>
                <td>${escapeHtml(a.groupName)}<br><small>${escapeHtml(a.groupSize)} members</small></td>
                <td>${money(a.loanAmount)} / ${a.loanDuration} mo</td>
                <td><span class="badge badge-${displayStatus(a)}">${displayStatus(a)}</span></td>
                <td>${new Date(a.submittedAt).toLocaleDateString()}</td>
                <td class="record-actions">
                  <button class="small-btn" data-action="view" data-id="${a.id}">View</button>
                  ${a.status === "pending" ? `<button class="small-btn" data-action="approve" data-id="${a.id}">Approve</button>` : ""}
                  ${a.status === "pending" ? `<button class="small-btn" data-action="reject" data-id="${a.id}">Reject</button>` : ""}
                  ${a.status === "approved" ? `<button class="small-btn" data-action="disburse" data-id="${a.id}">Disburse</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div class="admin-tab-row">
        <button class="small-btn" id="adminShowNewApplicationBtn">+ New loan application</button>
      </div>
      <div class="admin-filter-row">
        <label>Search applications
          <input type="search" id="adminAppSearch" value="${escapeHtml(filter)}" placeholder="Search by name, group, business...">
        </label>
        <label>Status
          <select id="adminAppStatusFilter">
            <option value="all" ${statusFilter === "all" ? "selected" : ""}>All</option>
            <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending review</option>
            <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>Approved — awaiting disbursement</option>
            <option value="active" ${statusFilter === "active" ? "selected" : ""}>Active</option>
            <option value="overdue" ${statusFilter === "overdue" ? "selected" : ""}>Overdue</option>
            <option value="completed" ${statusFilter === "completed" ? "selected" : ""}>Completed</option>
            <option value="rejected" ${statusFilter === "rejected" ? "selected" : ""}>Rejected</option>
          </select>
        </label>
      </div>
      ${rows}
    `;
  }

  function renderNewApplicationView() {
    if (state.applicants.length === 0) {
      return `<p class="record-empty">No borrowers registered yet. <button class="small-btn" data-action="goto-register">Register an applicant first</button></p>`;
    }
    const applicantOptions = state.applicants.slice().sort((x, y) => x.fullName.localeCompare(y.fullName)).map(p => {
      const group = getGroup(p.groupId);
      return `<option value="${p.id}">${escapeHtml(p.fullName)}${group ? " — " + escapeHtml(group.name) : ""}</option>`;
    }).join("");

    return `
      <form id="newApplicationForm" class="form-grid admin-subform">
        <h3>Create loan application</h3>
        <label>Applicant
          <select name="applicantId" required>${applicantOptions}</select>
        </label>
        <label>Loan amount (GH₵)<input type="number" name="loanAmount" value="500" min="1" required></label>
        <label>Duration (months)<input type="number" name="loanDuration" value="6" min="1" required></label>
        <label>Commitment / punctuality observations<textarea name="assessmentNotes" rows="3"></textarea></label>
        <label>Business existence confirmed
          <select name="businessConfirmed">
            <option value="yes">Yes — visited / verified</option>
            <option value="no">Not yet</option>
          </select>
        </label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Submit for review</button>
          <button type="button" class="small-btn" id="adminCancelNewApplicationBtn">Cancel</button>
        </div>
      </form>
    `;
  }

  function handleNewApplication(form) {
    const fd = new FormData(form);
    const applicant = getApplicant(fd.get("applicantId"));
    if (!applicant) { showToast("Select a valid applicant."); return; }
    const group = getGroup(applicant.groupId);
    const amount = Number(fd.get("loanAmount"));
    const duration = Number(fd.get("loanDuration"));
    const terms = computeLoanTerms(amount, duration);

    const record = {
      id: uid(),
      applicantId: applicant.id,
      groupId: applicant.groupId || null,
      fullName: applicant.fullName,
      phone: applicant.phone,
      community: applicant.community,
      ghanaCard: applicant.ghanaCard,
      business: applicant.business,
      businessYears: applicant.businessYears,
      groupName: group ? group.name : "Unassigned",
      groupSize: group ? group.memberIds.length : 0,
      returningGroup: group ? !!group.returning : false,
      photo: applicant.photo,
      loanAmount: amount,
      loanDuration: duration,
      assessmentNotes: fd.get("assessmentNotes").trim(),
      businessConfirmed: fd.get("businessConfirmed"),
      status: "pending",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      disbursedAt: null,
      dueDate: null,
      interest: terms.interest,
      total: terms.total,
      monthly: terms.monthly,
      balance: terms.total,
      payments: []
    };
    state.applications.push(record);
    saveData(state);
    showToast(`Loan application created for ${applicant.fullName}.`);
    setAdminView("Application Review", () => renderApplicationReviewView());
    renderHomeStats();
  }

  // ---------------- Register Applicant ----------------
  function renderRegisterApplicantView() {
    const openGroups = state.groups.filter(g => g.memberIds.length < GROUP_CAP);
    const groupOptions = openGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${g.memberIds.length}/${GROUP_CAP})</option>`).join("");

    const recent = state.applicants.slice().reverse().slice(0, 10).map(p => {
      const group = getGroup(p.groupId);
      return `
      <div class="record-item">
        <div>
          <div class="record-main">${escapeHtml(p.fullName)}</div>
          <div class="record-sub">${escapeHtml(p.business || "")} · ${escapeHtml(p.phone || "")} · ${group ? escapeHtml(group.name) : "Unassigned"}</div>
        </div>
      </div>`;
    }).join("");

    return `
      <form id="registerApplicantForm" class="form-grid admin-subform">
        <h3>Register a new borrower</h3>
        <fieldset>
          <legend>Personal information</legend>
          <label>Full name<input type="text" name="fullName" required></label>
          <label>Phone number<input type="tel" name="phone" required></label>
          <label>Community / town<input type="text" name="community" required></label>
          <label>Ghana Card number<input type="text" name="ghanaCard" placeholder="GHA-000000000-0" required></label>
        </fieldset>
        <fieldset>
          <legend>Business</legend>
          <label>Type of trade / business<input type="text" name="business" required></label>
          <label>Years in operation<input type="number" name="businessYears" min="0" step="1" required></label>
        </fieldset>
        <fieldset>
          <legend>Group assignment (optional)</legend>
          <label>Assign to existing group
            <select name="groupId">
              <option value="">— None yet —</option>
              ${groupOptions}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Passport photograph</legend>
          <label>Upload photo<input type="file" name="photo" id="registerPhotoInput" accept="image/*"></label>
          <img id="registerPhotoPreview" class="photo-preview" alt="" hidden>
        </fieldset>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Register borrower</button>
        </div>
      </form>
      <h3>Recently registered</h3>
      <div class="record-list">${recent || `<p class="record-empty">No borrowers registered yet.</p>`}</div>
    `;
  }

  let pendingRegisterPhotoData = null;
  function handleRegisterApplicant(form) {
    const fd = new FormData(form);
    const fullName = fd.get("fullName").trim();
    const phone = fd.get("phone").trim();
    const community = fd.get("community").trim();
    const ghanaCard = fd.get("ghanaCard").trim();
    const business = fd.get("business").trim();
    const businessYears = fd.get("businessYears");
    const groupId = fd.get("groupId");

    if (state.applicants.some(a => a.ghanaCard && ghanaCard && a.ghanaCard.trim().toLowerCase() === ghanaCard.trim().toLowerCase())) {
      showToast("A borrower with this Ghana Card is already registered.");
      return;
    }

    const applicant = {
      id: uidApplicant(),
      fullName, phone, community, ghanaCard, business, businessYears,
      photo: pendingRegisterPhotoData,
      groupId: null,
      createdAt: new Date().toISOString()
    };
    state.applicants.push(applicant);

    if (groupId) {
      const group = getGroup(groupId);
      if (group && group.memberIds.length < GROUP_CAP) {
        group.memberIds.push(applicant.id);
        applicant.groupId = group.id;
      }
    }

    saveData(state);
    pendingRegisterPhotoData = null;
    showToast(`${fullName} registered as a borrower.`);
    setAdminView("Register Applicant", () => renderRegisterApplicantView());
  }

  // ---------------- Group Management ----------------
  function renderGroupManagementView() {
    if (state.groups.length === 0) {
      return renderCreateGroupForm() + `<p class="record-empty">No groups created yet.</p>`;
    }
    const rows = state.groups.map(group => {
      const groupApps = state.applications.filter(a => a.groupId === group.id);
      const active = groupApps.filter(a => a.status === "active").length;
      const pending = groupApps.filter(a => a.status === "pending").length;
      const completed = groupApps.filter(a => a.status === "completed").length;
      const totalLoan = groupApps.reduce((sum, a) => sum + (a.loanAmount || 0), 0);
      return `
        <tr>
          <td>${escapeHtml(group.name)}${group.returning ? " <small>(returning)</small>" : ""}</td>
          <td>${group.memberIds.length}/${GROUP_CAP}</td>
          <td>${active}</td>
          <td>${pending}</td>
          <td>${completed}</td>
          <td>${money(totalLoan)}</td>
          <td><button class="small-btn" data-action="manage-group" data-id="${group.id}">Manage</button></td>
        </tr>
      `;
    }).join("");

    return `
      ${renderCreateGroupForm()}
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Members</th>
              <th>Active loans</th>
              <th>Pending review</th>
              <th>Completed loans</th>
              <th>Total requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderCreateGroupForm() {
    return `
      <form id="createGroupForm" class="admin-inline-form admin-subform">
        <label>New group name<input type="text" name="name" required placeholder="e.g. Shishegu Traders"></label>
        <label class="checkbox-row"><input type="checkbox" name="returning"> Returning group</label>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Create group</button></div>
      </form>
    `;
  }

  function handleCreateGroup(form) {
    const fd = new FormData(form);
    const name = fd.get("name").trim();
    if (!name) return;
    if (state.groups.some(g => g.name.trim().toLowerCase() === name.toLowerCase())) {
      showToast("A group with this name already exists.");
      return;
    }
    const group = { id: uidGroup(), name, memberIds: [], returning: fd.get("returning") === "on", createdAt: new Date().toISOString() };
    state.groups.push(group);
    saveData(state);
    showToast(`Group "${name}" created.`);
    setAdminView("Group Management", () => renderGroupManagementView());
  }

  function renderGroupDetailView(groupId) {
    const group = getGroup(groupId);
    if (!group) return `<p class="record-empty">Group not found.</p>`;
    const members = group.memberIds.map(id => getApplicant(id)).filter(Boolean);
    const unassigned = state.applicants.filter(a => !a.groupId && !group.memberIds.includes(a.id));

    const memberPills = members.length === 0
      ? `<p class="record-empty">No members yet.</p>`
      : `<div class="member-pill-list">${members.map(m => `
          <span class="member-pill">${escapeHtml(m.fullName)}
            <button type="button" data-action="remove-member" data-group-id="${group.id}" data-applicant-id="${m.id}" title="Remove from group">&times;</button>
          </span>`).join("")}</div>`;

    const addOptions = unassigned.length === 0
      ? ""
      : `
      <form data-role="add-member-form" data-group-id="${group.id}" class="admin-inline-form">
        <label>Add member
          <select name="applicantId">
            ${unassigned.map(a => `<option value="${a.id}">${escapeHtml(a.fullName)}</option>`).join("")}
          </select>
        </label>
        <div class="form-actions"><button type="submit" class="btn btn-primary" ${group.memberIds.length >= GROUP_CAP ? "disabled" : ""}>Add to group</button></div>
      </form>
    `;

    const groupApps = state.applications.filter(a => a.groupId === group.id);

    return `
      <button class="small-btn" data-action="back-to-groups">&larr; All groups</button>
      <h3 style="margin-top:1rem;">${escapeHtml(group.name)} ${group.returning ? "<small>(returning group)</small>" : ""}</h3>
      <p class="admin-progress">${group.memberIds.length} of ${GROUP_CAP} members</p>
      ${memberPills}
      ${group.memberIds.length >= GROUP_CAP ? `<p class="record-empty">Group is at capacity (${GROUP_CAP}).</p>` : addOptions}
      <div class="strip-divider" aria-hidden="true"></div>
      <h4>Loan applications from this group</h4>
      ${groupApps.length === 0 ? `<p class="record-empty">No loan applications yet.</p>` : `
        <div class="record-list">
          ${groupApps.map(a => `
            <div class="record-item">
              <div>
                <div class="record-main">${escapeHtml(a.fullName)}</div>
                <div class="record-sub">${money(a.loanAmount)} / ${a.loanDuration} mo</div>
              </div>
              <span class="badge badge-${displayStatus(a)}">${displayStatus(a)}</span>
            </div>
          `).join("")}
        </div>
      `}
    `;
  }

  function handleAddMember(form) {
    const groupId = form.dataset.groupId;
    const group = getGroup(groupId);
    const fd = new FormData(form);
    const applicant = getApplicant(fd.get("applicantId"));
    if (!group || !applicant) return;
    if (group.memberIds.length >= GROUP_CAP) { showToast("Group is already full."); return; }
    if (!group.memberIds.includes(applicant.id)) group.memberIds.push(applicant.id);
    applicant.groupId = group.id;
    saveData(state);
    showToast(`${applicant.fullName} added to ${group.name}.`);
    setAdminView(`Group: ${group.name}`, () => renderGroupDetailView(group.id));
  }

  function removeMember(groupId, applicantId) {
    const group = getGroup(groupId);
    if (!group) return;
    group.memberIds = group.memberIds.filter(id => id !== applicantId);
    const applicant = getApplicant(applicantId);
    if (applicant && applicant.groupId === groupId) applicant.groupId = null;
    saveData(state);
    showToast("Member removed from group.");
    setAdminView(`Group: ${group.name}`, () => renderGroupDetailView(group.id));
  }

  // ---------------- Loan Management ----------------
  function renderLoanManagementView(filter = "", statusFilter = "all") {
    const apps = state.applications
      .filter(a => a.status === "approved" || a.status === "active" || a.status === "completed")
      .filter(a => statusFilter === "all" || displayStatus(a) === statusFilter)
      .filter(a => {
        const term = filter.trim().toLowerCase();
        return term === "" || [a.fullName, a.groupName].some(f => String(f || "").toLowerCase().includes(term));
      })
      .slice()
      .sort((x, y) => new Date(y.disbursedAt || y.submittedAt) - new Date(x.disbursedAt || x.submittedAt));

    const rows = apps.length === 0
      ? `<p class="record-empty">No loans match the current filter.</p>`
      : `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Group</th>
              <th>Status</th>
              <th>Principal</th>
              <th>Balance</th>
              <th>Paid</th>
              <th>Disbursed</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${apps.map(a => `
              <tr>
                <td>${escapeHtml(a.fullName)}</td>
                <td>${escapeHtml(a.groupName)}</td>
                <td><span class="badge badge-${displayStatus(a)}">${displayStatus(a)}</span></td>
                <td>${money(a.loanAmount)}</td>
                <td>${money(a.balance)}</td>
                <td>${money((a.payments || []).reduce((sum, p) => sum + p.amount, 0))}</td>
                <td>${a.disbursedAt ? new Date(a.disbursedAt).toLocaleDateString() : "—"}</td>
                <td>${a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</td>
                <td class="record-actions">
                  <button class="small-btn" data-action="view" data-id="${a.id}">View</button>
                  ${a.status === "approved" ? `<button class="small-btn" data-action="disburse" data-id="${a.id}">Disburse</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div class="admin-filter-row">
        <label>Search loans
          <input type="search" id="adminLoanSearch" value="${escapeHtml(filter)}" placeholder="Search by borrower or group...">
        </label>
        <label>Status
          <select id="adminLoanStatusFilter">
            <option value="all" ${statusFilter === "all" ? "selected" : ""}>All</option>
            <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>Awaiting disbursement</option>
            <option value="active" ${statusFilter === "active" ? "selected" : ""}>Active</option>
            <option value="overdue" ${statusFilter === "overdue" ? "selected" : ""}>Overdue</option>
            <option value="completed" ${statusFilter === "completed" ? "selected" : ""}>Completed</option>
          </select>
        </label>
      </div>
      ${rows}
    `;
  }

  // ---------------- Borrower History ----------------
  function renderBorrowerHistoryView(term = "") {
    const q = term.trim().toLowerCase();
    const matches = q === "" ? state.applicants.slice().reverse().slice(0, 20) : state.applicants.filter(a =>
      [a.fullName, a.phone, a.ghanaCard, a.community].some(f => String(f || "").toLowerCase().includes(q))
    );

    const list = matches.length === 0
      ? `<p class="record-empty">No borrowers match that search.</p>`
      : `<div class="record-list">${matches.map(a => {
          const group = getGroup(a.groupId);
          const loans = state.applications.filter(app => app.applicantId === a.id);
          const outstanding = loans.filter(l => l.status === "active").reduce((s, l) => s + (l.balance || 0), 0);
          return `
          <div class="record-item">
            <div>
              <div class="record-main">${escapeHtml(a.fullName)}</div>
              <div class="record-sub">${group ? escapeHtml(group.name) : "Unassigned"} · ${loans.length} loan record(s) · outstanding ${money(outstanding)}</div>
            </div>
            <button class="small-btn" data-action="view-borrower" data-id="${a.id}">View history</button>
          </div>`;
        }).join("")}</div>`;

    return `
      <div class="admin-filter-row">
        <label>Search borrowers
          <input type="search" id="adminBorrowerSearch" value="${escapeHtml(term)}" placeholder="Search by name, phone, Ghana Card, or community...">
        </label>
      </div>
      ${list}
    `;
  }

  function renderBorrowerDetailView(applicantId) {
    const applicant = getApplicant(applicantId);
    if (!applicant) return `<p class="record-empty">Borrower not found.</p>`;
    const group = getGroup(applicant.groupId);
    const loans = state.applications.filter(a => a.applicantId === applicantId)
      .slice().sort((x, y) => new Date(y.submittedAt) - new Date(x.submittedAt));
    const allPayments = loans.flatMap(l => (l.payments || []).map(p => ({ ...p, loanId: l.id })))
      .sort((x, y) => new Date(y.date) - new Date(x.date));
    const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = loans.filter(l => l.status === "active").reduce((s, l) => s + (l.balance || 0), 0);

    return `
      <button class="small-btn" data-action="back-to-borrowers">&larr; All borrowers</button>
      <h3 style="margin-top:1rem;">${escapeHtml(applicant.fullName)}</h3>
      <div class="admin-detail-grid">
        <div><strong>Phone</strong><p>${escapeHtml(applicant.phone)}</p></div>
        <div><strong>Community</strong><p>${escapeHtml(applicant.community)}</p></div>
        <div><strong>Ghana Card</strong><p>${escapeHtml(applicant.ghanaCard)}</p></div>
        <div><strong>Business</strong><p>${escapeHtml(applicant.business)} (${escapeHtml(applicant.businessYears)} yrs)</p></div>
        <div><strong>Group</strong><p>${group ? escapeHtml(group.name) : "Unassigned"}</p></div>
        <div><strong>Registered</strong><p>${new Date(applicant.createdAt).toLocaleDateString()}</p></div>
        <div><strong>Total repaid (all loans)</strong><p>${money(totalPaid)}</p></div>
        <div><strong>Current outstanding</strong><p>${money(outstanding)}</p></div>
      </div>
      <div class="strip-divider" aria-hidden="true"></div>
      <h4>Loan history</h4>
      ${loans.length === 0 ? `<p class="record-empty">No loan applications on file.</p>` : `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Submitted</th><th>Amount</th><th>Status</th><th>Balance</th><th>Disbursed</th><th>Due</th></tr></thead>
            <tbody>
              ${loans.map(l => `
                <tr>
                  <td>${new Date(l.submittedAt).toLocaleDateString()}</td>
                  <td>${money(l.loanAmount)} / ${l.loanDuration} mo</td>
                  <td><span class="badge badge-${displayStatus(l)}">${displayStatus(l)}</span></td>
                  <td>${money(l.balance)}</td>
                  <td>${l.disbursedAt ? new Date(l.disbursedAt).toLocaleDateString() : "—"}</td>
                  <td>${l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
      <h4>Repayment history</h4>
      ${allPayments.length === 0 ? `<p class="record-empty">No repayments recorded yet.</p>` : `
        <div class="record-list">
          ${allPayments.map(p => `
            <div class="record-item">
              <div><div class="record-main">${money(p.amount)}</div><div class="record-sub">${p.date}</div></div>
            </div>
          `).join("")}
        </div>
      `}
    `;
  }

  // ---------------- Reports ----------------
  function renderReportsView() {
    const apps = state.applications;
    const pending = apps.filter(a => a.status === "pending").length;
    const approvedAwaiting = apps.filter(a => a.status === "approved").length;
    const active = apps.filter(a => a.status === "active" && !isOverdue(a)).length;
    const overdue = apps.filter(a => isOverdue(a)).length;
    const rejected = apps.filter(a => a.status === "rejected").length;
    const completed = apps.filter(a => a.status === "completed").length;
    const outstanding = apps.filter(a => a.status === "active").reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalRequested = apps.reduce((sum, a) => sum + (a.loanAmount || 0), 0);
    const totalPaid = apps.reduce((sum, a) => sum + (a.payments || []).reduce((s, p) => s + p.amount, 0), 0);
    const totalDisbursed = apps.filter(a => a.disbursedAt).reduce((sum, a) => sum + (a.loanAmount || 0), 0);

    return `
      <div class="admin-report-grid">
        <div class="report-card"><strong>${apps.length}</strong><span>Total applications</span></div>
        <div class="report-card"><strong>${pending}</strong><span>Pending review</span></div>
        <div class="report-card"><strong>${approvedAwaiting}</strong><span>Awaiting disbursement</span></div>
        <div class="report-card"><strong>${active}</strong><span>Active loans</span></div>
        <div class="report-card"><strong>${overdue}</strong><span>Overdue loans</span></div>
        <div class="report-card"><strong>${completed}</strong><span>Completed loans</span></div>
        <div class="report-card"><strong>${rejected}</strong><span>Rejected</span></div>
        <div class="report-card"><strong>${state.groups.length}</strong><span>Groups</span></div>
        <div class="report-card"><strong>${state.applicants.length}</strong><span>Registered borrowers</span></div>
        <div class="report-card"><strong>${money(totalRequested)}</strong><span>Total requested</span></div>
        <div class="report-card"><strong>${money(totalDisbursed)}</strong><span>Total disbursed</span></div>
        <div class="report-card"><strong>${money(totalPaid)}</strong><span>Total repaid</span></div>
        <div class="report-card"><strong>${money(outstanding)}</strong><span>Outstanding balance</span></div>
      </div>
    `;
  }

  // ---------------- Approve / Reject / Disburse ----------------
  function approveApplication(id) {
    const app = state.applications.find(a => a.id === id);
    if (!app) return;
    app.status = "approved";
    app.approvedAt = new Date().toISOString();
    saveData(state);
    showToast(`${app.fullName}'s application approved — ready for disbursement.`);
    refreshAdminView();
    renderHomeStats();
  }

  function rejectApplication(id) {
    const app = state.applications.find(a => a.id === id);
    if (!app) return;
    app.status = "rejected";
    app.rejectedAt = new Date().toISOString();
    saveData(state);
    showToast(`${app.fullName}'s application rejected.`);
    refreshAdminView();
    renderHomeStats();
  }

  function disburseApplication(id) {
    const app = state.applications.find(a => a.id === id);
    if (!app || app.status !== "approved") return;
    app.status = "active";
    app.disbursedAt = new Date().toISOString();
    app.dueDate = addMonths(app.disbursedAt, app.loanDuration);
    app.balance = app.total;
    saveData(state);
    showToast(`Loan disbursed to ${app.fullName}. Due ${new Date(app.dueDate).toLocaleDateString()}.`);
    refreshAdminView();
    renderHomeStats();
    renderDashboard();
    renderRepaymentPage();
  }

  function viewAdminAction(element) {
    const action = element.dataset.action;
    const id = element.dataset.id;
    if (action === "approve") approveApplication(id);
    if (action === "reject") rejectApplication(id);
    if (action === "disburse") disburseApplication(id);
    if (action === "view") showAdminApplicationDetails(id);
    if (action === "manage-group") setAdminView(`Group: ${getGroup(id).name}`, () => renderGroupDetailView(id));
    if (action === "back-to-groups") setAdminView("Group Management", () => renderGroupManagementView());
    if (action === "remove-member") removeMember(element.dataset.groupId, element.dataset.applicantId);
    if (action === "view-borrower") setAdminView(`History: ${getApplicant(id).fullName}`, () => renderBorrowerDetailView(id));
    if (action === "back-to-borrowers") setAdminView("Borrower History", () => renderBorrowerHistoryView());
    if (action === "goto-register") setAdminView("Register Applicant", () => renderRegisterApplicantView());
  }

  function showAdminApplicationDetails(id) {
    const app = state.applications.find(a => a.id === id);
    if (!app) return;
    const group = getGroup(app.groupId);
    const payments = app.payments || [];
    renderAdminSection("Application Details", `
      <div class="admin-detail-card">
        <h3>${escapeHtml(app.fullName)}</h3>
        <div class="admin-detail-grid">
          <div><strong>Group</strong><p>${escapeHtml(group ? group.name : app.groupName)}</p></div>
          <div><strong>Business</strong><p>${escapeHtml(app.business)}</p></div>
          <div><strong>Phone</strong><p>${escapeHtml(app.phone)}</p></div>
          <div><strong>Community</strong><p>${escapeHtml(app.community)}</p></div>
          <div><strong>Ghana Card</strong><p>${escapeHtml(app.ghanaCard)}</p></div>
          <div><strong>Loan</strong><p>${money(app.loanAmount)} over ${app.loanDuration} months</p></div>
          <div><strong>Interest</strong><p>${money(app.interest)}</p></div>
          <div><strong>Total repayable</strong><p>${money(app.total)}</p></div>
          <div><strong>Balance remaining</strong><p>${money(app.balance)}</p></div>
          <div><strong>Status</strong><p><span class="badge badge-${displayStatus(app)}">${displayStatus(app)}</span></p></div>
          <div><strong>Submitted</strong><p>${new Date(app.submittedAt).toLocaleDateString()}</p></div>
          <div><strong>Disbursed</strong><p>${app.disbursedAt ? new Date(app.disbursedAt).toLocaleDateString() : "Not yet disbursed"}</p></div>
          <div><strong>Due date</strong><p>${app.dueDate ? new Date(app.dueDate).toLocaleDateString() : "—"}</p></div>
        </div>
        <div class="admin-detail-notes">
          <h4>Assessment notes</h4>
          <p>${escapeHtml(app.assessmentNotes || "—")}</p>
        </div>
        <div class="admin-detail-notes">
          <h4>Payment history (${payments.length})</h4>
          ${payments.length === 0 ? `<p class="record-empty">No repayments recorded yet.</p>` : `
            <div class="record-list">
              ${payments.slice().reverse().map(p => `<div class="record-item"><div><div class="record-main">${money(p.amount)}</div><div class="record-sub">${p.date}</div></div></div>`).join("")}
            </div>
          `}
        </div>
        <div class="admin-detail-actions">
          ${app.status === "pending" ? `<button class="small-btn" data-action="approve" data-id="${app.id}">Approve</button> <button class="small-btn" data-action="reject" data-id="${app.id}">Reject</button>` : ""}
          ${app.status === "approved" ? `<button class="small-btn" data-action="disburse" data-id="${app.id}">Disburse loan</button>` : ""}
          <button class="small-btn" id="adminBackToReview">Back to review</button>
        </div>
      </div>
    `);
  }

  function initAdminControls() {
    const appBtn = document.getElementById("viewApplicationsBtn");
    const registerBtn = document.getElementById("registerApplicantBtn");
    const groupBtn = document.getElementById("viewGroupsBtn");
    const loanBtn = document.getElementById("viewLoansBtn");
    const repaymentBtn = document.getElementById("repaymentTrackingBtn");
    const borrowerBtn = document.getElementById("borrowerHistoryBtn");
    const reportBtn = document.getElementById("viewReportsBtn");
    const logoutBtn = document.getElementById("adminLogoutBtn");

    if (appBtn) appBtn.onclick = () => setAdminView("Application Review", () => renderApplicationReviewView());
    if (registerBtn) registerBtn.onclick = () => setAdminView("Register Applicant", () => renderRegisterApplicantView());
    if (groupBtn) groupBtn.onclick = () => setAdminView("Group Management", () => renderGroupManagementView());
    if (loanBtn) loanBtn.onclick = () => setAdminView("Loan Management", () => renderLoanManagementView());
    if (repaymentBtn) repaymentBtn.onclick = () => { window.location.hash = "#repayment"; };
    if (borrowerBtn) borrowerBtn.onclick = () => setAdminView("Borrower History", () => renderBorrowerHistoryView());
    if (reportBtn) reportBtn.onclick = () => setAdminView("Reports & Statistics", () => renderReportsView());
    if (logoutBtn) logoutBtn.onclick = () => {
      setAdminAuthenticated(false);
      navigate("admin-login");
      showToast("Admin logged out.");
    };
  }

  function attachAdminTableListeners() {
    const content = document.getElementById("adminDashboardContent");
    if (!content) return;
    content.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => viewAdminAction(btn));
    });

    const appSearch = document.getElementById("adminAppSearch");
    const appStatus = document.getElementById("adminAppStatusFilter");
    if (appSearch && appStatus) {
      appSearch.addEventListener("input", () => setAdminView("Application Review", () => renderApplicationReviewView(appSearch.value, appStatus.value)));
      appStatus.addEventListener("change", () => setAdminView("Application Review", () => renderApplicationReviewView(appSearch.value, appStatus.value)));
    }

    const loanSearch = document.getElementById("adminLoanSearch");
    const loanStatus = document.getElementById("adminLoanStatusFilter");
    if (loanSearch && loanStatus) {
      loanSearch.addEventListener("input", () => setAdminView("Loan Management", () => renderLoanManagementView(loanSearch.value, loanStatus.value)));
      loanStatus.addEventListener("change", () => setAdminView("Loan Management", () => renderLoanManagementView(loanSearch.value, loanStatus.value)));
    }

    const borrowerSearch = document.getElementById("adminBorrowerSearch");
    if (borrowerSearch) {
      borrowerSearch.addEventListener("input", () => setAdminView("Borrower History", () => renderBorrowerHistoryView(borrowerSearch.value)));
    }

    const newAppBtn = document.getElementById("adminShowNewApplicationBtn");
    if (newAppBtn) newAppBtn.addEventListener("click", () => setAdminView("New Loan Application", () => renderNewApplicationView()));
    const cancelNewAppBtn = document.getElementById("adminCancelNewApplicationBtn");
    if (cancelNewAppBtn) cancelNewAppBtn.addEventListener("click", () => setAdminView("Application Review", () => renderApplicationReviewView()));

    const back = document.getElementById("adminBackToReview");
    if (back) back.addEventListener("click", () => setAdminView("Application Review", () => renderApplicationReviewView()));

    const registerPhotoInput = document.getElementById("registerPhotoInput");
    if (registerPhotoInput) {
      registerPhotoInput.addEventListener("change", () => {
        const file = registerPhotoInput.files[0];
        const preview = document.getElementById("registerPhotoPreview");
        if (!file) { pendingRegisterPhotoData = null; if (preview) preview.hidden = true; return; }
        const reader = new FileReader();
        reader.onload = () => {
          pendingRegisterPhotoData = reader.result;
          if (preview) { preview.src = pendingRegisterPhotoData; preview.hidden = false; }
        };
        reader.readAsDataURL(file);
      });
    }
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("button[data-action]")) {
      viewAdminAction(target);
    }
    if (target.id === "adminBackToReview") {
      setAdminView("Application Review", () => renderApplicationReviewView());
    }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "registerApplicantForm") { e.preventDefault(); handleRegisterApplicant(form); }
    else if (form.id === "createGroupForm") { e.preventDefault(); handleCreateGroup(form); }
    else if (form.id === "newApplicationForm") { e.preventDefault(); handleNewApplication(form); }
    else if (form.dataset.role === "add-member-form") { e.preventDefault(); handleAddMember(form); }
  });

  document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const username = fd.get("username").trim();
    const password = fd.get("password").trim();
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      setAdminAuthenticated(true);
      navigate("admin-dashboard");
      showToast("Admin logged in.");
      initAdminControls();
      return;
    }
    showToast("Invalid credentials.");
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