/**
 * Privacy Policy, English. Placeholders are expanded when served (`legal-placeholders.ts`). Where the
 * versions differ, the Hebrew one (`privacy.he.ts`) prevails.
 */
import type { LegalDocumentContent } from './types.js';

export const privacyEn: LegalDocumentContent = {
  title: 'Privacy Policy',
  intro: [
    'This Privacy Policy explains what personal data the Professionals app collects, why we collect it, who can see it, and what choices you have. It applies to the mobile app, the web version and our public web pages.',
    "Professionals is a marketplace in Israel that connects customers who need a home service with independent professionals. We use only the data needed to run it. We don't sell your data and we don't show ads.",
    'Please read it together with our [Terms of Use]({{termsUrl}}).',
  ],
  sections: [
    {
      id: 'key-points',
      heading: 'Key points',
      blocks: [
        {
          type: 'list',
          items: [
            "**We don't sell or rent your data.** The app has no ads, analytics or tracking tools.",
            "**Professionals don't see a customer's exact address** until the customer accepts their offer. Before that, they see an approximate location with the city and neighbourhood.",
            "**A customer's phone number and email address are never shown to other users.** A professional's contact details are shown only to customers who hire them.",
            '**Location is used only when you ask for it:** once, while you use the app, never in the background.',
            '**You can delete your account in the app** at any time, in Settings.',
            '**You have rights** to access and correct your data, and to complain to the Privacy Protection Authority.',
          ],
        },
      ],
    },
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: [
        { type: 'paragraph', text: 'The Professionals app is operated by:' },
        {
          type: 'definitions',
          items: [
            { term: 'Operator', text: '{{operatorName}} {{operatorRegistration}}' },
            { term: 'Address', text: '{{operatorAddress}}' },
            { term: 'Email', text: '[{{contactEmail}}](mailto:{{contactEmail}})' },
          ],
        },
        {
          type: 'paragraph',
          text: 'We are the controller of the database that holds your personal data, within the meaning of the Privacy Protection Law, 5741-1981. In this policy, “we”, “us” and “our” mean the operator.',
        },
        {
          type: 'paragraph',
          text: 'For any question about privacy or this policy, or to use your rights, write to us at [{{contactEmail}}](mailto:{{contactEmail}}). We answer within 30 days.',
        },
      ],
    },
    {
      id: 'scope',
      heading: 'Who this policy applies to',
      blocks: [
        {
          type: 'paragraph',
          text: 'This policy applies to everyone who uses Professionals: customers, professionals, and visitors to our public web pages.',
        },
        {
          type: 'paragraph',
          text: 'Professionals is intended for people in Israel. **You must be 18 or older to use it.** When you sign up, you confirm that you are 18 or older.',
        },
        {
          type: 'paragraph',
          text: 'Each account has one role: customer or professional. To use both roles, you need a second account with a different email address.',
        },
        {
          type: 'paragraph',
          text: "You can read this policy at any time: on the app's sign-in screen, in Settings under Legal, and at [{{privacyUrl}}]({{privacyUrl}}).",
        },
      ],
    },
    {
      id: 'information-you-provide',
      heading: 'Information you give us',
      blocks: [
        { type: 'paragraph', text: 'We collect the information you enter in the app. What we collect depends on your role.' },
        {
          type: 'definitions',
          items: [
            {
              term: 'Account (everyone)',
              text: "Your role (customer or professional), first and last name, email address, phone number, password, and the app language you use (English or Hebrew). We store your password only as a one-way hash (argon2id), so nobody can read it. If you sign up with Google, you don't need a password.",
            },
            {
              term: 'Terms acceptance',
              text: 'Which version of the Terms of Use and this Privacy Policy you accepted when you signed up, and when. By ticking that box, you also confirm that you are 18 or older.',
            },
            { term: 'Profile photo', text: 'A photo you add to your profile. This is optional.' },
            { term: 'Notification settings', text: 'Which notifications you want to receive, and whether by push or email.' },
            {
              term: 'Customers: default address',
              text: 'An address for your requests: street address, city, neighbourhood, optional apartment, floor and entrance details, and its point on the map. The address of your first request is saved as your default address. You can change it in your profile.',
            },
            {
              term: 'Customers: requests',
              text: 'The service category, a description of the problem, the address and its point on the map, optional apartment, floor and entrance details, the urgency, and optional photos (up to 6). A request can also hold a preferred date and time window and access notes for the professional.',
            },
            {
              term: 'Customers: cancellations and reviews',
              text: 'If you cancel a request, the reason and an optional comment. After a completed job, your review: a star rating and an optional comment.',
            },
            {
              term: 'Professionals: profile',
              text: "Your full name, display name, business name, headline, bio, service categories, years of experience, base address and its point on the map, service radius and service-area name, weekly availability and whether you take emergency calls, contact phone, email and website, license number, whether you are insured, the languages you speak, and a starting price. License and insurance details are your own declaration; we don't check them.",
            },
            {
              term: 'Professionals: offers',
              text: 'The price, the proposed start time, an estimated duration and an optional message to the customer.',
            },
            {
              term: 'Messages',
              text: "The messages you send in a job's chat, when you sent them, and when the other person read them (read receipts).",
            },
            { term: 'Emails to us', text: 'If you write to us, your email address and what you write.' },
          ],
        },
        {
          type: 'paragraph',
          text: "Please don't put sensitive information, such as health details or ID numbers, in descriptions, photos, messages or reviews unless the job really needs it.",
        },
      ],
    },
    {
      id: 'information-from-google',
      heading: 'Information we receive from Google',
      blocks: [
        {
          type: 'paragraph',
          text: 'If you choose “Continue with Google”, Google asks you to let Professionals see your basic profile. Google then sends us your name, your email address (only if Google has verified it), your Google account ID and a link to your Google profile photo. We never see your Google password.',
        },
        {
          type: 'paragraph',
          text: 'We use this to create your account or to sign you in. Your Google profile photo becomes your profile photo until you change or remove it.',
        },
        {
          type: 'paragraph',
          text: "If an account with the same email address already exists, signing in with Google links Google to that account. If that account's email address was not verified yet, its password is removed and you sign in with Google from then on.",
        },
        { type: 'paragraph', text: 'See also “Google user data” below.' },
      ],
    },
    {
      id: 'information-from-other-users',
      heading: 'Information from other users',
      blocks: [
        {
          type: 'paragraph',
          text: "Other users add information about you when you work together: a customer's review and rating of a professional, the messages in a job's chat, and the records of offers and jobs between you (for example, the agreed price and dates).",
        },
      ],
    },
    {
      id: 'information-collected-automatically',
      heading: 'Information collected automatically',
      blocks: [
        {
          type: 'definitions',
          items: [
            {
              term: 'Activity records',
              text: "The dates and statuses of your requests, offers and jobs, and statistics such as a professional's average rating and number of completed jobs.",
            },
            {
              term: 'Sign-in sessions',
              text: 'When you sign in, we create a session for that device. On our side we keep only a hash of the session token.',
            },
            {
              term: 'Push token',
              text: "If you allow notifications on your phone, the app sends us a push token for that signed-in installation, so we can send you notifications. We don't store your device model or operating system. The web version doesn't use push notifications.",
            },
            { term: 'Location', text: 'Only when you tap “Use my current location”. See “Device permissions”.' },
            {
              term: 'Address lookups',
              text: 'When you type an address or move the pin on a map, the app sends the text or the point to our server to find matching addresses.',
            },
            {
              term: 'IP address',
              text: "Our servers receive your device's IP address when the app connects. Apart from delivering the connection, we use it only to limit repeated or abusive requests and to protect sign-in against password guessing. For this, it is kept in short-lived counters: from minutes to hours in general, and up to 30 days in sign-in protection records (together with a hash of the account's email address, not the email address itself).",
            },
            {
              term: 'Server logs',
              text: "For each request to our server, we log the time, the type of request, the web address requested (with secret tokens masked), the result and how long it took. The web address can include text typed into an address search, map coordinates and internal record numbers. Apart from that, the logs don't include what you send (such as messages, photos or passwords), and they don't include your IP address. Error entries may include internal account numbers.",
            },
          ],
        },
      ],
    },
    {
      id: 'required-and-optional',
      heading: 'What you must provide and what is optional',
      blocks: [
        {
          type: 'paragraph',
          text: "No law requires you to give us personal data. You give it by choice. But the app can't work without some of it:",
        },
        {
          type: 'list',
          items: [
            "**To open an account:** role, first and last name, email address, phone number, a password (or Google sign-in), the app language, and your confirmation that you are 18 or older and accept the Terms of Use and this policy. Without these, we can't open your account.",
            '**To open a professional account,** also: at least one service category, a base address (point on the map, street address and city) and a service radius.',
            "**To post a request:** service category, description, address (point on the map, street address and city) and urgency. Without these, you can't post the request.",
            "**To send an offer:** price and proposed start time. Without these, you can't send the offer.",
            '**To write a review:** a star rating. **To cancel a request:** a reason.',
            '**Professional profile:** some fields must stay filled in: full name, display name, service categories, service area, availability, contact phone and email, and languages. At sign-up we fill them in from your sign-up details and default settings, and you can change them.',
          ],
        },
        { type: 'paragraph', text: 'Everything else is optional, including:' },
        {
          type: 'list',
          items: [
            'your profile photo;',
            'for requests: apartment, floor and entrance details, access notes, a preferred date and time, and photos;',
            'for professionals: business name, headline, bio, years of experience, license number, insurance, website and starting price;',
            "an offer's message and duration, and review and cancellation comments;",
            'every device permission (location, camera, photos, notifications).',
          ],
        },
        {
          type: 'paragraph',
          text: 'If you leave them out, the app still works. For example, without location permission you can type the address or pick it on the map; without photos, professionals have less information for their offer.',
        },
        {
          type: 'paragraph',
          text: 'Why we use the data and who receives it are explained in “Why we use your information”, “What other users can see” and “Service providers and other recipients”.',
        },
      ],
    },
    {
      id: 'purposes',
      heading: 'Why we use your information',
      blocks: [
        {
          type: 'list',
          items: [
            'To create and manage your account, sign you in and keep you signed in.',
            'To show your request to professionals whose services and area match it, and to show professionals the requests in their area.',
            'To let customers and professionals send and compare offers, agree on a job, chat, schedule and complete the job, and leave a review.',
            'To show professional profiles, ratings and reviews.',
            'To send notifications about your requests, offers, jobs and messages, appointment reminders, and account emails (email verification, password reset and account deletion).',
            'To keep the service safe: to protect accounts, limit abuse and repeated attempts, check new passwords against known leaked passwords, and investigate problems.',
            'To answer your questions and handle your requests, including requests to use your rights.',
            'To comply with the law, and to establish or defend legal claims.',
          ],
        },
        {
          type: 'paragraph',
          text: "We don't use your data for advertising or marketing, and we don't build profiles about you for any other purpose.",
        },
      ],
    },
    {
      id: 'what-others-see',
      heading: 'What other users can see',
      blocks: [
        {
          type: 'paragraph',
          text: 'Professionals is a marketplace, so some of your information is shown to other users. Accounts are open to the public, so treat what other users can see as visible to anyone who uses the app.',
        },
        {
          type: 'paragraph',
          text: '**Your requests.** Professionals whose service categories and area match a request, and any professional who has sent an offer on it, see:',
        },
        {
          type: 'list',
          items: [
            'the category, description, photos, urgency and preferred date and time;',
            "the city and neighbourhood, and an approximate point on the map placed 250–450 metres from the real address (the exact offset comes from a secret key, so your address can't be calculated back from it);",
            'your short name (first name and last initial, like “Noa L.”), your profile photo, when you joined and how many jobs you have completed;',
            'if you cancel the request, the reason and your comment.',
          ],
        },
        {
          type: 'paragraph',
          text: "They don't see the street address, the apartment, floor and entrance details, or your access notes, unless you hire them.",
        },
        {
          type: 'paragraph',
          text: '**After you accept an offer,** the professional you hire also sees the exact address, the apartment, floor and entrance details, your access notes, and your full name in the chat. This stays in their job record after the job is completed or cancelled. See “Deleting your account” for what happens when you delete your account.',
        },
        {
          type: 'definitions',
          items: [
            { term: "Customers' contact details", text: "A customer's phone number and email address are never shown to other users." },
            {
              term: 'Professional profiles',
              text: "Any signed-in user can see a professional's profile: display name (the business name, or the professional's own name if no business name was given), profile photo, headline, bio, service categories, years of experience, weekly availability, starting price, business name, license number, insurance declaration, languages, ratings, reviews, statistics such as completed jobs, and when the professional joined.",
            },
            {
              term: "Professionals' location",
              text: 'Profiles show the city and neighbourhood of the base address and an approximate service-area centre (moved in the same way as request locations) with its radius and name. The exact base address is never shown.',
            },
            {
              term: "Professionals' contact details",
              text: "A professional's contact phone, email and website are shown only to customers who hired them: from the moment the customer accepts the offer, and afterwards, unless that job was cancelled.",
            },
            {
              term: 'Offers',
              text: 'The customer who posted a request sees each offer on it: the price, proposed start time, estimated duration and message, and a summary of the professional (display name, photo, headline, categories, experience, rating, number of reviews and completed jobs, and city).',
            },
            {
              term: 'Reviews',
              text: "Reviews appear on the professional's profile with the reviewer's short name and profile photo, the star rating, the comment, the service category and the date. Reviews can't be edited or deleted in the app.",
            },
            {
              term: 'Chat',
              text: "Only the customer and the professional of a job can see its chat. Each side can see when their messages were read. Messages can't be edited or deleted.",
            },
            {
              term: 'Notifications to the other party',
              text: "Notifications we send to the people you deal with can include your name (a professional's display name; a customer's short name, or full name in chat-message notifications), prices, dates and a short preview of a chat message.",
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Photos and profile photos are delivered from our image provider through web links. The links are not password-protected: anyone who has a link can open that image.',
        },
      ],
    },
    {
      id: 'service-providers',
      heading: 'Service providers and other recipients',
      blocks: [
        { type: 'paragraph', text: 'We share personal data only as described in this policy. We use these service providers to run the app:' },
        {
          type: 'definitions',
          items: [
            {
              term: 'Cloud hosting providers',
              text: 'Run our servers, database and cache, and host the web version. They store all the data described in this policy on our behalf. Their servers may be outside Israel.',
            },
            {
              term: 'Cloudinary',
              text: "Stores and delivers photos and profile photos. It receives the images you upload. When anyone views an image in the app, their device loads it directly from Cloudinary's network, which receives that viewer's IP address.",
            },
            {
              term: 'Resend',
              text: 'Sends our emails. It receives your email address, your name and the content of the email, which can include notification texts.',
            },
            {
              term: 'Expo push service, Apple Push Notification service and Firebase Cloud Messaging (Google)',
              text: "Deliver push notifications to phones. They receive the push token and the notification's title and text. When you allow notifications, your phone also registers with Expo and with Apple or Google to get a push token.",
            },
            {
              term: 'Google',
              text: "Provides “Continue with Google” sign-in (see “Information we receive from Google”). Profile photos of accounts created with Google are loaded by viewers' devices directly from Google's servers, which receive the viewer's IP address.",
            },
            {
              term: 'OpenStreetMap Foundation: address search',
              text: 'Our server uses its Nominatim service to look up addresses. It receives only the text typed into an address search, or map coordinates rounded to about 11 metres, never your name, your account or your IP address. We keep lookup results in a cache, without any link to you, for up to 30 days.',
            },
            {
              term: 'OpenStreetMap Foundation: maps',
              text: "Maps in the app are loaded by your device directly from OpenStreetMap's tile servers, which receive your IP address and the map area you view.",
            },
            {
              term: 'Have I Been Pwned (Pwned Passwords)',
              text: 'When you choose a new password, our server checks whether it appears in known data breaches. It sends only the first 5 characters of a hash of the password, never the password itself or your email address.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Our cloud hosting providers, Cloudinary, Resend and Expo process data on our behalf under agreements with us. Google, Apple, the OpenStreetMap Foundation and Have I Been Pwned provide their services under their own terms and privacy policies.',
        },
        {
          type: 'paragraph',
          text: "We may also disclose personal data when the law requires it (for example, under a court order or a lawful demand by an authority), and when it is needed to establish or defend legal claims or to protect someone's safety.",
        },
        {
          type: 'paragraph',
          text: 'If the service is transferred to another operator (for example, in a merger or a sale), your data may be transferred with it, subject to this policy. We will tell you before that happens.',
        },
      ],
    },
    {
      id: 'transfers-abroad',
      heading: 'Storage and transfer outside Israel',
      blocks: [
        {
          type: 'paragraph',
          text: 'Some of our service providers store or process personal data outside Israel, in particular in the United States, the European Union and the United Kingdom. Our database, the images you upload, our emails and push notifications may therefore be held or handled abroad.',
        },
        {
          type: 'paragraph',
          text: 'We transfer personal data abroad in accordance with the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 5761-2001. For the providers that process data on our behalf, we rely on agreements in which they undertake to protect the data and to use it only to provide their service to us.',
        },
      ],
    },
    {
      id: 'notifications',
      heading: 'Notifications and emails',
      blocks: [
        { type: 'paragraph', text: "We send only service messages about your account and your activity in the app. We don't send marketing." },
        {
          type: 'definitions',
          items: [
            {
              term: 'In-app notifications',
              text: 'About offers and job updates, messages, appointment reminders and, for professionals, new requests in their area. They are deleted automatically after 90 days.',
            },
            {
              term: 'Push notifications (phones)',
              text: 'The same notifications, sent to your phone. They can appear on your lock screen. Push is on by default; the app asks for your permission shortly after you sign in on a phone.',
            },
            {
              term: 'Email updates',
              text: 'Off by default. If you turn them on, we send the same notifications by email, and only to a verified email address.',
            },
            {
              term: 'Account emails',
              text: 'Email verification, password reset and, if you delete your account, a confirmation. We send these when needed, whatever your notification settings.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Notifications can include names, the service category, prices, dates and times, distances, star ratings and up to 90 characters of a chat message. Push notifications pass through Expo and Apple or Google, and emails through Resend (see “Service providers and other recipients”).',
        },
        {
          type: 'paragraph',
          text: "To change what you receive, go to Settings → Notifications. You can turn off push notifications, email updates, and each type: offers and job updates, messages, appointment reminders and, for professionals, new requests nearby. If you turn off a type, we don't create those notifications at all, not even in the app. You can also block notifications in your phone's settings.",
        },
      ],
    },
    {
      id: 'device-permissions',
      heading: 'Device permissions',
      blocks: [
        {
          type: 'paragraph',
          text: "The app asks for a permission only when a feature needs it. You can refuse, and you can change your choice at any time in your phone's settings (or your browser's settings on the web).",
        },
        {
          type: 'definitions',
          items: [
            {
              term: 'Location',
              text: "Used only when you tap “Use my current location” while entering an address. The app gets your position once, while you are using it, and never in the background. It doesn't track your location. The point is sent to our server to find the address, and it is stored only if you save that address. Without this permission, you can type the address or pick it on the map.",
            },
            { term: 'Camera', text: 'Used only when you choose “Take a photo” to add a photo to a request (phones only).' },
            {
              term: 'Photos',
              text: "The app opens your phone's photo picker, so it gets only the photos you choose, for a request or as your profile photo. On some older Android phones, the app asks for access to your photos to open the picker.",
            },
            { term: 'Notifications', text: 'Used for push notifications. See “Notifications and emails”.' },
          ],
        },
        {
          type: 'paragraph',
          text: "The app doesn't ask for access to your microphone, contacts or calendar, doesn't use location in the background, and doesn't ask to track you across other companies' apps and websites.",
        },
      ],
    },
    {
      id: 'photos-and-metadata',
      heading: 'Photos and the information inside them',
      blocks: [
        {
          type: 'paragraph',
          text: 'Photos can contain hidden information added by the camera or phone, such as the date, the device model and the place where the photo was taken.',
        },
        {
          type: 'paragraph',
          text: "Depending on your phone and how you add a photo, this information may be uploaded with it. Our image provider stores photos in a resized and re-compressed form. The app doesn't use or show this embedded information, but we can't promise that it is removed from every stored photo.",
        },
        {
          type: 'paragraph',
          text: "Professionals can see request photos before you accept an offer. If you don't want to share where a photo was taken, turn off location tagging in your camera settings before taking photos for the app. Also avoid photos that show things you don't want to share, such as documents, faces or your house number.",
        },
      ],
    },
    {
      id: 'no-ads-no-tracking',
      heading: 'No ads, no tracking, no sale of data',
      blocks: [
        {
          type: 'list',
          items: [
            'The app has no advertising, analytics, tracking or crash-reporting tools.',
            "We don't sell or rent personal data, and we don't share it with advertisers or data brokers.",
            "We don't send marketing messages or direct mail. If we ever want to, we will first ask for your separate consent, and you will be able to withdraw it at any time.",
            "We don't use cookies (see the next section).",
          ],
        },
      ],
    },
    {
      id: 'device-storage',
      heading: 'Storage on your device and in your browser',
      blocks: [
        { type: 'paragraph', text: 'The app stores a few things on your device so that it works:' },
        {
          type: 'list',
          items: [
            "**Sign-in tokens** that keep you signed in. On phones, they are kept in the phone's secure storage and are not copied to other devices.",
            '**Settings:** your language and appearance (system, light or dark).',
            '**Images** the app has shown, kept in a cache so they load faster.',
          ],
        },
        {
          type: 'paragraph',
          text: "The web version keeps the same sign-in tokens and settings in your browser's local storage. During Google sign-in it briefly stores sign-in data there, and removes it when sign-in ends.",
        },
        {
          type: 'paragraph',
          text: "The app and our servers don't use cookies. Google's sign-in page may use its own cookies under Google's policies. Clearing your browser's site data removes what the web version stored and signs you out.",
        },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep information',
      blocks: [
        { type: 'paragraph', text: 'We keep personal data only as long as we need it for the purposes in this policy:' },
        {
          type: 'definitions',
          items: [
            { term: 'Account and profile', text: 'As long as your account exists. See “Deleting your account” for what happens when you delete it.' },
            {
              term: 'Requests, offers, jobs, messages and reviews',
              text: "As long as your account exists. They are also the other party's records, so part of them stays after you delete your account, without your personal details.",
            },
            {
              term: 'Photos',
              text: "A request's photos are deleted when you cancel the request or delete the draft. A profile photo is deleted when you replace or remove it. Other photos are kept as long as your account exists.",
            },
            {
              term: 'Sign-in sessions and push tokens',
              text: "A session ends when you sign out, or 90 days after it was last used. Its push token is deleted with it, when you turn off push notifications, or when the push service reports that it's no longer valid.",
            },
            { term: 'Email links', text: 'Email verification links expire after 48 hours, and password reset links after 1 hour.' },
            { term: 'In-app notifications', text: 'Deleted automatically after 90 days.' },
            { term: 'IP addresses', text: 'From minutes to hours in rate-limit counters, and up to 30 days in sign-in protection records.' },
            { term: 'Server logs', text: 'Kept for {{logRetentionDays}} days, then deleted.' },
            { term: 'Backups', text: 'Kept for {{backupRetentionDays}} days, then overwritten. Data you delete can remain in a backup until then.' },
          ],
        },
        {
          type: 'paragraph',
          text: "Our email and push providers may keep delivery records for a limited time under their own terms. Notifications and emails already delivered stay on the recipients' devices and in their mailboxes.",
        },
      ],
    },
    {
      id: 'account-deletion',
      heading: 'Deleting your account',
      blocks: [
        {
          type: 'paragraph',
          text: "You can delete your account at any time. **In the app:** open Settings (from the Profile tab) and choose **Delete account**. The app first shows what will happen to your open requests, offers and jobs, then asks you to confirm with your password (or with Google, if your account has no password). Your account is deleted immediately, and this can't be undone.",
        },
        {
          type: 'paragraph',
          text: "**Without the app:** email [{{contactEmail}}](mailto:{{contactEmail}}) from your account's email address and ask us to delete your account. The result is the same as deleting it in the app. The [account deletion page]({{deletionUrl}}) explains the steps. Deleting the app from your phone doesn't delete your account.",
        },
        { type: 'paragraph', text: '**What happens to open items:**' },
        {
          type: 'list',
          items: [
            'Customers: your drafts are deleted, your other open requests are cancelled, and all pending offers on them are declined.',
            'Professionals: all your pending offers are withdrawn.',
            'Both roles: your active jobs are cancelled, including jobs already in progress.',
            'The other people involved are notified.',
          ],
        },
        { type: 'paragraph', text: '**What we delete:**' },
        {
          type: 'list',
          items: [
            'Your name, email address, phone number, password, Google link, profile photo and default address.',
            'Your professional profile details: display name, headline, bio, contact details, business details, base address, exact service-area point, starting price and service categories. Your profile and its reviews are no longer shown.',
            "All photos of your requests, and your requests' street address, apartment, floor and entrance details, access notes, exact map point and cancellation comments.",
            'The messages attached to your offers, and the comments in your reviews.',
            'Your notifications, sign-in sessions, push tokens and email links. You are signed out on all devices.',
          ],
        },
        {
          type: 'paragraph',
          text: '**What stays, without your personal details:** the people you worked with keep a record of what you did together, where you are shown as “Deleted user”.',
        },
        {
          type: 'list',
          items: [
            "Jobs (service category, status, dates and agreed price) stay in the other party's history.",
            'Your requests keep their description, category, dates, city, neighbourhood and approximate point. Your offers keep their price and dates.',
            "Your review ratings stay, without the comment, so professionals' ratings don't change. Reviews that customers wrote about you stay in those customers' own job history.",
            'Messages you sent stay visible to the other person in the chat. All your chats are closed, so no new messages can be sent.',
            'A minimal account record without your name or contact details (an internal number, your role, your language, and the dates the account was created and deleted), so these records keep working. For professionals, it also keeps profile settings that are not contact details (such as years of experience, weekly availability, and the approximate area and radius you served) and your rating statistics.',
          ],
        },
        {
          type: 'paragraph',
          text: '**Copies that expire later:** notifications already sent to other users can include your name or a message preview until they are deleted after 90 days. Sign-in protection records (which contain a hash of your email address) expire within 30 days, and other short-lived security and cache entries within hours. Server logs are kept for {{logRetentionDays}} days and backups for {{backupRetentionDays}} days; after that, they are deleted or overwritten.',
        },
        {
          type: 'paragraph',
          text: 'We send a confirmation to your email address when your account is deleted. You can sign up again later with the same email address or Google account; the new account starts empty.',
        },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights',
      blocks: [
        { type: 'paragraph', text: 'Under the Privacy Protection Law, 5741-1981, you have these rights:' },
        {
          type: 'definitions',
          items: [
            { term: 'Access (section 13)', text: 'You can ask to inspect the personal data we hold about you.' },
            {
              term: 'Correction and deletion (section 14)',
              text: 'If data about you is incorrect, incomplete, unclear or out of date, you can ask us to correct or delete it.',
            },
            {
              term: 'Direct mail (section 17F)',
              text: "We don't use your data for direct mail. If we ever did, you could demand at any time that your data be deleted from the database used for direct mail.",
            },
            { term: 'Withdrawing consent', text: 'You can turn off notifications and location access at any time, and you can delete your account.' },
          ],
        },
        { type: 'paragraph', text: '**How to use your rights.** You can do much of this yourself in the app:' },
        {
          type: 'list',
          items: [
            'edit your profile: name, phone, addresses, professional details and photo;',
            'change your notification settings in Settings → Notifications;',
            'reset your password with “Forgot password?” on the sign-in screen;',
            'delete your account in Settings.',
          ],
        },
        {
          type: 'paragraph',
          text: "For anything else, such as inspecting your data or changing the email address you sign in with, email [{{contactEmail}}](mailto:{{contactEmail}}) from your account's email address. We may ask you to confirm your identity. We answer within 30 days.",
        },
        {
          type: 'paragraph',
          text: "If you think we have not handled your personal data properly, you can complain to the Privacy Protection Authority at the Ministry of Justice: [Privacy Protection Authority on gov.il](https://www.gov.il/he/departments/the_privacy_protection_authority/govil-landing-page). We'd appreciate the chance to fix the problem first, so please contact us too.",
        },
      ],
    },
    {
      id: 'security',
      heading: 'How we protect your information',
      blocks: [
        {
          type: 'paragraph',
          text: 'We take reasonable measures to protect personal data, in line with the Privacy Protection (Data Security) Regulations, 5777-2017. They include:',
        },
        {
          type: 'list',
          items: [
            'Encrypted connections (HTTPS) between the app and our servers.',
            'Passwords stored only as argon2id hashes, sign-in tokens stored on our side only as hashes, and access tokens that expire after 30 minutes.',
            'Access checks on every request, so each user gets only what they are allowed to see (for example, only the two people of a job can see its chat).',
            'Limits on repeated requests and on failed sign-in attempts.',
            'Checking new passwords against known leaked passwords, without sending the password.',
            "Approximate locations calculated with a secret key, and sign-in tokens kept in the phone's secure storage.",
          ],
        },
        {
          type: 'paragraph',
          text: "No system is completely secure, and we can't guarantee that your data will never be accessed without permission. If a security incident affects your data, we will handle it and report it as the law requires.",
        },
        {
          type: 'paragraph',
          text: "You can help: use a strong password that you don't use anywhere else, keep it to yourself, and sign out on shared devices.",
        },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        {
          type: 'paragraph',
          text: "Professionals is not for anyone under 18, and we don't knowingly collect personal data of minors. If we learn that an account belongs to someone under 18, we will delete it. If you believe a minor is using the app, please tell us at [{{contactEmail}}](mailto:{{contactEmail}}).",
        },
      ],
    },
    {
      id: 'google-user-data',
      heading: 'Google user data',
      blocks: [
        {
          type: 'paragraph',
          text: 'If you use “Continue with Google”, the app asks Google only for basic sign-in permissions: your name, email address and profile photo. From Google we receive your name, your verified email address, your Google account ID and a link to your profile photo.',
        },
        {
          type: 'list',
          items: [
            'We use this data only to create your account, to sign you in and, until you change it, to use your Google profile photo as your profile photo.',
            "We don't sell it or use it for advertising, and we share it only as this policy describes (for example, your profile photo and name are shown to other users as described in “What other users can see”).",
            "We never receive your Google password, and we don't store Google access tokens. We don't access your Gmail, contacts, files or any other Google data.",
            'Our use of information received from Google follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its Limited Use requirements.',
          ],
        },
        {
          type: 'paragraph',
          text: "You can remove the app's access in your [Google Account settings](https://myaccount.google.com/permissions). This doesn't delete your Professionals account; to delete it, see “Deleting your account”.",
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        { type: 'paragraph', text: 'We may update this policy, for example when we add features or when the law changes.' },
        {
          type: 'paragraph',
          text: 'If we make a significant change, we will tell you in the app or by email before it takes effect. If a change needs your consent, for example a new use of your data, we will ask for it.',
        },
        { type: 'paragraph', text: 'This version takes effect on {{effectiveDate}}.' },
      ],
    },
    {
      id: 'language-versions',
      heading: 'Hebrew and English versions',
      blocks: [
        {
          type: 'paragraph',
          text: 'This policy is published in Hebrew and in English. If the two versions differ, the Hebrew version prevails. The Hebrew version uses the masculine form for convenience only; it refers to people of all genders.',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [
        { type: 'paragraph', text: 'For questions, requests or complaints about privacy, contact us:' },
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
