# Start here: Clinical Evidence Twin

This pilot uses made-up people and records. It helps a team compare evidence and record its reasoning. It does not tell anyone what treatment to give.

## If you want to look around

Choose **Explore the demo** on the homepage. Open Mira Sen, then **Needs review**. Click a source label to read the original note. You can ask a question about the sample evidence and export a brief. Changes and workflow runs require a hospital account.

If the sign-in screen says accounts are being connected, explore the demo while the owner finishes the database setup. The disabled form does not mean you entered something incorrectly.

## If you are setting up your hospital

1. Select **Create workspace**. Enter your name, email, and a password of at least 12 characters. Store your password safely.
2. Choose **Create a hospital**. Enter the hospital/team name and department.
3. Your hospital appears in **My hospitals**. Select **Open workspace**.
4. Three fictional cases are ready. Your team gets its own saved copy; another hospital does not see its reviews.
5. To add colleagues, open **Team & access**, copy the hospital code, and share it yourself.
6. Each colleague signs in, selects **Join a hospital**, and submits the code with a short introduction.
7. Confirm their identity with your team outside this app. Then approve the request as **Viewer** or **Reviewer**. An unverified email is not proof of identity.

The code alone does not grant access. The owner can change a colleague’s role or remove access. Earlier review notes stay in the history after access is removed.

## Your first case, one step at a time

1. Choose **Mira Sen**. The green **What to do next** box gives the next step.
2. Open **Needs review**. The allergy notes disagree.
3. Open both source labels. Read the original text before deciding what to record.
4. Select **Keep it open** if the evidence is incomplete. Write what needs confirmation, then **Save review**. The account name is attached automatically.
5. Ask **Which records disagree?** in **Ask the evidence**. Open its source labels. A source-search answer does not mean an AI model was used.
6. Open **Evidence workflow** and select **Run evidence checks**. It builds the timeline, compares statements, finds gaps and pauses for review.
7. Read the brief. Select **Review this brief**, add a note, and save. Reviewing the brief does not close individual open issues.
8. Choose **Export brief** for a readable Markdown report or JSON evidence bundle.
9. Refresh the page. Your hospital’s saved notes should remain when database setup is complete.

## Adding a record

Owners and reviewers can select **Add record**. This version accepts structured fictional JSON, not a PDF or scan. Use the built-in sample first. Check the patient ID, record ID, dates and quoted evidence before importing. Old source text is never overwritten.

If a new record arrives after a workflow run, run the checks again. The previous brief describes the older record set.

## What each screen means

| Screen            | Use it for                                         |
| ----------------- | -------------------------------------------------- |
| Overview          | See the case, current gaps and next step           |
| Patient timeline  | Follow event dates and see when notes were entered |
| Source records    | Read originals                                     |
| Needs review      | Compare conflicting or missing information         |
| Saved memory      | See dated source-linked facts and review history   |
| Evidence workflow | Run the checks and review the resulting brief      |
| My hospitals      | Choose or create a hospital workspace              |
| Team & access     | See colleagues; owners manage access               |
| My account        | See account details and change your password       |

## Common situations

- **I can read but cannot save.** Your role may be Viewer. Ask the owner for Reviewer access.
- **A colleague approved me but I cannot see the hospital.** Select Refresh on My hospitals.
- **This workspace changed in another tab.** Refresh, read the newer decision, and retry if still needed.
- **AI summaries are not connected.** Source search still works. It displays matching evidence rather than generated prose.
- **A fact is missing.** The records may be incomplete. The app does not treat missing evidence as proof of absence.
- **Password recovery is unavailable.** Email delivery has not been connected. The owner cannot see or reset your password.
- **I am done for the day.** Use Sign out. The current session is invalidated on the server.
