# PowerApps Impersonation

A Chrome extension that lets Dynamics 365 / Power Platform administrators impersonate any Dataverse user directly in the browser — without leaving the app or switching accounts.

## What it does

When you open a canvas app on `apps.powerapps.com` or a model-driven app on a `.dynamics.com` environment, the extension detects the Dataverse org and checks whether your account has the **Act on Behalf of Another User** (`prvActOnBehalfOfAnotherUser`) privilege.

If you have the privilege, you can search for any user in the org by name or email and activate impersonation with one click. The extension injects a `CallerObjectId` header into every Dataverse API request for that tab, causing the platform to evaluate all data access, row-level security, and business rules as the selected user.

Impersonation is per-tab and per-session — closing the tab or the browser removes it automatically.

## Requirements

- Google Chrome (or a Chromium-based browser that supports Manifest V3)
- A Dynamics 365 / Dataverse account with the **Act on Behalf of Another User** security privilege

## Install from the Chrome Web Store

[Install PowerApps Impersonation](https://chromewebstore.google.com/detail/powerapps-impersonation/hgmpeffocfpollhopcfckiedjfnbkpnd)

## Build from source

```bash
npm install
npm run build
```

The extension is written in React + TypeScript and bundled with Vite. The build output is placed in `dist/`.

To load it unpacked in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

To watch for changes during development:

```bash
npm run dev
```

## Project structure

```
src/
  background.ts       # Service worker: state management, DNR rules, Dataverse API calls
  types.ts            # Shared TypeScript types
  popup/
    App.tsx           # Popup UI (React)
    popup.css         # Popup styles
    main.tsx          # React entry point
    index.html        # Popup shell
public/
  icons/              # Extension icons (16, 48, 128 px)
scripts/
  generate-icons.mjs  # Generates PNG icons from icon.svg using sharp
manifest.json
```

## How impersonation works

The extension uses Chrome's [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) API to add a `CallerObjectId` request header containing the selected user's Azure AD Object ID to every `api/data/v*` request made by the active tab. This is the standard Dataverse impersonation mechanism documented by Microsoft.

No credentials are stored. The extension reuses the browser's existing authenticated session — the same cookies Chrome already holds for your Dynamics login.

## Permissions

| Permission | Why |
|---|---|
| `webRequest` | Detect the first Dataverse API call to identify the org URL |
| `declarativeNetRequestWithHostAccess` | Inject the `CallerObjectId` header into API requests |
| `storage` | Persist impersonation state across service worker restarts |
| `tabs` | Read the active tab's URL to validate the page and reload after toggling impersonation |
| `*://apps.powerapps.com/*` | Canvas app player |
| `*://*.dynamics.com/*` | Model-driven apps and Dataverse API |

## License

[MIT](LICENSE)