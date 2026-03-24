# Power Apps Checker Formula Export

Tampermonkey userscript that intercepts Power Apps Studio authoring API traffic and extracts formula diagnostics, scripts, performance findings, and accessibility results — with one-click export for AI coding agents.

## Why you might want it

The official Power Apps Checker API does not expose formula-level evaluation results for canvas apps. The Studio runs that evaluation client-side during authoring, but the results never surface in any public API. This script fills that gap by tapping the internal invoke API calls the Studio already makes, giving you:

- **Semantic formula errors** — type mismatches, missing columns, invalid `Patch` arguments, unrecognised names. This is the data that matters most when prompting an AI coding agent to fix a broken app.
- **Delegation warnings with precise character offsets** — not just "this formula has a delegation issue" but exactly which characters (e.g. positions 361–362) triggered the warning.
- **The formula source text itself** — the actual Power Fx script attached to each flagged property, ready to paste into a coding agent prompt without manual copy-pasting from the Studio editor.
- **Performance findings** — `InefficientDelayLoading`, concurrency issues, and other best-practice violations surfaced by the Studio checker.
- **Accessibility issues** — grouped by type and control, with fix guidance.

![Power Apps Checker formula export in action](Power%20Apps%20Checker%20formula%20export%20Tampermonkey.png)

## Installation (or re-installation after a reset)

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser of choice.
2. Open the raw script URL: [Install Power Apps Checker formula export](https://raw.githubusercontent.com/jukkan/power-bookmarklets/main/tampermonkey/Power%20Apps%20Checker%20formula%20export.user.js).
3. Tampermonkey shows a diff of the script. Click **Install** (or **Update** if you already have it).
4. Open any canvas app in [Power Apps Studio](https://make.powerapps.com). Open the **Formulas / App Checker** panel inside Studio so it runs its checks. The export panel appears automatically at the bottom-right of the screen once results are captured.

📌 **Need to update later?** Revisit the raw link above or enable auto-update in Tampermonkey. The `@version` in the script header matches the changelog in git history.

## Export formats

| Button | Format | Best for |
|--------|--------|----------|
| **Copilot** | Compact plain-text | Pasting directly into GitHub Copilot, Claude, or any AI coding agent |
| **Markdown** | Full structured report | Documentation, issue trackers, pull-request comments |
| **JSON** | Structured data | Programmatic processing, building your own tooling |
| **Save** | JSON file download | Offline archiving, sharing with teammates |

### Copilot format example

```
Power Apps Studio checker results for the current canvas app.
Please fix the corresponding Power Fx formulas in the pa.yaml source.

ERRORS (must fix):
  Reserve A Spot.OnVisible: Incompatible types for comparison.
    Fix: Convert the value to be the same type.
    At chars 156-157
  Reserve A Spot.OnVisible: Name isn't valid. 'Users_' isn't recognized.
    Fix: Remove or correct the reference to the name that isn't valid.
    At chars 526-532
```

### Console API

The script also exposes a `paChecker` object in the browser console for scripted access:

```js
paChecker.copilot()   // returns + logs the compact text
paChecker.markdown()  // returns + logs the full Markdown report
paChecker.json()      // returns the structured JSON string
paChecker.show()      // re-opens the floating panel if dismissed
paChecker.load(arr)   // replays a previously captured raw payload
```

## How it works

The script patches `window.fetch` and `XMLHttpRequest.prototype.send` at `document-start` (before any app code runs). It watches for responses from the Studio's `/api/v1/invoke` and `/api/v2/invoke` endpoints, which carry the checker results as JSON. It then:

1. Walks the response tree for `RuleErrorEvent` objects (formula diagnostics).
2. Scans flat `prop:*:script` / `prop:*:hasErrorsOrWarnings` keys to extract the source text for each flagged property.
3. Detects accessibility results (objects with `accessibilityTypes`) and performance results (objects with `ruleName`).
4. Normalises everything into a clean in-memory state and surfaces the export panel.

No data ever leaves the browser. The script has `@grant none` and makes zero external network calls.

## Security / scope

- Runs on `make.powerapps.com` and the Studio gateway domains (`*.gateway.*.island.powerapps.com`).
- No external network calls (`@grant none`); it only reads responses from API calls the Studio already makes.
- Nothing is stored between sessions — state lives only in memory for the lifetime of the Studio tab.
- Source is straightforward JavaScript — audit [Power Apps Checker formula export.user.js](Power%20Apps%20Checker%20formula%20export.user.js) before installing.

## Limitations

- Requires the Studio to perform a checker run (open the Formulas / App Checker panel) while the script is active. It cannot retroactively fetch results from before the page loaded.
- Formula scripts are only captured for properties the Studio marks as `hasErrorsOrWarnings: true`. Clean properties are not included.
- The internal API shape may change with Studio updates. If the panel stops appearing, check the browser console for `[PA-Checker]` log messages.

## License

MIT
