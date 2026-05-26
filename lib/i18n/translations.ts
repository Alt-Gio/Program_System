// Lightweight client-side i18n dictionary.
//
// Why not next-intl / i18next: this project doesn't need server-side
// localized routing or pluralization rules across 30 locales. We just need
// two languages (en, tl) the user can flip on demand. Hand-rolled keeps
// bundle size minimal and avoids a fourth context provider.
//
// Pattern: leaves are bare strings. Missing keys fall through to the
// English value via Proxy in LocaleProvider, so partial translations are
// safe — the UI never shows a raw "settings.notifications.title" key.

export type Locale = "en" | "tl";

export const LOCALES: Array<{ code: Locale; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "tl", label: "Tagalog", native: "Tagalog" },
];

export const DEFAULT_LOCALE: Locale = "en";

// Strings here are intentionally flat (dot-pathed). A nested object tree
// is prettier in source but harder to lint for missing translations.
export const STRINGS = {
  en: {
    // Navigation rail
    "nav.today": "Today",
    "nav.home": "Home",
    "nav.watch": "Watch",
    "nav.learning": "My Learning",
    "nav.paths": "Browse Paths",
    "nav.videoFlow": "Video Flow",
    "nav.calendar": "Calendar",
    "nav.flowState": "Flow State",
    "nav.opportunities": "Opportunities",
    "nav.mentors": "Mentors",
    "nav.squads": "Squads",
    "nav.leaderboard": "Leaderboard",
    "nav.progress": "Progress · Restricted",
    "nav.org": "Org Console",
    "nav.curate": "Watch Curation",
    "nav.createPost": "Create post",
    "nav.settings": "Settings",
    "nav.profile": "Profile",

    // Common buttons
    "btn.save": "Save",
    "btn.cancel": "Cancel",
    "btn.send": "Send",
    "btn.submit": "Submit",
    "btn.enroll": "Enroll",
    "btn.enrolling": "Enrolling…",
    "btn.continue": "Continue",
    "btn.continuePath": "Continue path →",
    "btn.publish": "Publish",
    "btn.archive": "Archive",
    "btn.editPath": "Edit path",
    "btn.cloneCustomize": "Clone & customize",
    "btn.askTutor": "Ask tutor 🤖",
    "btn.closeTutor": "Close tutor",
    "btn.tryAgain": "Try again",
    "btn.install": "Install app",
    "btn.installed": "Installed",
    "btn.gotIt": "Got it",

    // Today page
    "today.greetingMorning": "Good morning",
    "today.greetingAfternoon": "Good afternoon",
    "today.greetingEvening": "Good evening",
    "today.streakLabel": "Current streak",
    "today.streakDays": "days",
    "today.streakDay": "day",
    "today.questsHeading": "Today's quests",
    "today.questsEmpty": "No quests yet — finish onboarding to get personalised ones.",
    "today.continueLearning": "Continue learning",
    "today.dailyXp": "XP today",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Manage your LearnHub preferences",
    "settings.prefs.title": "Your Preferences",
    "settings.push.title": "Push Notifications",
    "settings.email.title": "Email Digest",
    "settings.quiet.title": "Quiet Hours",
    "settings.feedLayout.title": "Feed Layout",
    "settings.integrations.title": "Integrations",
    "settings.language.title": "Language / Wika",
    "settings.language.sub": "Switch the LearnHub interface between English and Tagalog. Updates apply instantly.",
    "settings.install.title": "Install LearnHub",
    "settings.install.sub": "Install LearnHub as a standalone app on your phone or desktop so it works offline and opens without browser chrome.",
    "settings.danger.title": "Delete Account",

    // Generic
    "generic.loading": "Loading…",
    "generic.error": "Something went wrong.",
    "generic.offline": "You're offline.",
    "generic.online": "Back online.",
    "generic.saved": "Saved ✓",
    "generic.saving": "Saving…",
  },
  tl: {
    // Nav
    "nav.today": "Ngayon",
    "nav.home": "Tahanan",
    "nav.watch": "Panoorin",
    "nav.learning": "Aking Pag-aaral",
    "nav.paths": "Mga Path",
    "nav.videoFlow": "Video Flow",
    "nav.calendar": "Kalendaryo",
    "nav.flowState": "Flow State",
    "nav.opportunities": "Mga Oportunidad",
    "nav.mentors": "Mga Mentor",
    "nav.squads": "Mga Squad",
    "nav.leaderboard": "Leaderboard",
    "nav.progress": "Pag-unlad · Limitado",
    "nav.org": "Org Console",
    "nav.curate": "Pamimili ng Panoorin",
    "nav.createPost": "Gumawa ng post",
    "nav.settings": "Mga Setting",
    "nav.profile": "Profile",

    // Buttons
    "btn.save": "I-save",
    "btn.cancel": "Kanselahin",
    "btn.send": "Ipadala",
    "btn.submit": "Isumite",
    "btn.enroll": "Mag-enroll",
    "btn.enrolling": "Nag-eenroll…",
    "btn.continue": "Ituloy",
    "btn.continuePath": "Ituloy ang path →",
    "btn.publish": "I-publish",
    "btn.archive": "I-archive",
    "btn.editPath": "I-edit ang path",
    "btn.cloneCustomize": "Kopyahin at i-customize",
    "btn.askTutor": "Tanungin ang tutor 🤖",
    "btn.closeTutor": "Isara ang tutor",
    "btn.tryAgain": "Subukan muli",
    "btn.install": "I-install ang app",
    "btn.installed": "Naka-install",
    "btn.gotIt": "Sige",

    // Today
    "today.greetingMorning": "Magandang umaga",
    "today.greetingAfternoon": "Magandang hapon",
    "today.greetingEvening": "Magandang gabi",
    "today.streakLabel": "Kasalukuyang streak",
    "today.streakDays": "araw",
    "today.streakDay": "araw",
    "today.questsHeading": "Mga gawain ngayon",
    "today.questsEmpty": "Wala pang quest — tapusin ang onboarding para makakuha ng personalized.",
    "today.continueLearning": "Ituloy ang pag-aaral",
    "today.dailyXp": "XP ngayong araw",

    // Settings
    "settings.title": "Mga Setting",
    "settings.subtitle": "Pamahalaan ang iyong LearnHub preferences",
    "settings.prefs.title": "Iyong Preference",
    "settings.push.title": "Push Notifications",
    "settings.email.title": "Email Digest",
    "settings.quiet.title": "Quiet Hours",
    "settings.feedLayout.title": "Layout ng Feed",
    "settings.integrations.title": "Mga Integration",
    "settings.language.title": "Wika / Language",
    "settings.language.sub": "Palitan ang wika ng LearnHub sa pagitan ng Ingles at Tagalog. Agad na maa-apply.",
    "settings.install.title": "I-install ang LearnHub",
    "settings.install.sub": "I-install ang LearnHub bilang standalone na app sa iyong phone o desktop para gumana kahit offline.",
    "settings.danger.title": "Burahin ang Account",

    // Generic
    "generic.loading": "Kumukuha…",
    "generic.error": "May nangyaring mali.",
    "generic.offline": "Nawalan ka ng koneksyon.",
    "generic.online": "Bumalik na ang koneksyon.",
    "generic.saved": "Naka-save ✓",
    "generic.saving": "Sine-save…",
  },
} as const;

export type StringKey = keyof typeof STRINGS["en"];
