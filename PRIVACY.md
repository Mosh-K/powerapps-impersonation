# Privacy Policy

**PowerApps Impersonation** is a Chrome extension that helps Dynamics 365 administrators impersonate Dataverse users within their own organization.

## Data collected

This extension does not collect, store, or transmit any personal data to external servers.

## How it works

- When you open a canvas app or model-driven app, the extension detects the Dataverse organization URL from network requests made by that tab.
- It calls your organization's Dataverse API (using the browser's existing authenticated session) to check whether your account has the impersonation privilege and to search for users by name or email.
- All API calls go directly from your browser to your organization's Dynamics 365 / Dataverse environment. No data passes through any server operated by this extension's author.

## Data stored locally

The extension stores impersonation state (the selected user's name, email, and Azure AD Object ID, and the organization URL) in `chrome.storage.session`. This data exists only for the duration of the browser session and is automatically cleared when the tab is closed or the browser exits.

## Third parties

No data is shared with any third party. No analytics, crash reporting, or telemetry of any kind is included.

## Permissions

The extension requests only the permissions necessary for its function. See the [README](README.md) for a full explanation of each permission.

## Contact

For questions or concerns, open an issue on the [GitHub repository](https://github.com/Mosh-K/powerapps-impersonation).