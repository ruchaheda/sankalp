# Sankalp Apps Script proof of concept

This project is deliberately test-only. The server refuses to create resources or
accept submissions unless the `ENVIRONMENT` script property is exactly `test`.
It never reads the existing production Form or spreadsheet configuration.

## Create the isolated test project

1. Create a new standalone Apps Script project at `script.google.com`.
2. Add the files in this directory to that project:
   - `Code.gs`
   - `Index.html`
   - `appsscript.json` (enable "Show appsscript.json" in Project Settings)
3. In Project Settings, add these script properties:
   - `ENVIRONMENT`: `test`
   - `PROFILE_MKSM_NUMBER`
   - `PROFILE_FIRST_NAME`
   - `PROFILE_LAST_NAME`
   - `PROFILE_EMAIL`
   - `PROFILE_BATCH_NAME`
4. Run `setupTestResources` once from the Apps Script editor and approve the
   requested Form and Spreadsheet permissions.
5. Open the execution log and copy the returned test Form and Sheet URLs.
6. Deploy the project as a web app:
   - Execute as: **Me**
   - Who has access: **Only myself**
7. Open the deployment URL while signed into the same Google account.

`setupTestResources` saves `TEST_FORM_ID` and `TEST_SPREADSHEET_ID` as script
properties. It refuses to create another pair while either property exists.

## Rebuild the React UI

Run:

```sh
npm run build:apps-script
```

This produces a regular Vite build and then inlines its JavaScript and CSS into
`appsscript/Index.html`, because an Apps Script web app cannot serve Vite's
separate static asset files.

After rebuilding, update `Index.html` in the Apps Script project and create a new
web-app deployment version.

## Test cases

1. Submit one normal practice session.
2. Confirm one Form response and one `Sessions` row with status `COMPLETE`.
3. Call `submitPractice` twice with the same `submissionId`; confirm there is
   still only one Form response and one Sheet row.
4. Temporarily change `TEST_FORM_ID` to an invalid value and confirm the Sheet
   records `FAILED`.
5. Restore the ID and submit a new session.
6. Set `ENVIRONMENT` to anything other than `test` and confirm submission stops
   before either resource is touched.

## Production rollout

The production Form schema has now been captured in `FORM_SCHEMA.md`.

The Apps Script owner only has submission access to the production Form.
Therefore, the production adapter posts to the public `formResponse` endpoint
with `UrlFetchApp`. The disposable test adapter continues to use `FormApp`.

Keep `ENVIRONMENT=test` while configuring production. Add these Script
Properties:

- `PRODUCTION_FORM_ACTION_URL`
- `PRODUCTION_SPREADSHEET_ID`
- `PRODUCTION_SHEET_NAME`
- `PRODUCTION_SUBMISSIONS_ENABLED`: `false`

Run `checkProductionConfiguration` from the Apps Script editor. It is read-only:
it checks the Form URL shape, profile properties, spreadsheet access, target
sheet name, the `Form Submitted?` header in H2, and checkbox validation beginning
at H3 without submitting the Form or writing to the spreadsheet.

After the updated code is deployed and the configuration check succeeds:

1. Change `ENVIRONMENT` to `production`.
2. Leave `PRODUCTION_SUBMISSIONS_ENABLED` as `false` until ready.
3. Change `PRODUCTION_SUBMISSIONS_ENABLED` to `true` immediately before logging
   the next genuine practice session.

The production session tab receives these eight values in one append operation:

`Date, Minutes, What Practiced, Sankalp, Raag, Omkar Time, Alankar Time, Form Submitted?`

The Form is attempted first. The checkbox is checked for a confirmed Form
submission, unchecked for a definite failure, and blank for an unknown outcome.
If the spreadsheet append fails, the script sends a recovery email to
`ALERT_EMAIL`, falling back to `PROFILE_EMAIL`.
