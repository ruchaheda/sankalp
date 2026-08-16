# Production Form schema

Read-only inspection date: 2026-07-27

Form title: **MKSM Sankalp Form for all MKSM Online students**

The published Form is publicly readable. The following schema was extracted from
its `FB_PUBLIC_LOAD_DATA_` metadata without submitting a response.

| Question | Type | Required | Entry ID | Validation |
| --- | --- | --- | --- | --- |
| MKSM Number | Short answer | Yes | `1742760532` | — |
| Your First Name | Short answer | Yes | `1992748701` | — |
| Your Last Name | Short answer | Yes | `1182588695` | — |
| Your Email | Short answer | Yes | `1838437624` | Email address |
| Your Batch Name | Short answer | Yes | `2040019182` | — |
| Date of Practice | Date | Yes | `737772668` | Date without time |
| Number of Minutes Practiced | Short answer | Yes | `1586397793` | Number ≥ 0 |
| What did you practice today? (Optional) | Short answer | No | `193868850` | — |
| Sankalp Word - a word that comes to your mind for this practice session. Optional, but highly encouraged :) | Short answer | No | `1865891008` | — |

Date submission uses the suffixed field names:

- `entry.737772668_year`
- `entry.737772668_month`
- `entry.737772668_day`

## Production integration implication

The Apps Script owner does not have edit access to this Form, so the production
adapter cannot use `FormApp.openById`. It must send an HTTP POST to the published
`formResponse` endpoint with the entry IDs above using `UrlFetchApp`.

The test adapter intentionally continues to use a disposable Form owned by the
script user. This lets the proof of concept verify the rest of the workflow
without creating any production responses.
