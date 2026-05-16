# Changelog

## [1.1.0] — 2026-05-17

### Added
- Preserve impersonation in tabs opened from an impersonating tab. Middle-clicking a record, "Open in new tab", and Duplicate Tab now inherit the source tab's impersonation. Each tab keeps an independent rule, so clearing or closing one does not affect the others.
- Show the impersonated user's full name as the toolbar tooltip.
- Color-code the badge per user. A stable hash of the user's Azure AD object ID picks one of six colors, so the same person produces the same color across tabs and sessions.

### Changed
- Clear impersonation automatically when the tab navigates to a different host. Stops the badge and the `CallerObjectId` rule from lingering after the user wanders off to an unrelated site or switches between Dataverse orgs.

## [1.0.0] — Initial public release

Initial release on the Chrome Web Store.