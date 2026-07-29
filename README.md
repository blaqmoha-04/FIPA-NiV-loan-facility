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

- **Loan application form** — captures applicant, group, and business details; computes loan
  terms on submit
- **Repayment calculator** — live sliders for amount and duration; shows interest (flat 10%),
  total repayable, and monthly installment
- **Dashboard** — aggregate stats (groups, beneficiaries, active/completed loans) and a
  paid-vs-remaining balance view
- **Repayment tracker** — per-loan payment history and balance
- **Impact Stories** — photo gallery of field visits, disbursements, and repayments

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
