# FIPA Fund — Loan Tracker

A single-page site for NiV's Social Credit Facility (FIPA Fund), built for tracking group loan
applications, repayments, and impact stories in Northern Ghana. Pure HTML/CSS/JS — no build
step, no backend. Data is saved to the browser's `localStorage`.

## Files

| File | Purpose |
|---|---|
| `index.html` | All page markup (Home, About, Eligibility, Apply, Calculator, Dashboard, Repayment, Stories, Partners, Contact) |
| `style.css` | All styling, including mobile/desktop responsive rules |
| `script.js` | App logic — routing, loan calculations, form handling, localStorage persistence |
| `NiV-Logo.png` | Site logo (topbar/footer) |
| `image.png` | Hero section background image |
| `YCI.png`, `gha.png`, `British_Council.png` | Partner logos |
| `IMG-20260728-WA00*.jpg` | Field photos used on the Impact Stories page |

All files must stay in the **same folder** — the HTML references the CSS, JS, and images by
relative filename.

## Running it

No install needed. Just open `index.html` in a browser (double-click it, or drag it into a
browser window). For nicer local testing, you can also serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Core features

**Public / frontend prototype**
- **Loan application form** — submits an applicant into **Pending Review** (no automatic
  approval); computes loan terms on submit
- **Repayment calculator** — live sliders for amount and duration; shows interest (flat 10%),
  total repayable, and monthly installment
- **Dashboard** — aggregate stats and a paid-vs-remaining balance view (prototype page, not
  linked from the public nav — reachable only from the Admin Panel)
- **Repayment tracker** — per-loan payment history and balance (prototype page, not linked from
  the public nav — reachable only from the Admin Panel)
- **Impact Stories** — photo gallery of field visits, disbursements, and repayments

**FIPA Loan Facility Admin Panel** (`#admin-login` → `#admin-dashboard`, staff only)
- **Admin Login** — gated behind a session flag in `localStorage`; nothing admin-only is
  reachable without logging in
- **Register Applicant** — enter a borrower's details independent of any loan application
- **Group Management** — create groups, add/remove members (capped at 10), see per-group loan
  totals; each group has a detail view listing its members and applications
- **Application Review** — search/filter by status (pending, approved, active, overdue,
  completed, rejected); **Approve** or **Reject** pending applications; staff can also start a
  loan application directly for a registered borrower ("+ New loan application")
- **Loan Management** — after approval, a loan sits as *awaiting disbursement* until staff click
  **Disburse**, which sets the disbursement date, due date, and starting balance
- **Repayment Tracking** — record monthly payments against any active loan and see the running
  balance
- **Borrower History** — search borrowers and view their full loan and repayment history across
  every application they've had
- **Reports & Statistics** — totals for applications, disbursed/outstanding amounts, and loan
  status breakdown, including automatically-flagged **overdue** loans (active loans past their
  due date with a remaining balance)

Applications move through: `pending` → `approved` → `active` (disbursed) → `completed`, with
`rejected` as a terminal state from `pending`, and `overdue` as a computed status shown whenever
an active loan's due date has passed and a balance remains.

## Data storage

All application and repayment data is stored in the browser's `localStorage` under the key
`niv_fund_data_v1`. This means:
- Data is local to one browser/device — it doesn't sync anywhere
- Clearing browser storage will erase all saved applications and payments
- There is no server, so this is best suited for demos, prototypes, or single-device use

## Also available: single-file version

`index-single.html` (if included) is the same app with the CSS, JS, and every image inlined
into one `.html` file — useful for sharing a single file, at the cost of a larger file size
(~14 MB, since images are base64-embedded).

## Notes

- The "Interest rate" (`INTEREST_RATE` in `script.js`, currently `0.10`) is a flat rate applied
  to the principal — adjust it there if the terms change.
- Photo captions on the Stories page are general descriptions, not sourced quotes — swap in real
  names/stories if you have them.
- Field photos show real, identifiable people; confirm you have consent to publish them before
  going live.