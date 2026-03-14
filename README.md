# TrialTrack

**Agricultural Field Trial Management Platform**

TrialTrack is a professional, enterprise-grade agricultural field trial management and data collection platform. It digitizes the manual Excel-based process of tracking biochar soil treatment trials across multiple farm fields in Ghana.

## Features

- **Field Worker Mobile View**: Simple, fast data entry on mobile devices
- **Admin Dashboard**: Power BI-style analytics with KPIs, field overview, and activity feeds
- **Analytics Charts**: Treatment comparison, trend lines, heatmaps, and more
- **User Management**: Role-based access control (superadmin, admin, viewer, user)
- **Field Management**: Create fields with auto-seeded plot layouts
- **Data Export**: CSV exports for raw data, summaries, and reports

## Tech Stack

- **Frontend**: Vanilla HTML + CSS + JavaScript (no frameworks, no build tools)
- **Database**: Supabase (PostgreSQL)
- **Charts**: Chart.js
- **Fonts**: DM Serif Display + DM Sans
- **Hosting**: GitHub Pages (static)

## Quick Start

1. Open `index.html` in a browser, or deploy to GitHub Pages
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Create a field in the Admin panel
4. Start collecting data!

## User Roles

| Role | Permissions |
|------|-------------|
| Superadmin | Everything - all fields, all users, all settings |
| Admin | Manage one assigned field, view analytics |
| Viewer | View analytics and data for assigned field |
| User | Data entry only for assigned field |

## Treatment Codes

| Code | Full Name |
|------|-----------|
| I | Inorganic Only |
| B | Biochar Only |
| O | Organic Only |
| OI | Organic + Inorganic |
| BO | Biochar + Organic |
| BI | Biochar + Inorganic |

## File Structure

```
trialtrack/
├── index.html              # Login page
├── dashboard.html          # Admin dashboard
├── field-worker.html       # Mobile data entry
├── analytics.html          # Charts and analytics
├── admin.html              # User & field management
├── assets/
│   ├── css/
│   │   ├── base.css        # Design tokens, reset
│   │   ├── components.css  # UI components
│   │   ├── dashboard.css   # Desktop layout
│   │   ├── mobile.css      # Mobile styles
│   │   └── charts.css      # Chart containers
│   ├── js/
│   │   ├── config.js       # Supabase config, constants
│   │   ├── auth.js         # Authentication
│   │   ├── api.js          # Supabase API calls
│   │   ├── utils.js        # Helper functions
│   │   ├── charts.js       # Chart.js wrappers
│   │   ├── dashboard.js    # Dashboard logic
│   │   ├── entry.js        # Data entry logic
│   │   ├── analytics.js    # Analytics logic
│   │   ├── admin.js        # Admin panel logic
│   │   └── export.js       # CSV exports
│   └── img/
│       └── logo.svg        # TrialTrack logo
└── README.md
```

## Deployment to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to Settings → Pages
3. Select "Deploy from a branch"
4. Choose `main` branch, root folder
5. Your site will be live at `https://[username].github.io/[repo-name]/`

## Security Notes

- The Supabase anon key is safe to expose in frontend code
- Session stored in `sessionStorage` (clears on tab close)
- All inputs sanitized before database calls
- Role checks on every protected page
- Login rate limiting (5 attempts → 15 min lockout)

## Configuration

Default settings can be modified in `config.js`:
- Measurement interval: 14 days
- Tolerance window: 3 days
- Max login attempts: 5
- Lockout duration: 15 minutes

## License

MIT License - Free for agricultural research use.

---

Built with ❤️ for agricultural researchers in Ghana.
