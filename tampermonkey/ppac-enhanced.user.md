# PPAC Known Issues Enhanced

Tampermonkey userscript that injects a productivity side panel into the Power Platform Admin Center Known Issues page.

## Why you might want it
- Persistent side panel that auto-captures the native PPAC search results
- Rich filtering and search (status, solution, age, watched, text)
- Watchlist stored locally so you can follow the issues you care about
- NEW / Updated badges and quick stats so you see changes immediately
- Keyboard navigation, quick-open links, and JSON export for reporting

## Installation (or re-installation after a reset)
1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser of choice.
2. Open the raw script URL: [Install PPAC Known Issues Enhanced](https://raw.githubusercontent.com/jukkan/power-bookmarklets/main/tampermonkey/ppac-enhanced.user.js).
3. Tampermonkey shows a diff of the script. Click **Install** (or **Update** if you already have it).
4. Browse to [https://admin.powerplatform.microsoft.com/support/knownIssues](https://admin.powerplatform.microsoft.com/support/knownIssues) and use the native filters once. The panel button appears at the bottom-right/left and will start capturing the results.

📌 **Need to update later?** Revisit the raw link above or enable auto-update inside Tampermonkey. The script version (`@version` in the header) matches the changelog in git history.

## Usage tips
- Hit `Ctrl+Shift+K` anywhere in PPAC to toggle the panel. Use `P` to flip sides when focused on the panel.
- Star an issue to keep it on your watchlist; the badge on the toggle button lights up when any watched issue appears in the latest fetch.
- Use the JSON export button to grab the currently captured dataset for sharing or importing elsewhere.
- Dismiss the hint bar once per browser profile; it remembers the preference via `localStorage`.

## Screenshot
![PPAC Known Issues Enhanced panel](Tampermonkey%20PPAC%20known%20issues.png)

## Security / scope
- Runs only on `admin.powerplatform.microsoft.com`
- No external network calls (`@grant none`); it only intercepts the existing PPAC fetch/XHR traffic
- All preferences (watchlist, panel position, hint dismissed state) live in `localStorage`
- Source is straightforward JavaScript—feel free to audit [tampermonkey/ppac-enhanced.user.js](ppac-enhanced.user.js) before installing

## License
MIT