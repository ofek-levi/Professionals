/**
 * Account deletion page, English. Placeholders are expanded when served (`legal-placeholders.ts`).
 * Where the versions differ, the Hebrew one (`account-deletion.he.ts`) prevails.
 */
import type { LegalDocumentContent } from './types.js';

export const accountDeletionEn: LegalDocumentContent = {
  title: 'Delete your Professionals account',
  intro: [
    "This page explains how to delete your account in the **Professionals** app, which is operated by {{operatorName}}. You can delete it in the app, or ask us by email if you can't use the app.",
    'It also explains what happens to your open requests, offers and jobs, what we delete, and what we keep and for how long.',
  ],
  sections: [
    {
      id: 'summary',
      heading: 'In short',
      blocks: [
        {
          type: 'list',
          items: [
            '**In the app:** Profile → Settings → **Delete account**. Your account is deleted immediately.',
            "**Without the app:** email [{{contactEmail}}](mailto:{{contactEmail}}) from your account's email address. We reply to confirm, and delete the account within 30 days of your confirmation.",
            '**What we delete:** your name, contact details, password, photos, addresses and professional profile, and the requests that no professional made an offer on.',
            '**What stays:** records that other users also rely on, such as jobs, ratings without their comments and messages you sent. They no longer show your name: you appear as “Deleted user”. They are deleted once everyone involved has deleted their account.',
            '**Copies deleted later:** notifications sent to other users within 90 days, sign-in protection records within 30 days, server logs within {{logRetentionDays}} days, backups within {{backupRetentionDays}} days, and emails you sent us within 24 months after the matter is closed.',
          ],
        },
      ],
    },
    {
      id: 'delete-in-the-app',
      heading: 'Delete your account in the app',
      blocks: [
        {
          type: 'definitions',
          items: [
            { term: 'Step 1', text: 'Sign in to the Professionals app and open the **Profile** tab.' },
            { term: 'Step 2', text: 'Choose **Settings**, then **Delete account**.' },
            {
              term: 'Step 3',
              text: 'Check what will happen. Before anything is deleted, the app shows how many of your requests, offers and jobs will be cancelled, declined or withdrawn, with a list of the requests, jobs and withdrawn offers concerned (up to 20 of each), and what stays after deletion.',
            },
            {
              term: 'Step 4',
              text: "Confirm it's you: enter your password. If your account has no password (for example, because you signed up with Google), confirm with your Google account instead. If confirming with Google isn't available in the app you're using, ask us by email (see “If you can't use the app”).",
            },
            { term: 'Step 5', text: "Confirm the deletion. Your account is deleted immediately and you're signed out." },
          ],
        },
        {
          type: 'paragraph',
          text: "If you've forgotten your password, you can set a new one with **Forgot password?** on the sign-in screen, or ask us by email to delete your account (see the next section).",
        },
      ],
    },
    {
      id: 'delete-by-email',
      heading: "If you can't use the app",
      blocks: [
        {
          type: 'paragraph',
          text: 'You can ask us to delete your account without installing the app or signing in. Send an email to [{{contactEmail}}](mailto:{{contactEmail}}):',
        },
        {
          type: 'list',
          items: [
            "from the email address of your Professionals account (if you signed up with Google, that's the address of your Google account);",
            'with the subject **Delete my account**.',
          ],
        },
        {
          type: 'paragraph',
          text: "We reply to the account's email address to confirm the request, and we delete the account only after you confirm from that address (the sender of an email can be forged). We delete it within 30 days of your confirmation, with the same result as deleting it in the app (described below). When it's done, we email you a confirmation that the account was deleted at your request by email.",
        },
        {
          type: 'paragraph',
          text: "If you no longer have access to that email address, write to us from another address and tell us which address the account uses. We'll explain how we can confirm that the account is yours.",
        },
      ],
    },
    {
      id: 'before-you-delete',
      heading: 'Before you delete',
      blocks: [
        {
          type: 'list',
          items: [
            "**Deletion can't be undone.** You won't be able to sign in to the account or see its requests, offers, jobs, chats or reviews again.",
            'If you need something from your chats or jobs, such as what you agreed with someone, save it first. All your chats are closed when the account is deleted.',
            "Deleting your account cancels your active jobs in the app, but it doesn't settle what you and another user owe each other, for example payment for work already done or a warranty on work you did. If a job is scheduled or in progress, we recommend telling the other person before you delete. See the [Terms of Use]({{termsUrl}}).",
            "Deleting the app from your phone doesn't delete your account.",
          ],
        },
      ],
    },
    {
      id: 'open-items',
      heading: 'What happens to your open requests, offers and jobs',
      blocks: [
        {
          type: 'definitions',
          items: [
            {
              term: "If you're a customer",
              text: "Your active requests (open, with offers, or with a job that isn't finished) are cancelled, and all pending offers on them are declined. The professionals who sent those offers are notified, unless they turned off “Offers & job updates” notifications. Requests that no professional made an offer on are deleted (see “What we delete”).",
            },
            {
              term: "If you're a professional",
              text: 'All your pending offers are withdrawn, and the customers who received them are notified, unless they turned off “Offers & job updates” notifications.',
            },
            {
              term: 'Active jobs (both roles)',
              text: "Jobs that are awaiting confirmation, scheduled or in progress are cancelled, even if the work has already started. The job's request is cancelled too, and the other person is notified, unless they turned off “Offers & job updates” notifications.",
            },
            { term: 'Chats', text: 'All your chats are closed, so no new messages can be sent in them.' },
            { term: 'Completed jobs', text: "They stay in the other person's history (see “What we keep, and why”)." },
          ],
        },
        { type: 'paragraph', text: "The notifications that other users receive about these changes don't include your name." },
      ],
    },
    {
      id: 'what-we-delete',
      heading: 'What we delete',
      blocks: [
        { type: 'paragraph', text: 'When your account is deleted, we delete:' },
        {
          type: 'list',
          items: [
            '**Account details:** your name, email address, phone number, password, the link to your Google account, profile photo, default address, and the record of when you accepted our terms.',
            '**Professional profile:** display or business name, headline, bio, contact phone, email and website, license number, insurance declaration, languages, base address, exact service-area point, starting price and service categories. Your public profile and its list of reviews are removed, you no longer appear in search results, and you stop receiving new requests.',
            '**Requests (customers):** the requests that no professional made an offer on, in full. From your other requests: their photos, street address, apartment, floor and entrance details, exact map point and cancellation comments.',
            '**Offers (professionals):** the messages you wrote in your offers.',
            '**Reviews you wrote:** their comments. The star rating stays (see below).',
            "**Your notifications, sign-in sessions and push notification tokens,** and any email verification or password reset links. You're signed out on every device.",
          ],
        },
        { type: 'paragraph', text: 'Photos are also deleted from our image storage provider.' },
      ],
    },
    {
      id: 'what-we-keep',
      heading: 'What we keep, and why',
      blocks: [
        {
          type: 'paragraph',
          text: "Some records also belong to the people you dealt with: they are their history of what was requested, offered, agreed and done. We keep these records without your name, contact details or photo. Wherever they appear, you're shown as **Deleted user**.",
        },
        {
          type: 'definitions',
          items: [
            {
              term: 'Jobs',
              text: 'Your jobs with other users, including completed and cancelled ones, stay in their history: service category, status, dates and the agreed price.',
            },
            {
              term: 'Requests (customers)',
              text: 'Requests that received offers keep their description, service category, urgency, dates, city, neighbourhood and approximate location. The professionals who made offers on them or worked on them can still see them, and so can other professionals whose services and area match a request if they open it, for example from an earlier notification about it.',
            },
            { term: 'Offers (professionals)', text: 'The price and proposed start time, for the customers who received them.' },
            {
              term: 'Ratings you gave',
              text: "The star rating, without the comment, stays in the professional's reviews, so their rating doesn't change.",
            },
            {
              term: 'Reviews about you (professionals)',
              text: 'They stay in the job history of the customers who wrote them, but they are no longer shown publicly.',
            },
            {
              term: 'Chat messages',
              text: 'Messages you sent stay visible, as you wrote them, to the person you were chatting with. The chat is closed.',
            },
            {
              term: 'Minimal account record',
              text: "An internal account number, your role, your language, and the dates the account was created and deleted, so the records above keep working. For professionals, it also keeps profile settings that aren't contact details (years of experience, weekly availability and whether you take emergency calls, and the approximate centre and radius of your service area) and your rating and job statistics (ratings per star, average rating, number of reviews and completed jobs, response time, and the ranking score calculated from them). Customers who dealt with you still see your rating and statistics with your offers and jobs.",
            },
          ],
        },
        {
          type: 'paragraph',
          text: "**How long:** these records stay while anyone else involved in them still has an account, and they are deleted once everyone involved has deleted their account; until then, they don't have a fixed deletion date. The minimal account record doesn't have a fixed deletion date either. The records don't include your name, contact details or photos, but texts you wrote, such as request descriptions and chat messages, stay as you wrote them.",
        },
      ],
    },
    {
      id: 'remaining-copies',
      heading: 'Copies that are deleted later',
      blocks: [
        { type: 'paragraph', text: 'A few copies are not deleted immediately, but on a fixed schedule:' },
        {
          type: 'definitions',
          items: [
            {
              term: 'Notifications sent to other users',
              text: 'They can include your name or a short preview of a message you sent. They are deleted automatically 90 days after they were created.',
            },
            {
              term: 'Sign-in protection records',
              text: 'They contain a hash of your email address and the IP address you signed in from, and expire within 30 days. Other short-lived security and cache entries expire within hours.',
            },
            {
              term: 'Server logs',
              text: 'Kept for {{logRetentionDays}} days, then deleted. The access logs of the services in front of our servers are kept no longer.',
            },
            {
              term: 'Backups',
              text: 'Kept for {{backupRetentionDays}} days, then overwritten by newer backups. Until then, your data can remain in a backup copy.',
            },
            {
              term: 'Emails you sent us',
              text: 'Such as a deletion request. Kept for up to 24 months after the matter is closed, unless we need them longer to establish or defend a legal claim or to comply with a legal duty.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: "Emails and push notifications already delivered to other users stay in their mailboxes and on their devices, and we can't delete them. Our email and push notification providers may keep delivery records for a limited time under their own terms.",
        },
      ],
    },
    {
      id: 'after-deletion',
      heading: 'After deletion',
      blocks: [
        {
          type: 'list',
          items: [
            "Whichever way you delete your account, we send a confirmation to the account's email address.",
            "You're signed out on every device, and the deleted account can't be signed in to.",
            "You can sign up again later with the same email address or Google account. The new account starts empty: the requests, offers, jobs, chats and reviews of the old account aren't restored.",
          ],
        },
      ],
    },
    {
      id: 'more-information',
      heading: 'More information',
      blocks: [
        {
          type: 'list',
          items: [
            'The [Privacy Policy]({{privacyUrl}}) explains what personal data we collect, how we use it, who we share it with, and your rights under the Privacy Protection Law, 5741-1981.',
            'The [Terms of Use]({{termsUrl}}) explain how requests, offers and jobs work, and what deleting an account means for agreements with other users.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [
        { type: 'paragraph', text: 'For questions about deleting your account or about your data, contact us:' },
        {
          type: 'definitions',
          items: [
            { term: 'Operator (database controller)', text: '{{operatorName}} {{operatorRegistration}}' },
            { term: 'Address', text: '{{operatorAddress}}' },
            { term: 'Email', text: '[{{contactEmail}}](mailto:{{contactEmail}})' },
          ],
        },
      ],
    },
    {
      id: 'language-versions',
      heading: 'Hebrew and English versions',
      blocks: [
        { type: 'paragraph', text: 'This page is published in Hebrew and in English. If the two versions differ, the Hebrew version prevails.' },
      ],
    },
  ],
};
