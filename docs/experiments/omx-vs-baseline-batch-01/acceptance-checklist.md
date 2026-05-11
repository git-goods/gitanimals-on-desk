# Settings Panel React Migration Acceptance

Use this checklist for both `baseline` and `with-omx`.

## Scope Boundary

- Migrate the settings panel renderer to a React-managed JSX or TSX implementation.
- Preserve the existing preload bridge contract unless a compatibility-safe change is required.
- Keep the visible settings behavior unchanged unless the task manifest explicitly allows a UX change.

## Required Outcomes

- The settings window still loads from `src/settings/settings.html`.
- The UI rendering logic is owned by React components rather than one large ad hoc renderer script.
- The new renderer keeps parity for existing tabs: `general`, `agents`, `theme`, `about`.
- Existing settings IPC flows still work through `window.settingsAPI`.
- Existing settings tests continue to pass unless replaced by stricter equivalents.

## Recommended Technical Direction

- Prefer `tsx` for the new renderer if the branch introduces TypeScript-managed React UI.
- If a build step is needed, keep it minimal and repository-local.
- Reuse the existing vendor React path only if it does not block maintainability or testability.
- Do not expand the experiment into a full design-system rewrite.

## Verification Checklist

- `npm test`
- `npm run typecheck`
- Any new settings-panel specific tests added by the harness branch

## Review Questions

- Is the renderer split into understandable components or modules?
- Did the branch reduce direct DOM orchestration compared to the current `renderer.js`?
- Is the settings bridge contract still stable for the renderer?
- Did the branch avoid unrelated settings/store/controller refactors unless required for the migration?
