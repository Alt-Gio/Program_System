/**
 * ILCDB LearnHub — Google Forms Auto-Certificate Webhook
 * ========================================================
 * Installation:
 *   1. Open your Google Form in Google Forms editor.
 *   2. Click the ⋮ menu → "Script editor".
 *   3. Paste this entire file, replacing any existing content.
 *   4. Fill in the CONFIG values below.
 *   5. Save, then click "Triggers" (clock icon) → Add Trigger:
 *        Function: onFormSubmit
 *        Event source: From form → On form submit
 *   6. Authorize the script when prompted.
 *
 * Field mapping:
 *   The script reads responses by column index (0-based).
 *   Update FIELD_INDICES to match your form's question order.
 *   Example: if your form is:
 *     Q1: Full Name
 *     Q2: Email Address
 *     Q3: What program did you complete?
 *   then NAME=0, EMAIL=1, PROGRAM=2
 */

// ─── CONFIG ──────────────────────────────────────────────────
const CONFIG = {
  WEBHOOK_URL: "https://[your-domain]/api/learnhub/forms-webhook",
  SECRET: "PASTE_YOUR_LH_FORMS_WEBHOOK_SECRET_HERE",

  // Fixed values for all submissions through this form
  COURSE_TITLE: "SPARK Digital Literacy Program",   // or read from form
  PROGRAM_TYPE: "SPARK",                            // SPARK | DWIA | Tech4ED | etc.
  CERT_TYPE: "learning",                            // "learning" | "work_completion"
  MENTOR_EMAIL: "mentor@dictregion5.gov.ph",        // Leave empty "" to auto-resolve

  // 0-based column indices of each answer in the form response
  FIELD_INDICES: {
    NAME: 0,    // Column index of the student's full name answer
    EMAIL: 1,   // Column index of the student's email answer
  },

  // Only issue cert if the respondent passed a score threshold (optional)
  SCORE_FIELD_INDEX: -1,   // Set to -1 to disable score check
  PASSING_SCORE: 80,        // Ignored if SCORE_FIELD_INDEX is -1
};
// ─────────────────────────────────────────────────────────────

/**
 * onFormSubmit — main trigger function.
 * Receives a Google Form submit event and calls the LearnHub webhook.
 */
function onFormSubmit(e) {
  try {
    var responses = e.response.getItemResponses();

    // Helper to safely get a response by index
    function getField(index) {
      if (index < 0 || index >= responses.length) return "";
      var r = responses[index].getResponse();
      return Array.isArray(r) ? r.join(", ") : String(r || "").trim();
    }

    var studentName = getField(CONFIG.FIELD_INDICES.NAME);
    var studentEmail = getField(CONFIG.FIELD_INDICES.EMAIL);

    if (!studentName || !studentEmail) {
      Logger.log("[LearnHub] Missing name or email — skipping certificate.");
      return;
    }

    // Score gate (optional)
    if (CONFIG.SCORE_FIELD_INDEX >= 0) {
      var score = parseFloat(getField(CONFIG.SCORE_FIELD_INDEX));
      if (isNaN(score) || score < CONFIG.PASSING_SCORE) {
        Logger.log("[LearnHub] Score " + score + " below threshold — skipping.");
        return;
      }
    }

    var payload = {
      secret: CONFIG.SECRET,
      email: studentEmail,
      name: studentName,
      courseTitle: CONFIG.COURSE_TITLE,
      programType: CONFIG.PROGRAM_TYPE,
      certType: CONFIG.CERT_TYPE,
      mentorEmail: CONFIG.MENTOR_EMAIL || undefined,
      autoIssueCert: true,
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    var body = response.getContentText();

    Logger.log("[LearnHub] Webhook response " + code + ": " + body);

    if (code !== 200) {
      // Optionally send yourself an email alert
      // MailApp.sendEmail("your@email.com", "LearnHub Webhook Error", body);
    }
  } catch (err) {
    Logger.log("[LearnHub] Error: " + err.toString());
  }
}

/**
 * testWebhook — run this manually once to verify connectivity.
 * In Apps Script editor: select testWebhook → Run.
 */
function testWebhook() {
  var payload = {
    secret: CONFIG.SECRET,
    email: "test@dictregion5.gov.ph",
    name: "Test Student",
    courseTitle: CONFIG.COURSE_TITLE,
    programType: CONFIG.PROGRAM_TYPE,
    certType: CONFIG.CERT_TYPE,
    autoIssueCert: false, // Don't generate a real cert in test mode
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
  Logger.log("Status: " + response.getResponseCode());
  Logger.log("Body: " + response.getContentText());
}
