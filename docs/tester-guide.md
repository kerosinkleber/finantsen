# Finantsen – Tester Guide

Finantsen is a self-hosted web app for sharing expenses (think Splitwise). It works in the browser, is built mobile-first and can be installed as an app. You are testing an **early version**. Please try to break things and tell us what you find.

Rough time needed: 90–150 minutes for everything, 20 minutes for the core (sections 2–5).

---

## 1. Getting started

**Option A – the app is hosted for you:** open the link you were given. Skip to section 2.

**Option B – run it on your own computer** (needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the project folder you were sent):

```
docker compose -f docker-compose.local.yml up --build
```

The first build takes a few minutes. When the log shows `migrations applied` and `Ready`, open <http://localhost:3000>. Stop with `Ctrl+C`; to wipe all test data use `docker compose -f docker-compose.local.yml down -v`.

**Signing in (development mode):** on the sign-in page click **"Sign in as admin (development)"**. That logs you in as the administrator without a password. A red banner "DEVELOPMENT MODE" is shown on purpose. Everything below is done from this admin account unless it says otherwise.

**Tip:** to test as several people at once, use a second browser or a private/incognito window for each person.

**Test password** that satisfies the rules: `Correct-Horse-Battery-9!`

**E-mails:** the local setup includes a test mailbox. Every e-mail the app sends (one-time links, "Forgot password", notifications) appears at <http://localhost:8025> (Mailpit). Nothing leaves your computer. Give the accounts you create an e-mail address such as `lena@example.com` to receive mails.

**Not available in this version** (please do not report these as bugs): push notifications on a local setup, receipt scanning (needs an API key).

---

## 2. Accounts and sign-in

Create people first, you need at least two accounts to test sharing.

- [ ] **Create an account with a one-time link.** Account menu (bottom bar, "Account") → **Manage users** → *Create user*. Enter a username (e.g. `lena`), leave "Display name" empty, keep **"User chooses their own password"**, click *Create account*.
  Expected: a one-time link appears with an expiry time and a copy button. The new user is listed as "Invitation open" and the display name equals the username.
- [ ] **Activate the account.** Open the link in a private window.
  Expected: you are asked to choose a password. While typing, a checklist shows which rules are met (20+ characters, upper and lower case, a digit, a special character, must not contain the username). The button stays disabled until all rules are met and both fields match. After saving you are signed in.
- [ ] **A link works only once.** Open the same link again.
  Expected: "invalid or expired".
- [ ] **Create an account with a password you choose** (*"I set the password"*), leave "require a password change at first sign-in" checked, and sign in as that user in another window.
  Expected: you must change the password before you can use anything else (pages and features are locked until you do). The new password must differ from the old one.
- [ ] **Sign in by username or e-mail**, upper/lower case does not matter for the username.
- [ ] **Wrong password 5+ times** for one account.
  Expected: after the 5th failure the account is locked for a short time and the app tells you how many seconds to wait. The correct password is also refused during that time.
- [ ] **Change your password** (Account → *Change password*). Needs the current password.
  Expected: other signed-in devices are signed out.
- [ ] **Language:** Account → language *Deutsch / English*. Texts switch everywhere.
- [ ] **Sign out** (Account → *Sign out*).

### Admin tools (Account → Manage users)
- [ ] **Settings:** try *Allow self-registration*, *Allow multiple accounts per e-mail address* and the validity of one-time links.
- [ ] **Self-registration:** turn it on, then (signed out, private window) click *Sign up* on the sign-in page and register. Expected: "waiting for approval", sign-in is refused with a message. As admin click **Approve**, then the user can sign in. Turn the setting off again: the sign-up page is no longer available.
- [ ] **Per user:** *Create new one-time link* (also works as "forgot password"), *Set password*, *Disable* (signed-in sessions end immediately, sign-in is refused, data stays), *Enable*, *Make admin* / *Remove admin rights*.
- [ ] **Protection:** you cannot disable yourself, and the last remaining admin cannot lose admin rights.
- [ ] **Same e-mail twice:** give two users the same e-mail. By default the second is refused. Turn on *multiple accounts per e-mail*, create both, then sign in with that e-mail: you are asked which account to use.

---

## 3. Groups and friends

- [ ] **Create a group** (name, default currency).
- [ ] **Invite someone:** group → *Members* → *Invite a member* → copy the link. Open it while signed in as another user and click *Accept invitation*.
  Expected: they are now a member. If not signed in, the link asks to sign in first. A **QR code** of the link is shown below it; scanning it with a phone camera opens the same link.
- [ ] **Scan inside the app:** on the overview tap **Scan QR code**, allow the camera and point it at an invitation QR code (e.g. shown on another screen). Expected: the invitation page opens. A QR code with any other content (e.g. a website) is shown but **not** opened. Without camera: paste the link into the field and press *Open*; a foreign link is refused.
- [ ] **Friends:** *Friends* tab → *Add friend* → open the link as another user. Expected: a two-person space appears for both.
- [ ] **Default split:** group → *Members* → *Default split*, choose percent or shares for specific people and save. New expenses are pre-filled accordingly.
- [ ] **Simplify debts** switch (group → *Members*, group owner only): changes how balances are shown (fewest transfers vs. every single debt).
- [ ] **Leaving / removing members:** possible only when the person's balance is zero, otherwise a clear message.
- [ ] **Delete group** (owner only). Expected: asks for confirmation, everything in it is gone.
- [ ] **Archive a group** (group → *Members* → *Archive group (just for me)*). Expected: on the overview the group moves into a collapsible "Archive (n)" box at the bottom; other members still see it normally; your balance still counts in the totals. *Restore from archive* brings it back.

### Import (group owner)
- [ ] Group → *Members* → **Import expenses (CSV)**. Create a small file in a text editor and save it as `test.csv`:
  ```
  date,title,amount,currency,paid_by,split_between,category
  2026-03-01,Museum,24.00,EUR,<your name>,<your name>|Zed,entertainment
  2026-03-02,Broken,abc,EUR,<your name>,<your name>,
  ```
  Expected: preview "simple format. 1 expenses, 0 payments", "1 rows will be skipped" (line 3, amount unreadable). Your name is matched to you, "Zed" to "New member without an account". After *Import*, the expense appears, Zed is a guest member, nobody got a notification per imported entry. Importing the same file again → "already been imported".
- [ ] If you have a **Splitwise** or **Tricount** account, export a group as CSV there and import it. Expected: same balances per person as in the source app. Please report the file format (first line) if it is not recognised.
- [ ] Export a group (*Export as CSV*), create a new group and import that file. Expected: format "Finantsen export", balances identical. Only the group owner sees the import link.

### Budget (group owner)
- [ ] *Members* tab → **Budget**: enter 50, *per month*, save. Expected: above the expense list "Budget <month>: … of €50.00" with a bar and "… left" (yellow from 80 %). Add expenses this month beyond 50 €: the bar turns red, "exceeded by …", and every member gets **one** notification "Budget of <group> exceeded" (a further expense the same month sends no second one). Expenses from other months do not count; a refund lowers the sum. Switch to *in total*: all expenses count. *Remove budget*: the bar disappears. Non-owners do not see the budget form.

### Members without an account (guests)
- [ ] Group → *Members* → **Members without an account** → enter a name (e.g. `qa-grandma`) → *Add guest*. Expected: the guest appears with "(guest)" behind the name everywhere (member list, expense form, balances).
- [ ] Use the guest in an expense as **payer** and as **participant**. Balances include the guest. The guest never gets notifications.
- [ ] **Delete** a guest that has expenses: refused with an explanation. A guest without any expenses can be deleted. *Edit* renames a guest.
- [ ] **Link to an account:** *Link to an account* shows a link (and QR code), valid 7 days, once. Open it while signed in as another (real) account and accept. Expected: the text says you take over the guest's role; afterwards the guest is gone and all their expenses, payments and balances belong to that account (if that account was already a member, the amounts are combined, e.g. "paid 6 + 4" becomes "paid 10"). Opening the link a second time: "invalid". If guest and account were in the same "equal" expense, it now shows as "shares" 2:1 (an "itemized" one as "fixed amounts"), so editing it later keeps the same numbers.
- [ ] **Ownership never goes to a guest:** the owner leaves → the next member *with an account* becomes owner. The last member with an account cannot leave while guests remain (clear message).
- [ ] Guests cannot sign in (there is no way to) and do not show up in *Manage users*. Friendships (two-person spaces) have no guests.

---

## 4. Expenses (the core)

Use at least three people in one group so the results are interesting.

- [ ] **Equal split.** Amount, title, category, date, who paid, who took part.
- [ ] **Percent split.** Percentages must add up to 100 %; a live hint shows what is missing. Saving a wrong sum shows an error.
- [ ] **Fixed amounts.** Must add up to the total.
- [ ] **Shares** (e.g. 2:1:1).
- [ ] **One person covers everything.**
- [ ] **Several payers** for one expense, amounts must add up to the total.
- [ ] **Itemized split:** choose *Itemized*, add several items, tick who had which item, add tax and tip. The total is computed from the items. Expected: tax and tip are distributed in proportion to what each person had.
- [ ] **Rounding check:** split `10.00` equally between 3 people. Expected: the shares add up to exactly 10.00 (e.g. 3.34 / 3.33 / 3.33), nothing is lost.
- [ ] **Decimal formats:** `12,5`, `12.50`, `1.234,56` are understood. A currency without decimals (JPY) refuses `1.5`.
- [ ] **Edit** an expense (open it from the list), **delete** it. Expected: it disappears from the list and balances; the *Change history* at the bottom of the expense still shows who created/changed/deleted it and what the values were.
- [ ] **Deleted expenses (trash):** below the expense list a box "Deleted expenses (n)" appears. Open it and press **Restore** (or open the deleted expense and press Restore). Expected: the expense is back in the list and in the balances, the history shows "Restored", the other members get a notification.
- [ ] **Comments** on an expense. You can delete your own comments only.
- [ ] **Search & filter** (group → *Expenses* → *Search & filter*): by text, amount range, date range, category, person. *Reset* clears it.

- [ ] **Equal + adjust.** New expense 30 € for two people, split *Equal + adjust*, give one person `10`.
  Expected: hint "about €10.00 per person"; saved shares are 20 € and 10 €. Try `-2.50` for someone (they pay less). Adjustments higher than the amount, or a negative share, are rejected with a clear message. Opening the expense again shows the adjustment in the field. Switching the split type clears the per-person fields.

- [ ] **Calculator.** In the amount field type `12.50+3*4` (German: `12,50+3*4`).
  Expected: below the field "= €24.50"; leaving the field replaces the text with 24.50. `(30+15)/3` → 15.00, `10/3` → 3.33, `10/0` → "Invalid calculation" and saving is refused; plain nonsense like `abc` immediately shows "Invalid amount." below the field. On a phone the "±×" button switches the keyboard so you can type + and *.
- [ ] **Copy an expense.** Open an expense → *Copy*.
  Expected: page "Copy expense" with the same title, amount, payer and split, today's date, no Delete button. Saving creates a **new** expense; the original stays unchanged.

- [ ] **Refund.** New expense "Bottle deposit" 6 €, tick *Refund*, "Received by" yourself, split equally among three people, payment method *Cash*.
  Expected: the heading changes to "Received by"; the list shows a "Refund" badge, "Cash" and "You got €6.00 back" (not "You paid"); other members get the notification "… recorded the refund …"; balances move the other way (you now owe each of the two others 2 € more / they owe you 2 € less). Statistics total goes **down** by 6 €. Editing the refund keeps the tick. CSV export shows type "Refund" with negative amounts and a column "Payment method"; importing that file into another group keeps refund and payment method.
- [ ] **Payment method.** Set a method on some expenses. Filter *Payment method = Card*: only those expenses. Statistics tab: section "By payment method", "Average: … per expense, … per month", "Largest expenses".

- [ ] **Receipt photos.** Open an expense → *Receipt photos* → *Add photo* (on a phone the camera opens).
  Expected: a thumbnail appears; tapping it opens the photo. Another member of the group sees it too; a person outside the group gets "not found" for the photo address. Non-image files (e.g. a PDF) are refused with "Please choose a photo (JPEG, PNG or WebP)". After 5 photos the add button disappears. *Delete* asks for confirmation and removes it. A deleted expense keeps its photos (restore brings them back); while it is in the trash you can neither add nor delete photos.

### Other currencies (needs internet)
- [ ] Create an expense in a currency different from the group's (e.g. USD in a EUR group). Expected: the exchange rate for the expense date is shown with a preview of the converted amount.
- [ ] **Set the rate manually** (checkbox) and watch the preview change. After saving, the list shows the converted amount, balances are in the group currency, and re-opening the expense keeps the stored rate.
- [ ] If the rate cannot be loaded, the app asks you to enter one manually.

- [ ] **Recurring expenses** (below the expense list, button "Recurring expenses"): create a template (e.g. monthly rent) with the first date in the past. Expected: a confirmation names how many bookings are created at once; they appear as normal expenses with an "automatic" badge, balances are updated, the other members get a notification. Try pause/resume, an end date, "every 2 weeks", editing a template (only future bookings change) and deleting it (already booked expenses stay).
- [ ] **Owner-only switch** (Members tab): when on, other members can still see the templates but not create or change them.
- [ ] Later dates are booked automatically (the app checks every 15 minutes and right after a restart). To see it without waiting, create a template whose first date is today: it is booked immediately.

---

## 5. Balances and settling up

- [ ] **Balances tab:** shows who owes whom, plus the net balance per person. Check the numbers by hand for at least one expense.
- [ ] **Settle up:** *Settle up* on a suggested transfer (amount is pre-filled) or *Record payment*. Expected: the balance goes down and the payment appears in the expense list.
- [ ] **Overview page** ("Overview"): your total balance, per person across all groups, per group.
- [ ] Settle everything: "All settled up".
- [ ] **Statistics tab:** totals by category, by month and by person (paid vs. share), optional date range. Check that deleted expenses are not counted.
- [ ] **CSV export** (group → *Members* → *Export as CSV*): open the file in Excel/LibreOffice. Expected: one row per expense and payment, per person "paid" and "share" columns, a "Balance" row at the end that matches the balances tab. German interface → `;` and decimal comma; English → `,` and decimal point. A title starting with `=` is shown as text, not as a formula.
- [ ] **Export my data (JSON)** (Account page): downloads a file with your groups, expenses, payments and balances; it contains no passwords or 2FA secrets.

---

### Paying when settling up
- [ ] **Payment details.** Account page → *Payment details*: enter account holder, IBAN and PayPal.me name, confirm with your current password.
  Expected: an IBAN with a wrong check digit (e.g. `DE89 3704 0044 0532 0130 01`) is rejected; `DE89 3704 0044 0532 0130 00` is accepted and shown in groups of four. IBAN without account holder → error. A pasted link `https://paypal.me/name` is shortened to the name. Saving without the right password fails.
- [ ] **Pay someone.** In a group where you **owe** that person money (Balances tab), open *Pay <name>*.
  Expected: for euro amounts a GiroCode (QR) appears; scanning it with a banking app (or any QR reader) shows a SEPA transfer with name, IBAN, the exact amount and "Finantsen: <group>". The IBAN can be copied. *Pay with PayPal* opens `paypal.me/<name>/<amount>EUR`. For other currencies there is no QR, only the PayPal link (if set).
- [ ] **Privacy.** The person who is owed money does **not** see a pay box for themselves; members who do not owe that person see nothing; your own CSV export of a group does not contain anyone's IBAN.

- [ ] **Remind.** On the Balances tab, next to a person who owes **you** money, click *Remind*.
  Expected: the button changes to "Reminded". The other person gets a notification "<you> reminds you: you owe <amount> in <group>" (bell, and e-mail if they turned on e-mail notifications) that opens the balances tab. After reloading, the button still shows "Reminded" (disabled) for the rest of the day. People who owe you nothing, and members without an account, have no Remind button; the debtor never sees one for themselves.

---

## 6. Notifications

- [ ] When someone else adds an expense or comments, a **bell with a counter** appears for you. Open it, follow the entry, use *Mark all as read*. You never get notifications for your own actions.

---

## 6b. E-mail (local test mailbox at http://localhost:8025)

- [ ] **Mail status and test mail.** Account → **Manage users** → section *E-mail sending*.
  Expected: "Active (configured in the server configuration .env)", the server form is locked. The dev admin has no e-mail address at first: *Send test e-mail to me* shows "No e-mail address is stored for your account." Then go to *Account → E-mail*, enter `admin@example.com` and save (the dev admin has no password, so none is asked). Back in *Manage users*, *Send test e-mail to me*: "Test e-mail sent to admin@example.com", and the mail appears in Mailpit.
- [ ] **One-time link by e-mail.** Create a user with the one-time link option **and** an e-mail address (e.g. `lena@example.com`).
  Expected: the link box still shows the link, plus "The link was also sent by e-mail to lena@example.com". In Mailpit: subject "Finantsen: Konto aktivieren"/"activate your account" (language of the account), the same link, expiry in UTC. Opening the link from the mail works. A user **without** e-mail gets no mail and no such note.
- [ ] **Forgot password.** Sign out. On the sign-in page click **Forgot password?**, enter the username (or the e-mail) of an active account with e-mail.
  Expected: always the same message "If a matching account … exists, a link is on its way". In Mailpit a mail "set a new password" arrives; the link sets a new password and signs you in (with two-factor enabled you must still enter the code). Try an **unknown** name: exactly the same message, no mail. Try an account **without** e-mail, a **disabled** account and a **test user**: same message, no mail. Request it 4 times within an hour for the same account: only 3 mails arrive. A newer link makes the older one invalid.
- [ ] **Admin switch.** As admin untick *Allow "Forgot password" on the sign-in page*.
  Expected: the link disappears from the sign-in page; `/forgot-password` redirects to the sign-in page.
- [ ] **E-mail settings of a user.** Account page → section *E-mail*.
  Expected: change your e-mail address only with your current password (wrong password → "The password is wrong."; an address of another account → "already registered"). Both switches *Notifications by e-mail* and *Weekly summary* are **off** by default. Turn on notifications, then let another member add an expense or comment in a shared group.
  Expected: a mail "Finantsen: <group>" with the text of the notification and a link to the expense. Your own actions never send you mail. Test users and guests never get mails.
- [ ] **Weekly summary.** Turn it on. It is sent on Mondays from 06:00 UTC, only if you have open balances, and the first one only in the following week. Mark as SKIPPED if you cannot wait; check only that the switch saves.
- [ ] **Mail server in the admin area (optional).** Only if you can restart the app: start it with `SMTP_URL= docker compose -f docker-compose.local.yml up` (empty value). Then the status is "Off", no "Forgot password?" link. Enter server `mailpit`, port `1025`, encryption *None*, sender `Finantsen <test@localhost>`, save, send a test mail. The password field never shows a stored password.

---

## 7. Test users (admin feature, advanced)

For trying things out without creating many real accounts. Account → *Manage users* → *Manage test users*.

- [ ] **Create test users** (e.g. 3 at once → `test-1`, `test-2`, `test-3`).
- [ ] **Edit one on a single page:** display name, language, add to a group, change the role (owner/member), remove from a group, add a friendship.
  Expected: a warning appears before adding a test user to a group with real members.
- [ ] **Act as:** *Act as* opens the app as that test user (yellow banner, "Back to admin"). Add an expense, write a comment. Expected: the expense history says "by <admin name> as admin". Admin pages are not reachable while acting.
- [ ] **Test users are marked "(Test)"** everywhere other people can see them.
- [ ] **Test users can never sign in** (try their username with any password) and you cannot act as a real account.
- [ ] **Delete** a test user. Expected: refused with an explanation if their data is in a group with real users; otherwise removed together with test-only groups.
- [ ] **Clean-up warning:** while test features are on **or** test users exist, *Manage users* shows a yellow box "Clean up test features before real use" at the top. *Switch off test features* turns them off (the "Test features" checkbox below follows at once). *Delete all test users* asks first, then deletes every test user it can; test users with data in groups with real people stay and are listed with those groups. Nothing is deleted without clicking. With test features off and no test users left, the box disappears.
- [ ] **Start lock for the dev admin** (only for the owner, needs editing a file): in `docker-compose.local.yml` set `APP_URL` to the computer's network address (e.g. `http://192.168.178.20:3000`) while `DEV_ADMIN: "true"` stays, then start. Expected: the app does **not** start; the log says "START ABGEBROCHEN: DEV_ADMIN=true ist nur für lokale Tests erlaubt …". Undo the change afterwards.

---

## 7b. Two-factor sign-in (TOTP)

You need an authenticator app (Aegis, 2FAS, Google/Microsoft Authenticator, …) or any TOTP tool. Use a normal account (not the passwordless dev admin, it is exempt).

1. Account → **Two-factor sign-in (TOTP)** → *Set up*. Scan the QR code (or type the key), enter the current 6-digit code, confirm. A wrong code must be refused.
2. You see **recovery codes once** (default: 1; the admin can set 0–20). Each works exactly once.
3. Sign out and in again: after the password a second step asks for the code. Check: a wrong code fails; the same code cannot be used twice; a recovery code works once and then no more.
4. Account page: regenerate recovery codes (needs password; old ones stop working). Turn TOTP off (needs password + code) — unless it is mandatory.
5. As admin (*Manage users*): *Require 2FA* for one account. That user must set it up straight after the password and can do nothing else before. The setting "Require two-factor for everyone" does the same for everybody (careful: you are included).
6. Admin *Reset 2FA* for a user who lost the phone: their sessions end, they sign in with the password only and set it up again if required.
7. Try to break it: many wrong codes in a row (waiting time should grow), reuse a code, open a one-time link for an account with TOTP (you must still sign in with a code afterwards).

---

## 7c. Passkeys

Needs a browser/device with a platform authenticator (fingerprint, face, device PIN). On `localhost` it works without HTTPS. If your tool cannot open the system passkey dialog, skip this section.

1. Account → **Two-factor sign-in** page → **Passkeys** → *Add a passkey*. Name it, enter your **current password** (wrong password must be refused), confirm in the system dialog.
2. Sign out. On the sign-in page type only your username, click **Use a passkey**: you are in without password or code.
3. Add a second passkey; delete one (needs the password).
4. As admin: *Require 2FA* for that user. Password-only sign-in must now be refused with a hint to use the passkey; the passkey sign-in works and no TOTP setup is demanded.
5. Admin *Reset 2FA* removes TOTP and all passkeys of that user.

---

## 8. Mobile, look & feel, offline

- [ ] Use it on a **phone** (or shrink the browser window): everything should be usable with a thumb, nothing overflows horizontally, buttons are easy to hit.
- [ ] **Dark mode:** switch your device/browser to dark. Texts stay readable.
- [ ] **Install as app** (browser menu → *Install app* / *Add to Home Screen*). It opens like an app with its own icon.
- [ ] **Offline reading:** open a few pages (overview, a group), then switch off the network. Expected: the pages you already opened are still readable, with an "offline" hint; pages you never opened show an offline page. Changes cannot be saved offline.
- [ ] **Wording:** is anything unclear, in English or in German? Tell us.

## 8c. Without HTTPS (home network over http)

Browsers treat `localhost` as secure, so this only shows when you open the app from **another device** via the computer's network address, e.g. `http://192.168.178.20:3000` from your phone in the same Wi-Fi (local stack: set `APP_URL` in `docker-compose.local.yml` to that address and remove `DEV_ADMIN`, see the start lock above).

- [ ] **Sign-in page:** the passkey button is greyed out with a 🔒 hint "Passkeys need a secure connection (HTTPS) …". Signing in with password works.
- [ ] **Overview:** *Scan QR code* is greyed out with a hint. Tapping it still opens the box: no camera request, a hint instead of the video, and pasting an invitation link works.
- [ ] **Settings:** a box "Without HTTPS: some features are off" lists camera, passkeys, installing, offline and push; the install tip is gone; *Turn on push* is greyed out with a hint.
- [ ] **Two-factor page:** *Add passkey* is greyed out with a hint; TOTP setup works.
- [ ] **Manage users** (admin): the same box plus an explanation of how to get HTTPS.
- [ ] Everything else (groups, expenses, balances, statistics, import, export, receipt photos) works as usual.
- [ ] **Counter-check:** on `http://localhost:3000` (or with HTTPS) none of these hints appear.

---

## 8b. Speed and long lists

- [ ] In a group with **more than 50** entries (expenses and payments together) the list shows the newest **50** and below it **"← Newer"**, **"Page 1 of N"** and **"Older →"**. "Older →" shows the next 50 (no duplicates, nothing missing: the last entry of page 1 is directly followed by the first of page 2, sorted by date, newest first; payments appear between expenses at their date).
- [ ] The link **"Show 100 entries per page"** switches to 100 per page (page count halves); **"Show 50 entries per page"** switches back. Both start at page 1.
- [ ] With a filter active, paging only counts the filtered expenses. Typing a page number that is too large into the address bar (`&page=999`) shows the last page, `&page=abc` the first.
- [ ] Balances and statistics always count **all** expenses (unchanged when you switch pages).
- [ ] Pages should feel instant (well under a second) for normal groups. Note any page that takes noticeably longer, with the number of expenses in that group.

---

## 9. Try to break it (please do!)

- [ ] Open a group URL of a group you are **not** a member of (copy a link from another user). Expected: "not found".
- [ ] Double-click *Save* quickly, go back with the browser's back button after saving, reload in the middle of a form.
- [ ] Enter absurd values: very long titles, huge amounts, amount `0`, negative numbers, emojis, `<b>bold</b>` in titles and comments. Expected: no crash, text shown as plain text.
- [ ] Remove a person from the middle of a split after entering values.
- [ ] Anything that looks wrong, feels slow, or makes you think "what does that mean?".

---

## 9b. Re-checks of earlier findings

- [ ] **Confirmation windows** (delete expense, delete group, disable user, reset 2FA, delete test user, delete guest): appear inside the page with *Confirm* / *Cancel*. *Cancel* changes nothing.
- [ ] **"You owe" shows no minus sign** (expense list: "You owe €5.00", not "−€5.00").
- [ ] **Same time everywhere:** a comment shows the same local time on the expense and in the notifications.
- [ ] **Wording:** "You paid …", "X owes you …", "1 group" (singular), "monthly" instead of "every 1 month(s)" read correctly in English and German.
- [ ] **Overview:** "You owe" is shown without a minus sign there too.
- [ ] **Recurring template:** change "monthly" to "every 2 weeks" after bookings exist. Expected: nothing already booked is booked again; the next booking comes after the last existing one.
- [ ] **Forced 2FA / forced password change pages** have a *Sign out* button.
- [ ] **Lockout:** the 5th wrong password already says how long to wait.
- [ ] **Wrong password** when confirming (change password, add passkey, new recovery codes) says "The password is wrong."
- [ ] **German forms** show decimal commas when editing (e.g. "100,00", not "100.00").
- [ ] **Itemized rounding:** Pizza 15.00 (3 people) + Wine 5.00 (3 people, two of them also had pizza) + 3.00 tax: everybody is within 1 cent of the exact value.

---

## 10. How to report a problem

Please send one message per problem with:

1. **What you did** (steps, as exact as you can),
2. **What you expected,**
3. **What happened** (a screenshot helps a lot),
4. Device and browser (e.g. "iPhone 14, Safari" or "Windows, Chrome"),
5. Whether it happens every time.

Thank you!
