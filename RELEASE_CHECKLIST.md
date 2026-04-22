# Phase 8 Release Checklist

## Automated Gates

- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run dist:win`
- [ ] Confirm `dist/Snowflake-<version>-setup-x64.exe` exists
- [ ] Confirm `dist/win-unpacked/` exists for unpacked smoke checks

## Install / Launch

- [ ] Run the generated installer on Windows
- [ ] Confirm the app launches from the installed shortcut
- [ ] Confirm first launch creates the local data directory without errors
- [ ] Confirm app restart works and the window can open again after a full quit

## Core Navigation

- [ ] Open `任务管理` and confirm the page loads without runtime errors
- [ ] Open `日记归总` and confirm the page loads without runtime errors
- [ ] Open `统计图表` and confirm analytics data loads for the default date range
- [ ] Open `应用设置` and confirm settings load successfully

## Theme / Settings

- [ ] Switch theme from settings and confirm the current page updates immediately
- [ ] Navigate across pages and confirm the selected theme persists in-session
- [ ] Restart the app and confirm the last saved theme is restored
- [ ] Change language / auto-save interval / title bar preference and confirm settings save feedback appears

## Tasks / Time Tracking

- [ ] Create a task with category, priority and estimate
- [ ] Update task status from `todo` to `in_progress` to `done`
- [ ] Add / toggle / remove checklist items
- [ ] Start a timer, stop it, and confirm `actualMinutes` / time logs update
- [ ] Archive a task and confirm archived tasks remain read-only

## Journal

- [ ] Create a daily journal entry
- [ ] Create a note entry
- [ ] Link completed tasks by date and confirm references display correctly
- [ ] Delete and restore a journal entry

## Analytics

- [ ] Confirm summary cards load
- [ ] Switch between preset ranges and confirm data refreshes
- [ ] Verify chart interactions do not produce visible UI errors
- [ ] Confirm empty or low-data states remain readable

## Import / Export / Backup

- [ ] Export a `.snowflake` package
- [ ] Export a JSON snapshot
- [ ] Create a backup snapshot
- [ ] Trigger an import and confirm success feedback
- [ ] Cancel an import / export dialog and confirm the app shows a safe error message instead of crashing

## Stability / Edge Cases

- [ ] Verify the app behaves correctly with empty data on a fresh install
- [ ] Verify an IPC failure path surfaces an error banner or inline feedback
- [ ] Verify storage path changes still leave the app in a usable state
- [ ] Verify there are no obvious layout regressions under all built-in themes

## Release Notes

- Build tested on:
- Installer path:
- Smoke test result:
- Known issues:
