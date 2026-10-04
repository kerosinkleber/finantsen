# Finantsen – Tester Guide

Finantsen is a self-hosted web app for sharing expenses (think Splitwise). It works in the browser, is built mobile-first and can be installed as an app. You are testing an **early version**. Please try to break things and tell us what you find.

Rough time needed: 45–90 minutes for everything, 20 minutes for the core (sections 2–5).

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

**Not available in this version** (please do not report these as bugs): passkeys, QR codes for invitations, e-mail sending (the admin hands out links himself), members without an account, restoring deleted expenses, push notifications on a local setup, receipt scanning (needs an API key).

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
  Expected: they are now a member. If not signed in, the link asks to sign in first.
- [ ] **Friends:** *Friends* tab → *Add friend* → open the link as another user. Expected: a two-person space appears for both.
- [ ] **Default split:** group → *Members* → *Default split*, choose percent or shares for specific people and save. New expenses are pre-filled accordingly.
- [ ] **Simplify debts** switch (group → *Members*, group owner only): changes how balances are shown (fewest transfers vs. every single debt).
- [ ] **Leaving / removing members:** possible only when the person's balance is zero, otherwise a clear message.
- [ ] **Delete group** (owner only). Expected: asks for confirmation, everything in it is gone.

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
- [ ] **Comments** on an expense. You can delete your own comments only.
- [ ] **Search & filter** (group → *Expenses* → *Search & filter*): by text, amount range, date range, category, person. *Reset* clears it.

### Other currencies (needs internet)
- [ ] Create an expense in a currency different from the group's (e.g. USD in a EUR group). Expected: the exchange rate for the expense date is shown with a preview of the converted amount.
- [ ] **Set the rate manually** (checkbox) and watch the preview change. After saving, the list shows the converted amount, balances are in the group currency, and re-opening the expense keeps the stored rate.
- [ ] If the rate cannot be loaded, the app asks you to enter one manually.

---

## 5. Balances and settling up

- [ ] **Balances tab:** shows who owes whom, plus the net balance per person. Check the numbers by hand for at least one expense.
- [ ] **Settle up:** *Settle up* on a suggested transfer (amount is pre-filled) or *Record payment*. Expected: the balance goes down and the payment appears in the expense list.
- [ ] **Overview page** ("Overview"): your total balance, per person across all groups, per group.
- [ ] Settle everything: "All settled up".
- [ ] **Statistics tab:** totals by category, by month and by person (paid vs. share), optional date range. Check that deleted expenses are not counted.

---

## 6. Notifications

- [ ] When someone else adds an expense or comments, a **bell with a counter** appears for you. Open it, follow the entry, use *Mark all as read*. You never get notifications for your own actions.

---

## 7. Test users (admin feature, advanced)

For trying things out without creating many real accounts. Account → *Manage users* → *Manage test users*.

- [ ] **Create test users** (e.g. 3 at once → `test-1`, `test-2`, `test-3`).
- [ ] **Edit one on a single page:** display name, language, add to a group, change the role (owner/member), remove from a group, add a friendship.
  Expected: a warning appears before adding a test user to a group with real members.
- [ ] **Act as:** *Act as* opens the app as that test user (yellow banner, "Back to admin"). Add an expense, write a comment. Expected: the expense history says "by admin …". Admin pages are not reachable while acting.
- [ ] **Test users are marked "(Test)"** everywhere other people can see them.
- [ ] **Test users can never sign in** (try their username with any password) and you cannot act as a real account.
- [ ] **Delete** a test user. Expected: refused with an explanation if their data is in a group with real users; otherwise removed together with test-only groups.

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

## 8. Mobile, look & feel, offline

- [ ] Use it on a **phone** (or shrink the browser window): everything should be usable with a thumb, nothing overflows horizontally, buttons are easy to hit.
- [ ] **Dark mode:** switch your device/browser to dark. Texts stay readable.
- [ ] **Install as app** (browser menu → *Install app* / *Add to Home Screen*). It opens like an app with its own icon.
- [ ] **Offline reading:** open a few pages (overview, a group), then switch off the network. Expected: the pages you already opened are still readable, with an "offline" hint; pages you never opened show an offline page. Changes cannot be saved offline.
- [ ] **Wording:** is anything unclear, in English or in German? Tell us.

---

## 9. Try to break it (please do!)

- [ ] Open a group URL of a group you are **not** a member of (copy a link from another user). Expected: "not found".
- [ ] Double-click *Save* quickly, go back with the browser's back button after saving, reload in the middle of a form.
- [ ] Enter absurd values: very long titles, huge amounts, amount `0`, negative numbers, emojis, `<b>bold</b>` in titles and comments. Expected: no crash, text shown as plain text.
- [ ] Remove a person from the middle of a split after entering values.
- [ ] Anything that looks wrong, feels slow, or makes you think "what does that mean?".

---

## 10. How to report a problem

Please send one message per problem with:

1. **What you did** (steps, as exact as you can),
2. **What you expected,**
3. **What happened** (a screenshot helps a lot),
4. Device and browser (e.g. "iPhone 14, Safari" or "Windows, Chrome"),
5. Whether it happens every time.

Thank you!
