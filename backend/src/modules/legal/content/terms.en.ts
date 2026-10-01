/**
 * Terms of Use, English. Placeholders are expanded when served (`legal-placeholders.ts`). Where the
 * versions differ, the Hebrew one (`terms.he.ts`) prevails.
 */
import type { LegalDocumentContent } from './types.js';

export const termsEn: LegalDocumentContent = {
  title: 'Terms of Use',
  intro: [
    'These Terms of Use (the “terms”) govern your use of Professionals: the mobile app, its web version and our public web pages. They are a binding agreement between you and the operator of Professionals, named in “About us” below.',
    'Please read them together with our [Privacy Policy]({{privacyUrl}}), which explains how we handle personal data.',
  ],
  sections: [
    {
      id: 'about-us',
      heading: 'About us',
      blocks: [
        { type: 'paragraph', text: 'Professionals is operated by:' },
        {
          type: 'definitions',
          items: [
            { term: 'Operator', text: '{{operatorName}} {{operatorRegistration}}' },
            { term: 'Address', text: '{{operatorAddress}}' },
            { term: 'Email', text: '[{{contactEmail}}](mailto:{{contactEmail}})' },
          ],
        },
        { type: 'paragraph', text: 'In these terms, “we”, “us” and “our” mean the operator, and “you” means the person using Professionals.' },
      ],
    },
    {
      id: 'acceptance',
      heading: 'Accepting these terms',
      blocks: [
        {
          type: 'paragraph',
          text: 'You accept these terms when you create an account. At sign-up, you tick a box to confirm that you are 18 or older and that you agree to these terms and to the Privacy Policy. We keep a record of the version you accepted and when you accepted it.',
        },
        { type: 'paragraph', text: "If you don't agree to these terms, please don't create an account or use the app." },
        {
          type: 'paragraph',
          text: "You can read the current version at any time: on the app's welcome and sign-in screens, in Settings under Legal, and at [{{termsUrl}}]({{termsUrl}}). This version takes effect on {{effectiveDate}}.",
        },
      ],
    },
    {
      id: 'definitions',
      heading: 'Definitions',
      blocks: [
        {
          type: 'definitions',
          items: [
            {
              term: 'Professionals, the app or the service',
              text: 'The Professionals mobile app, its web version, and the services we provide through them.',
            },
            { term: 'Customer', text: 'A user with a customer account, who posts requests for services.' },
            {
              term: 'Professional',
              text: 'A user with a professional account, who offers services to customers as an independent business or self-employed person.',
            },
            { term: 'Request', text: "A customer's description of a job they need done, posted in the app." },
            { term: 'Offer', text: "A professional's proposal to do the job described in a request, for a stated price and start time." },
            { term: 'Job', text: 'The work agreed when a customer accepts an offer, as recorded in the app.' },
            { term: 'Content', text: 'Anything users put into the app, such as profile details, photos, requests, offers, messages and reviews.' },
          ],
        },
      ],
    },
    {
      id: 'eligibility',
      heading: 'Who can use Professionals',
      blocks: [
        {
          type: 'list',
          items: [
            '**You must be 18 or older.** People under 18 may not open an account or use the app. If we learn that an account belongs to someone under 18, we will close it.',
            'Professionals is intended for services performed in Israel.',
            "**Each account has one role:** customer or professional. You choose the role at sign-up, and it can't be changed. To use both roles, open a second account with a different email address.",
            "Your account is personal. Don't share it, and don't sell or transfer it to anyone else.",
            'If you open a professional account for a business, you confirm that you are authorised to act for that business and to accept these terms on its behalf.',
          ],
        },
      ],
    },
    {
      id: 'our-role',
      heading: 'Our role: we connect customers and professionals',
      blocks: [
        {
          type: 'paragraph',
          text: 'Professionals helps customers find independent professionals for home repairs, renovation, moving and other local services, and helps professionals find work. We act only as an intermediary.',
        },
        {
          type: 'list',
          items: [
            '**We are not a party to the agreement between a customer and a professional.** When a customer accepts an offer, an agreement for the job is made directly between the customer and the professional (see “Accepting an offer”).',
            '**The professional provides the service, not us.** The professional is responsible to the customer for the work, its quality and safety, keeping to the agreed time, and any warranty, including under consumer protection law.',
            '**Price, payment, receipts and tax invoices** are between the customer and the professional. The professional issues the receipt or tax invoice.',
            "**Professionals are independent.** They are not our employees, agents or partners, and we don't direct or supervise their work.",
            "We don't guarantee that a request will receive offers, that an offer will be accepted, or that a user will do what they agreed to do.",
          ],
        },
        {
          type: 'paragraph',
          text: 'We are responsible for operating the app with reasonable care and for our own obligations under these terms and the law (see “Our responsibility and its limits”).',
        },
      ],
    },
    {
      id: 'cost-and-payments',
      heading: 'Cost and payments',
      blocks: [
        {
          type: 'list',
          items: [
            "**Professionals is free of charge.** We don't charge customers or professionals any fee, commission or subscription.",
            '**No payments pass through the app.** The customer pays the professional directly, in the way they agree between them. We never receive, hold or transfer money for users.',
            'Prices in the app are in Israeli new shekels (₪).',
            'If we ever decide to introduce fees, we will tell you in advance, as described in “Changes to these terms”. Fees will apply only from the date stated in the notice, never to requests, offers or jobs made before that date, and you may delete your account instead of paying them.',
          ],
        },
      ],
    },
    {
      id: 'what-we-check',
      heading: "What we check and what we don't",
      blocks: [
        {
          type: 'paragraph',
          text: "**We don't check** the identity, licenses, permits, insurance, qualifications, experience, business registration or background of professionals or customers.",
        },
        {
          type: 'paragraph',
          text: "Profile details such as a license number, the “Licensed” and “Insured” labels, years of experience and the description of services are the professional's own declaration. We show them as the professional entered them. Before you hire, check whatever matters to you, especially for work that only licensed professionals may do by law (for example, electrical or gas work), and ask to see the license and the insurance policy.",
        },
        {
          type: 'paragraph',
          text: "Reviews come only from customers whose job with the professional was marked as completed in the app. They reflect those customers' opinions, not ours, and we don't check what they say.",
        },
      ],
    },
    {
      id: 'accounts',
      heading: 'Your account and its security',
      blocks: [
        {
          type: 'list',
          items: [
            'Give accurate, current information, use your real name, and keep your details up to date.',
            "You can sign up with an email address and a password, or with “Continue with Google”. Keep your password secret and don't use it for other services.",
            'You are responsible for what is done through your account, unless it happens because of our fault or after you told us that your account was compromised.',
            'If you think someone else has used your account, reset your password with “Forgot password?” on the sign-in screen. This signs your account out on every device, and it also works if you signed up with Google. If you sign in with Google, secure your Google account too, and tell us at [{{contactEmail}}](mailto:{{contactEmail}}).',
            "You can edit most of your details in the app. The email address you sign in with can't be changed in the app: to change it, write to us from that address and tell us the new one. We confirm the request with you, change the address and send a verification link to the new one.",
          ],
        },
      ],
    },
    {
      id: 'customer-obligations',
      heading: 'If you are a customer',
      blocks: [
        {
          type: 'list',
          items: [
            'Post requests only for real jobs that you want done, and describe the job, its location and its urgency accurately and honestly.',
            "Add only photos that you took or may use, and avoid showing people, documents or other details you don't want to share (see the Privacy Policy).",
            "Before you accept an offer, read it carefully, including the price, the proposed time and the message, and look at the professional's profile.",
            'Be available at the agreed time, or give access as agreed, and tell the professional about any hazard you know of at the place of work.',
            'Pay the professional what you agreed, in the way you agreed, and ask for a receipt or tax invoice.',
            "Keep the professional's receipt or tax invoice and their contact details outside the app: if the professional deletes their account, the app no longer shows them.",
            'If you no longer need the job, cancel the request in the app as soon as possible (see “Cancellations”).',
            'Treat professionals with respect, and use their contact details and the information they share only for the job.',
          ],
        },
      ],
    },
    {
      id: 'professional-obligations',
      heading: 'If you are a professional',
      blocks: [
        { type: 'paragraph', text: 'You offer your services as an independent business, in your own name and on your own responsibility. You must:' },
        {
          type: 'list',
          items: [
            '**Licenses and permits:** hold every license, permit and qualification that the law requires for the work you offer, and offer only work that you are allowed and able to do.',
            '**Business registration and tax:** be registered with the tax authorities as the law requires, and give customers a receipt or tax invoice for every payment, as the law requires.',
            '**Insurance:** hold the insurance that the law requires for your work. If your profile says that you are insured, keep that insurance in force, and remove the declaration if it lapses.',
            '**Consumer law:** comply with consumer protection law and every other law that applies to your dealings with customers. This includes giving customers the details and documents that the law requires a business to give (such as your full name or business name, your business or ID number and your address), respecting their cancellation rights where these apply, and honouring any warranty that you give or that the law requires.',
            '**Honest profile:** keep your profile accurate and up to date. Enter only a license number that was issued to you and is valid, and describe your experience truthfully.',
            "**Honest offers:** state the full price for the work described, including VAT if you charge VAT. If the final price depends on things you can't know yet (for example, parts or the extent of the damage), say so clearly in the offer message.",
            '**Keep your commitments:** once a customer accepts your offer, confirm the appointment, arrive on time, and do the work with reasonable skill and care, in line with the law and with professional and safety standards. If someone else does the work for you, you remain responsible for it.',
            "**Customers' information:** use a customer's address and other details only to do the job. Don't pass them on to others, and don't send customers advertising without their consent.",
          ],
        },
      ],
    },
    {
      id: 'requests',
      heading: 'Requests',
      blocks: [
        {
          type: 'list',
          items: [
            'A request includes a service category, a description (15 to 1,000 characters), the address and the urgency. You can also add apartment, floor and entrance details to the address, and up to 6 photos.',
            'Your request is published as soon as you post it.',
            "**A published request can't be edited.** To change it, cancel it and post a new one.",
            'A published request is shown to professionals who offer its service category and whose service area covers its location. Until you hire one of them, they see an approximate location, not your address. The Privacy Policy explains exactly what they see.',
            'A request stays open for offers until you accept an offer or cancel the request.',
          ],
        },
      ],
    },
    {
      id: 'offers',
      heading: 'Offers',
      blocks: [
        {
          type: 'list',
          items: [
            'A professional can send an offer on a request that is open for offers, if they offer its service category and the request is within their service area.',
            'An offer states a price in shekels (from ₪20 to ₪200,000) and a proposed start time, and can include a message to the customer.',
            '**One active offer per request:** a professional can have only one pending or accepted offer on a request at a time.',
            "The proposed start must be at least 30 minutes after the offer is sent, no more than 60 days ahead, and within the time allowed for the request's urgency (see below).",
            "**Validity:** a pending offer expires automatically at the end of its validity period, which depends on the request's urgency (see below). It never stays valid after its proposed start time. Editing an offer starts its validity period again from the time of the edit.",
            '**Editing and withdrawing:** while an offer is pending, the professional can edit it or withdraw it, and the customer is notified. After an offer is withdrawn or expires, the professional can send a new one while the request is still open for offers.',
            "**An accepted offer is final:** it can't be edited or withdrawn.",
          ],
        },
        {
          type: 'definitions',
          items: [
            { term: 'Emergency', text: 'The offer is valid for 6 hours. The proposed start must be within 24 hours.' },
            { term: 'Urgent', text: 'The offer is valid for 24 hours. The proposed start must be within 72 hours.' },
            { term: 'Normal', text: 'The offer is valid for 72 hours. The proposed start can be up to 60 days ahead.' },
            { term: 'Flexible', text: 'The offer is valid for 7 days. The proposed start can be up to 60 days ahead.' },
          ],
        },
        {
          type: 'paragraph',
          text: 'By sending an offer, a professional proposes to do the job described in the request on the terms of the offer. If the customer accepts it while it is valid, the professional is bound by it.',
        },
      ],
    },
    {
      id: 'accepting-an-offer',
      heading: 'Accepting an offer',
      blocks: [
        {
          type: 'list',
          items: [
            "A customer can accept one pending offer that hasn't expired, while the request is open for offers. Customers don't have to accept any offer.",
            '**When the customer accepts an offer, an agreement for the job is made between the customer and the professional,** on the terms of the request and of the offer (the work described, the price, the start time and the offer message), and anything else they agree between them. We are not a party to that agreement.',
            'At the same moment, every other pending offer on the request is declined automatically, and those professionals are notified.',
            "A job is created and a chat opens between the customer and the professional. The hired professional can now see the exact address and the apartment, floor and entrance details, and the customer can see the professional's contact details.",
          ],
        },
        {
          type: 'paragraph',
          text: "We recommend that you agree in writing, for example in the chat, on anything that isn't in the offer, such as materials, changes to the scope of the work, payment terms and warranty.",
        },
      ],
    },
    {
      id: 'jobs',
      heading: 'Jobs',
      blocks: [
        { type: 'paragraph', text: 'A job goes through these steps in the app:' },
        {
          type: 'list',
          items: [
            '**Awaiting confirmation:** the professional confirms the appointment (“Confirm appointment”).',
            '**Scheduled:** the professional marks the start of the work (“Start job”).',
            '**In progress:** the work is under way.',
            "**Completed:** once the job is scheduled or in progress, either the customer or the professional can mark it as completed (“Mark as completed”). Do this only when the work is finished. It can't be undone in the app.",
          ],
        },
        {
          type: 'paragraph',
          text: "The job's time in the app is the start time of the accepted offer, and the app has no way to change it. If you agree on another time, agree on it in the chat. Both of you get an appointment reminder about 2 hours before the start, unless you turned appointment reminders off.",
        },
        {
          type: 'paragraph',
          text: "Marking a job as completed records its status in the app. It doesn't confirm that the work was done properly or that it was paid for, and it doesn't affect your rights against each other.",
        },
      ],
    },
    {
      id: 'cancellations',
      heading: 'Cancellations',
      blocks: [
        {
          type: 'list',
          items: [
            '**Customers** can cancel a request at any time before the work starts, that is, until the professional marks the job as started or it is marked as completed. To cancel, open the request, choose a reason and, if you like, add a comment. Professionals who can see the request also see the reason and the comment.',
            "When a request is cancelled, its pending offers are declined, a job that was agreed for it is cancelled and its chat is closed, the professionals involved are notified, and the request's photos are deleted.",
            "**After the work has started,** the job can't be cancelled in the app, except that it is cancelled if either of you deletes their account (see “Deleting your account”). Settle any change directly with the professional.",
            "**If the professional you hired deletes their account,** the job and its request are cancelled and the request's photos are deleted. You are notified, unless you turned off “Offers & job updates” notifications, and you can post a new request.",
            "**Professionals** can withdraw a pending offer, but can't cancel a job after the customer has accepted their offer, other than by deleting their account, which cancels it but doesn't release them from what they agreed (see “Deleting your account”). If you can't do an accepted job, tell the customer in the chat right away and ask them to cancel the request; the customer can cancel it until the work starts. If you can't reach the customer, tell us at [{{contactEmail}}](mailto:{{contactEmail}}) and we will try to reach them by email. We can't cancel the job for you: it stays in the app until the customer cancels the request.",
          ],
        },
        {
          type: 'paragraph',
          text: "Cancelling in the app doesn't decide what the customer and the professional owe each other, for example for work already done or for a late cancellation. That depends on their agreement and on the law, including consumers' cancellation rights. We don't charge any cancellation fee.",
        },
      ],
    },
    {
      id: 'chat',
      heading: 'Chat',
      blocks: [
        {
          type: 'list',
          items: [
            'A chat opens between the customer and the professional when the customer accepts an offer. Only the two of them can see it. Before that, the only way a professional can address the customer is the offer message.',
            "Use the chat for the job. Messages are text only, up to 2,000 characters each, and can't be edited or deleted after they are sent.",
            'The chat stays open after the job is completed, so you can follow up. It closes, and no new messages can be sent, when the job is cancelled or when either of you deletes their account.',
            "Don't send passwords or payment card details in the chat.",
            "We don't monitor chats. We read messages only when this is needed to look into a report or a suspected breach of these terms, to protect someone's safety, or when the law requires it.",
          ],
        },
      ],
    },
    {
      id: 'reviews',
      heading: 'Reviews and ratings',
      blocks: [
        {
          type: 'list',
          items: [
            'Only the customer of a job can review it, only after the job is marked as completed, and only once. A review has a star rating from 1 to 5 and an optional comment of up to 800 characters.',
            "Reviews appear on the professional's profile with the reviewer's short name and profile photo, and count toward the professional's average rating.",
            "**Be honest.** Describe only your own experience of the job, and don't include personal information, insults or anything unlawful.",
            "**No incentives or pressure.** Professionals must not offer or give anything (such as money, a discount or a free service) for a review or for a better review, and must not pressure customers about their review. Customers must not ask for anything in exchange for a review, or threaten to write a bad one. Nobody may review their own business, or a competitor's, through another account.",
            "Reviews can't be edited or deleted in the app, and professionals can't reply to them in the app. If you think a review breaks these terms, tell us (see “Reporting problems and abuse”).",
            "We may remove a review that breaks these terms or the law, or when a court or a competent authority orders us to. A removed review no longer counts toward the professional's rating. We don't remove reviews just because they are negative.",
          ],
        },
      ],
    },
    {
      id: 'ranking',
      heading: 'How results are ordered',
      blocks: [
        {
          type: 'list',
          items: [
            "**Offers on a request** are shown to the customer in “Recommended” order, unless the customer chooses “Lowest price” or “Earliest”. “Recommended” combines the offer's price, how soon the professional can start, the professional's rating and their number of reviews.",
            '**Ratings** used for ordering are adjusted for the number of reviews, so that a rating based on a few reviews counts for less than one based on many.',
            '**Requests** are shown to professionals newest first, filtered by the services, distance and urgency they choose.',
            'If the app shows a list of professionals, those with a higher rating (adjusted in the same way) come first.',
            '**No paid placement.** Nobody can pay to be shown higher, and we receive no payment that affects the order.',
          ],
        },
      ],
    },
    {
      id: 'the-service',
      heading: 'The service and its limits',
      blocks: [
        {
          type: 'paragraph',
          text: 'We work to keep Professionals available and working properly, but it may sometimes be unavailable or slow, for example during maintenance or because of failures of the internet or of our service providers.',
        },
        {
          type: 'paragraph',
          text: 'We may change, add or remove features. If a change significantly reduces what you can do in the app, we will tell you in advance where reasonably possible.',
        },
        {
          type: 'paragraph',
          text: 'To protect the service from abuse, the app limits how often some actions can be done. For example, a customer can create up to 30 requests per hour, a professional can send up to 60 offers per 10 minutes, and each user can send up to 60 chat messages per minute. If you reach a limit, wait a little and try again.',
        },
        {
          type: 'paragraph',
          text: 'Maps, distances and address search results are approximate and may contain mistakes. Check the address before you publish a request or travel to a job.',
        },
        {
          type: 'paragraph',
          text: 'We send you notifications about requests, offers, jobs and messages, and appointment reminders. You can choose which ones you get in Settings under Notifications.',
        },
      ],
    },
    {
      id: 'prohibited-conduct',
      heading: 'What you must not do',
      blocks: [
        { type: 'paragraph', text: 'When you use Professionals, you must not:' },
        {
          type: 'list',
          items: [
            'break the law, or use the app for work that you are not allowed to do;',
            'give false information, pretend to be someone else, or open an account for someone else without their permission;',
            "post fake requests, offers or reviews, or send offers that you don't intend to honour;",
            'harass, threaten or insult anyone, or discriminate against anyone on grounds the law prohibits;',
            "post content that is false, misleading, defamatory, obscene or offensive, that infringes anyone's rights (such as copyright or privacy), or that contains another person's personal information without their permission;",
            "use other users' details for anything other than the job, such as marketing, or pass them on to others;",
            'send spam or advertising, or promote services unrelated to the job;',
            'use a second account to review yourself, to send offers on your own requests, or to come back after we closed your account;',
            'use the service other than through the app or our public web pages, for example with bots, scrapers or scripts; collect data from it; or try to get around its limits or security;',
            'interfere with the service, overload it, or introduce viruses or other harmful code;',
            "access another user's account or data;",
            'copy, modify or reverse-engineer the app, except as the law allows.',
          ],
        },
      ],
    },
    {
      id: 'your-content',
      heading: 'Your content',
      blocks: [
        {
          type: 'list',
          items: [
            "You own the content you post. You are responsible for it, and you confirm that you have the right to post it and that it doesn't break the law or these terms.",
            "You give us a non-exclusive, royalty-free license to host, store, copy, adapt (for example, resize photos), display and transmit your content, only as needed to operate and secure the service and to show it to other users as described in these terms and in the Privacy Policy. We don't use your content for advertising, and we don't sell it.",
            "The license lasts while your content is in the service. It ends when you delete the content or your account, except for content that stays as the other party's record, as the Privacy Policy describes (for example, messages you sent and your review ratings).",
            "We don't check content before it is published. We may remove content that breaks these terms or the law.",
          ],
        },
      ],
    },
    {
      id: 'reporting',
      heading: 'Reporting problems and abuse',
      blocks: [
        {
          type: 'paragraph',
          text: "If another user breaks these terms, if you see content that is unlawful or infringes your rights, if a review breaks the review rules, or if you have a problem with the service, email us at [{{contactEmail}}](mailto:{{contactEmail}}). The app doesn't have a report or block button, so email is the way to tell us.",
        },
        {
          type: 'paragraph',
          text: "Please include your account's email address, what happened and when, the request or job concerned, the other user's name as shown in the app, and screenshots if you have them.",
        },
        {
          type: 'paragraph',
          text: "We look into the reports we receive and may act as described in “Removing content and closing accounts”. To protect other users' privacy, we may not be able to tell you what we did about another user.",
        },
        { type: 'paragraph', text: 'In an emergency, or if anyone is in danger, contact the police or the emergency services first.' },
        {
          type: 'paragraph',
          text: "Disagreements between a customer and a professional are for them to resolve. We may try to help, but we are not an arbitrator and we don't decide who is right.",
        },
      ],
    },
    {
      id: 'removing-content-and-closing',
      heading: 'Removing content and closing accounts',
      blocks: [
        { type: 'paragraph', text: 'We may remove specific content, or close your account, if:' },
        {
          type: 'list',
          items: [
            'you are under 18;',
            'you seriously or repeatedly break these terms or the law;',
            "you gave false information, such as a license number or an insurance declaration that isn't true;",
            "your account is used for fraud, harassment, spam or fake reviews, or puts other users' safety at risk;",
            'your account was taken over by someone else; or',
            'the law, a court or a competent authority requires it.',
          ],
        },
        {
          type: 'paragraph',
          text: "**Notice.** Before we act, we will email you the reason and give you a reasonable opportunity to respond, unless there is an urgent risk to users or to the service, or the law doesn't allow it. In those cases, we will tell you the reason promptly after we act.",
        },
        {
          type: 'paragraph',
          text: "**Objection.** You can object to any such action by writing to [{{contactEmail}}](mailto:{{contactEmail}}). We will review your objection and tell you our decision and the reasons for it. If we find that we were wrong, we will restore content we removed where this is possible. A closed account can't be restored.",
        },
        {
          type: 'paragraph',
          text: "**Closing an account deletes it** permanently, with the effects described in “Deleting your account”, and it can't be reversed. We close an account only after the notice and objection steps above, and at least 14 days after our notice, unless a court or the law requires us to act at once, or a user's safety is at immediate risk.",
        },
        {
          type: 'paragraph',
          text: 'We act in proportion to the problem: where possible, we remove specific content rather than close the account.',
        },
        {
          type: 'paragraph',
          text: 'You can stop using Professionals at any time and delete your account in the app. If we decide to stop operating Professionals, we will tell you reasonably in advance, by email.',
        },
      ],
    },
    {
      id: 'deleting-your-account',
      heading: 'Deleting your account',
      blocks: [
        {
          type: 'paragraph',
          text: "You can delete your account at any time. **In the app:** open Settings (from the Profile tab) and choose **Delete account**. The app first shows you what will happen to your open requests, offers and jobs, then asks you to confirm with your password (or with Google, if your account has no password). Your account is deleted immediately, and this can't be undone.",
        },
        {
          type: 'paragraph',
          text: "**Without the app:** email [{{contactEmail}}](mailto:{{contactEmail}}) from your account's email address and ask us to delete your account. We reply to that address to confirm the request, and we delete the account within 30 days of your confirmation. The [account deletion page]({{deletionUrl}}) explains the steps.",
        },
        { type: 'paragraph', text: '**What happens to your open items:**' },
        {
          type: 'list',
          items: [
            'Customers: your open requests are cancelled, and all pending offers on them are declined.',
            'Professionals: all your pending offers are withdrawn.',
            'Both roles: your active jobs are cancelled, including jobs already in progress, and all your chats are closed.',
            'The other users involved are notified, unless they turned off “Offers & job updates” notifications.',
          ],
        },
        {
          type: 'paragraph',
          text: "Deleting your account doesn't release you from obligations you already have toward another user under an agreement made through the app, for example to pay for work already done, or a warranty on work you did.",
        },
        {
          type: 'paragraph',
          text: 'Some records stay for the people you dealt with, such as jobs, the ratings you gave (without comments), your requests that received offers, and the chat messages you sent. They no longer show your name, contact details or photo: you are shown as “Deleted user”. Texts you wrote stay as you wrote them. These records are deleted once everyone involved has deleted their account. The [Privacy Policy]({{privacyUrl}}) explains exactly what is deleted and what is kept.',
        },
      ],
    },
    {
      id: 'intellectual-property',
      heading: 'Intellectual property',
      blocks: [
        {
          type: 'paragraph',
          text: "The app and its software, design, texts and graphics, other than users' content and third-party material, belong to us or to our licensors and are protected by law.",
        },
        {
          type: 'paragraph',
          text: 'We give you a personal, non-exclusive, non-transferable license to use the app for its intended purpose, under these terms. You may not copy, sell, rent, modify or distribute the app or any part of it, except as the law allows. The app includes open-source software, which is licensed under its own terms.',
        },
        {
          type: 'paragraph',
          text: '**Maps and addresses.** Maps and address search in the app use data from OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License (ODbL). See [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).',
        },
        {
          type: 'paragraph',
          text: 'If you believe that content in the app infringes your copyright or other rights, email us at [{{contactEmail}}](mailto:{{contactEmail}}) with the details.',
        },
      ],
    },
    {
      id: 'other-services',
      heading: "Other companies' services",
      blocks: [
        {
          type: 'paragraph',
          text: "Some features rely on other companies' services, such as Google sign-in, OpenStreetMap maps and the app stores. Their own terms apply to your use of those services, and we are not responsible for them.",
        },
        {
          type: 'paragraph',
          text: "If you downloaded the app from an app store, the store's terms also apply to the download. The store operator is not a party to these terms and is not responsible for the app.",
        },
      ],
    },
    {
      id: 'our-responsibility',
      heading: 'Our responsibility and its limits',
      blocks: [
        {
          type: 'paragraph',
          text: "We provide Professionals with reasonable care and skill. Beyond that, and beyond what the law requires, the service is provided as it is and as available: we don't promise that it will always be available, free of errors or suited to your particular needs.",
        },
        {
          type: 'paragraph',
          text: 'Because we are not a party to agreements between users, and except where the loss results from our own breach of these terms, our negligence, or our failure to act as these terms say (for example, on a report under “Reporting problems and abuse”), **we are not responsible for:**',
        },
        {
          type: 'list',
          items: [
            'the work of professionals, its quality, safety, legality, timing or price, or any damage it causes;',
            'what users do or fail to do, or what they say or post, including profile details, offers, messages and reviews;',
            'payments between users, and any dispute about them;',
            "loss or damage caused by services of others that we don't control (such as internet providers, app stores, Google or OpenStreetMap), or by events beyond our reasonable control.",
          ],
        },
        {
          type: 'paragraph',
          text: '**Limits.** Where we are liable, we are liable only for damage that was a foreseeable result of our breach of these terms or of our negligence. Toward professionals, who use the app in the course of their business, we are not liable for loss of profits, income, business or goodwill.',
        },
        {
          type: 'paragraph',
          text: "**What we never limit.** Nothing in these terms excludes or limits our liability for death or bodily injury caused by our negligence, for gross negligence, or for wilful misconduct or fraud, or any liability or right that the law doesn't allow to be limited or waived, including your rights under the Consumer Protection Law, 5741-1981, and the Privacy Protection Law, 5741-1981.",
        },
      ],
    },
    {
      id: 'your-responsibility',
      heading: 'Your responsibility for a breach',
      blocks: [
        {
          type: 'paragraph',
          text: 'If someone makes a claim against us because you breached these terms or the law, or because of content you posted, you will compensate us for the damage and the reasonable costs we incur because of it, including reasonable legal fees, to the extent that they were caused by your breach.',
        },
        {
          type: 'paragraph',
          text: "This doesn't apply to the extent that the claim results from our own act or omission. We will tell you about the claim promptly, let you defend it or take part in its defence, and won't settle it at your expense without your consent, which you won't unreasonably refuse.",
        },
      ],
    },
    {
      id: 'changes-to-terms',
      heading: 'Changes to these terms',
      blocks: [
        {
          type: 'list',
          items: [
            'We may change these terms, for example when we add features, when the law changes, or to correct mistakes.',
            "**Advance notice:** we will email you about a change at least 14 days before it takes effect, at your account's email address. The email will explain what is changing and when, and include the new text.",
            "**No retroactive effect:** a change applies only from its effective date. It doesn't change offers already sent, jobs already agreed, or anything that happened before that date.",
            "**Your choice:** if you don't agree to a change, you can stop using Professionals and delete your account before the change takes effect. If you keep using the app after that date, the new terms apply to you.",
            'A change may take effect sooner only if the law requires it, or if it is only in your favour.',
            'The version in force and its effective date are always available at [{{termsUrl}}]({{termsUrl}}) and in the app. A new version is published there on the day it takes effect.',
          ],
        },
      ],
    },
    {
      id: 'law-and-disputes',
      heading: 'Law and disputes',
      blocks: [
        { type: 'paragraph', text: 'These terms are governed by the laws of the State of Israel.' },
        {
          type: 'paragraph',
          text: "A dispute about these terms or the service may be brought before the competent court in Israel, under the usual rules on which court has jurisdiction. We don't require arbitration, and you may bring a claim in the small claims court where it has jurisdiction.",
        },
        {
          type: 'paragraph',
          text: 'Before going to court, we encourage you to contact us so that we can try to solve the problem. This is not a condition for bringing a claim.',
        },
      ],
    },
    {
      id: 'privacy',
      heading: 'Privacy',
      blocks: [
        {
          type: 'paragraph',
          text: 'Our [Privacy Policy]({{privacyUrl}}) explains what personal data we collect, what other users can see, who we share it with, how long we keep it and what your rights are. Please read it together with these terms.',
        },
      ],
    },
    {
      id: 'general',
      heading: 'General',
      blocks: [
        {
          type: 'list',
          items: [
            "**Notices:** we send notices to your account's email address. You can send us notices by email to [{{contactEmail}}](mailto:{{contactEmail}}) or by post to our address.",
            '**Transfer:** you may not transfer your account or your rights under these terms. We may transfer the service and these terms to another operator (for example, in a merger or a sale), provided that your rights under these terms are not reduced. We will tell you before that happens.',
            '**Invalid terms:** if a court finds any part of these terms invalid, the rest stays in force.',
            "**No waiver:** if we don't enforce a right straight away, we haven't given it up.",
            '**Whole agreement:** these terms, together with the documents they refer to, are the whole agreement between you and us about the service.',
          ],
        },
      ],
    },
    {
      id: 'language-versions',
      heading: 'Hebrew and English versions',
      blocks: [
        {
          type: 'paragraph',
          text: 'These terms are published in Hebrew and in English. If the two versions differ, the Hebrew version prevails. The Hebrew version uses the masculine form for convenience only; it refers to people of all genders.',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [
        { type: 'paragraph', text: 'For questions about these terms, or to report a problem, contact us:' },
        {
          type: 'definitions',
          items: [
            { term: 'Email', text: '[{{contactEmail}}](mailto:{{contactEmail}})' },
            { term: 'Post', text: '{{operatorName}}, {{operatorAddress}}' },
          ],
        },
      ],
    },
  ],
};
