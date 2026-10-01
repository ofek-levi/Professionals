# Privacy data map

What the apps collect, in the terms of App Store Connect's **App Privacy** questions and Google Play's
**Data safety** form, so the owner can copy the answers (OPERATIONS.md §10, pre-launch checklist).
It follows the Privacy Policy (`src/modules/legal/content/privacy.en.ts` / `privacy.he.ts`) and what
the code stores (`src/modules/*/*.model.ts`; deletion: `src/modules/users/account-erasure.ts` and
`account-purge.ts`). When the Privacy Policy changes what is collected, why, or who receives it,
update this file and the store answers with it.

Words as the stores use them:
- **Collected:** sent off the device and kept longer than it takes to answer the request. Data the
  phone only shows (cached images, settings) is not collected.
- **Linked to the user** (Apple): stored with the account or its id. **Tracking** (Apple): combining
  it with other companies' data for ads, or sharing it with data brokers. Nothing is used for tracking.
- **Shared** (Google): given to a third party. Service providers that process data for us under an
  agreement do not count, nor does anonymous data; nothing is shared.

## General answers

| Question | Answer |
|---|---|
| Apple: Do you or your third-party partners collect data from this app? | Yes (the types below) |
| Apple: Is any data used to track users? | No. No advertising, analytics, attribution or crash-reporting SDKs; the app never asks for tracking permission (App Tracking Transparency) |
| Google: Does the app collect or share any of the required user data types? | Yes, collects (the types below); shares none |
| Google: Is all user data encrypted in transit? | Yes: the API, the images (Cloudinary), the maps and every provider are reached over HTTPS only (the app refuses a non-`https` API address in staging and production; `PUBLIC_API_URL` must be `https://` too) |
| Google: Do you provide a way for users to request that their data be deleted? | Yes: in the app (Profile → Settings → **Delete account**), or by email as the account-deletion page explains |
| Google: Delete account URL | `<PUBLIC_API_URL>/legal/account-deletion` |
| Google: Account creation methods | Username (email) and password; OAuth (Google) |
| Google: Target audience | Adults (18+); not designed for children |
| Apple / Google: Privacy policy URL | `<PUBLIC_API_URL>/legal/privacy` |

## Data types

Purposes are given as Apple names them / as Google names them. "App functionality" covers running the
marketplace, sign-in, security and support. **Every type: not used for tracking, not shared, not
processed only ephemerally.**

| Apple type / Google type | What exactly | Linked to the user | Purposes (Apple / Google) | Service providers that receive it | Required or optional | When the account is deleted |
|---|---|---|---|---|---|---|
| Contact Info → **Name** / Personal info → **Name** | First and last name; a professional's display name and business name | Yes | App Functionality / App functionality, Account management | Hosting; Resend (emails); Expo, Apple and Google push (names in notification texts) | Required | Erased; others see "Deleted user" |
| Contact Info → **Email Address** / Personal info → **Email address** | Sign-in email; a professional's contact email | Yes | App Functionality / App functionality, Account management, Developer communications (notice of changes to the Terms and the Privacy Policy) | Hosting; Resend; our mailbox provider (when the user writes to us) | Required | Erased (replaced by a placeholder) |
| Contact Info → **Phone Number** / Personal info → **Phone number** | Account phone; a professional's contact phone (shown only to customers who hire them) | Yes | App Functionality / App functionality, Account management | Hosting | Required | Erased |
| Contact Info → **Physical Address** / Personal info → **Address** | A customer's default address and request addresses, with optional apartment, floor and entrance details; a professional's base address and service-area name | Yes | App Functionality / App functionality | Hosting | Required to post a request and to open a professional account (the apartment details are optional) | Erased; kept requests keep only the city, the neighbourhood and an approximate pin |
| Contact Info → **Other User Contact Info** / Personal info → **Other info** | A professional's website | Yes | App Functionality / App functionality | Hosting | Optional | Erased |
| Location → **Precise Location** / Location → **Precise location** | The map point of each address; the phone's position, once and in the foreground, only when the user taps "Use my current location" (the rounded point is also kept, not linked to anyone, in the address-lookup cache for up to 30 days) | Yes (saved addresses) | App Functionality / App functionality | Hosting; OpenStreetMap Nominatim receives the point rounded to about 11 m, without any account or IP address (anonymous) | Location permission optional; a map point is required for a request | Erased; kept requests keep the approximate pin only |
| Location → Coarse Location / Location → Approximate location | **Not collected.** The approximate pins shown to other users are computed by the server from the address, and IP addresses are never used to locate anyone | – | – | – | – | – |
| User Content → **Photos or Videos** / Photos and videos → **Photos** | Request photos (up to 6) and the profile photo; whatever the camera embedded in them (date, device, place) may be stored too | Yes | App Functionality / App functionality | Hosting; Cloudinary | Optional | Deleted (from Cloudinary too) |
| User Content → **Emails or Text Messages** / Messages → **Other in-app messages** | Chat messages of a job, with send and read times | Yes | App Functionality / App functionality | Hosting; previews (up to 90 characters) pass through Expo, Apple and Google push, and Resend for email notifications | Optional (only if the user chats) | Messages the user sent stay for the other participant, from "Deleted user", until that person deletes their account too; then deleted |
| User Content → **Other User Content** / App activity → **Other user-generated content** | Requests (category, description, urgency), offers (price, start time, message), reviews (star rating, comment), cancellation reasons and comments, and a professional's profile (headline, bio, categories, experience, availability, starting price, license number, insurance declaration, languages) | Yes | App Functionality / App functionality | Hosting | Partly: what a request, an offer or a review needs is required; comments, messages and most profile fields are optional | Requests nobody made an offer on and the profile are deleted; offer messages and review comments are erased; requests with offers, offers' prices and dates and review ratings stay for the other party until they delete their account too |
| User Content → **Customer Support** / (not collected through the app) | Emails the user sends to the contact address (requests, reports) | Yes | App Functionality / – | Our mailbox provider | Optional | Kept up to 24 months after the matter is closed |
| **Search History** / App activity → **In-app search history** | Text typed into an address search, and map points looked up, with the addresses found | **No** (cached by the search, not by user) | App Functionality / App functionality | Hosting (cache); OpenStreetMap Nominatim (anonymous) | Optional | Not linked to the account; expires within 7 days (text) and 30 days (points) |
| Identifiers → **User ID** / Personal info → **User IDs** | The internal account id; the Google account id when the user signs in with Google | Yes | App Functionality / App functionality, Account management | Hosting; push providers (record ids in notification data) | Required | The Google account id is erased; the internal id stays only in the anonymous tombstone |
| Identifiers → **Device ID** / **Device or other IDs** | The Expo push token of each signed-in phone (no device model, operating system or advertising id) | Yes | App Functionality / App functionality | Hosting; Expo; Apple Push Notification service; Firebase Cloud Messaging | Optional (only when notifications are allowed) | Deleted |
| Diagnostics → **Other Diagnostic Data** / App info and performance → **Diagnostics** | Server request logs: time, request type, web address (secret tokens, address searches and coordinates masked; internal record numbers stay), result and duration. The app itself sends no crash or performance reports | Yes (internal record numbers) | App Functionality / App functionality | Hosting | Not chosen by the user | Overwritten after `retention.serverLogsDays` |

**Not collected:** Health & Fitness; Financial Info (no payments in the app; agreed prices are part of
the job record above); Sensitive Info; Contacts; Audio; Browsing History; Purchases; Usage Data
(no analytics: Product Interaction, Advertising Data and Other Usage Data are all "no"); Crash Data;
Performance Data; Gameplay Content; Google's Calendar, Files and docs, Installed apps, Web browsing,
App interactions, Race and ethnicity and the other sensitive personal-info types.

Neither form has a type for:
- **IP addresses:** received with every request; used only to deliver it, to limit abuse and to
  protect sign-in (counters for minutes to hours; sign-in protection records with a hash of the email
  for up to 30 days), never to locate anyone or for analytics. The access logs of the hosting and
  network services in front of the API may record them, for at most `retention.serverLogsDays`.
- **Passwords:** stored only as argon2id hashes; the first 5 characters of a hash of a new password go
  to Pwned Passwords (anonymous).
- **Settings and records of the account:** language, notification choices, which version of the
  Terms and the Privacy Policy was accepted and when. They are part of the account above.

## Deletion, as the stores ask about it

- **In the app:** Profile → Settings → **Delete account** ("מחיקת החשבון" in Hebrew). Immediate; the app
  shows what will be cancelled first and asks for the password or the Google account.
- **Without the app:** by email to the contact address, confirmed from the account's address
  (OPERATIONS.md §9), within 30 days of the confirmation.
- **The web page** for Google Play's deletion URL is `<PUBLIC_API_URL>/legal/account-deletion`. It
  names the app ("Professionals") and the operator (`operator.name` of `src/config/legal.ts`): the
  store listing must use the same app name, and the same name as its developer name.
- **Deleted:** name, email address, phone number, password, Google link, profile photo, default
  address, a professional's profile, the requests no professional made an offer on, the photos and
  exact addresses of the other requests, offer messages, review comments, notifications, sessions and
  push tokens.
- **Kept, without the name, contact details or photo** (shown as "Deleted user"): jobs, requests that
  received offers (description, category, dates, city, neighbourhood, approximate pin), offers' prices
  and dates, review ratings and the chat messages the user sent, while another party to them still
  has an account; deleted once every party has deleted their account. A minimal account record
  (internal id, role, language, dates; a professional's statistics) stays so these records resolve.
- **Expire later:** notifications other users received (90 days), sign-in protection records
  (30 days), server and edge logs (`retention.serverLogsDays`), backups (`retention.backupsDays`),
  emails to us (24 months after the matter is closed).
- **Partial deletion** (Google asks whether users can delete some data without deleting the account):
  the profile photo can be removed and optional profile fields cleared in the app; a request's photos
  are deleted when it is cancelled. Anything else is by email (OPERATIONS.md §9).

## Google OAuth consent screen

The Google sign-in consent screen shows what the app asks of Google; keep it consistent with the
Privacy Policy ("Information we receive from Google", "Google user data"):
- App name **Professionals**, the app logo, and the contact email as the user support email and the
  developer contact email.
- Scopes: `openid`, `email` and `profile` only (non-sensitive; no verification of sensitive scopes).
- Links: the privacy policy `<PUBLIC_API_URL>/legal/privacy` and the terms of service
  `<PUBLIC_API_URL>/legal/terms`; the home page must be a public page on an authorized domain that
  describes Professionals and links to both (OPERATIONS.md §10, item 9).
- Authorized domains: the API's domain and the home page's domain.
