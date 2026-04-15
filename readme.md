# Verita School Eco Team — Recycling Dashboard

A real-time recycling data dashboard powered by Google Sheets.

## Quick Start

1. Open `index.html` in your browser — it works with demo data out of the box
2. To connect your own data, click **⚙️ Settings** and paste your Google Sheet ID

## Google Sheet Setup

### Step 1: Create the Sheet

Create a new Google Sheet with these exact column headers in Row 1:

| Date | Class | Paper (kg) |
|------|-------|------------|
| 2026-04-15 | Grade 5A | 3.5 |

- **Date** — format: YYYY-MM-DD
- **Class** — class/grade name (e.g. "Grade 5A")
- **Paper (kg)** — weight of paper recycled in kilograms

### Step 2: Share the Sheet

1. Open your Google Sheet
2. Click **Share** (top-right)
3. Under "General access", change to **"Anyone with the link"**
4. Set permission to **"Viewer"**
5. Click **Done**

### Step 3: Get the Sheet ID

Your Sheet URL looks like:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
```
The Sheet ID is the long string between `/d/` and `/edit`:
```
1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

### Step 4: Connect to Dashboard

1. Open the dashboard
2. Click **⚙️ Settings**
3. Paste the Sheet ID
4. Click **🔗 Test Connection** to verify
5. Click **💾 Save & Load**

## Features

- 📊 Total recycling stats with animated counters
- 📈 Weekly/monthly trend charts (stacked bar)
- 🍩 Material breakdown donut chart
- 🏆 Class leaderboard with medals
- 🎯 School goal tracker with progress ring
- ⚙️ Settings panel to connect Google Sheet
- 📱 Fully responsive (mobile, tablet, desktop)
- 🎨 Premium dark eco theme

## Tech Stack

- HTML5 / CSS3 / Vanilla JS (zero build step)
- [Chart.js](https://www.chartjs.org/) — charts
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- Google Sheets (public CSV endpoint) — data source
