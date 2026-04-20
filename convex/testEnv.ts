import { query } from "./_generated/server";

export const checkEnv = query({
  handler: async () => {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    // Try to parse the service account JSON
    let serviceAccountValid = false;
    let serviceAccountEmail = "";
    
    try {
      if (serviceAccountKey) {
        const parsed = JSON.parse(serviceAccountKey);
        serviceAccountValid = true;
        serviceAccountEmail = parsed.client_email || "";
      }
    } catch (e) {
      serviceAccountValid = false;
    }
    
    return {
      // Check if each variable exists
      hasServiceAccount: !!serviceAccountKey,
      serviceAccountValid,
      serviceAccountEmail,
      
      hasAttendanceLog: !!process.env.ATTENDANCE_LOG_SHEET_ID,
      hasDTCLogbook: !!process.env.DTC_LOGBOOK_SHEET_ID,
      hasIntern: !!process.env.INTERN_SHEET_ID,
      hasSyncStatus: !!process.env.SYNC_STATUS_SHEET_ID,
      hasDictProgram: !!process.env.DICT_PROGRAM_SHEET_ID,
      hasDictResult: !!process.env.DICT_RESULT_SHEET_ID,
      
      // Show first 100 chars of service account (for debugging)
      serviceAccountPreview: serviceAccountKey?.slice(0, 100) + "...",
      
      // Show actual Sheet IDs
      sheetIds: {
        attendanceLog: process.env.ATTENDANCE_LOG_SHEET_ID,
        dtcLogbook: process.env.DTC_LOGBOOK_SHEET_ID,
        intern: process.env.INTERN_SHEET_ID,
        syncStatus: process.env.SYNC_STATUS_SHEET_ID,
        dictProgram: process.env.DICT_PROGRAM_SHEET_ID,
        dictResult: process.env.DICT_RESULT_SHEET_ID,
      },
      
      // Overall status
      allConfigured: 
        !!serviceAccountKey &&
        serviceAccountValid &&
        !!process.env.ATTENDANCE_LOG_SHEET_ID &&
        !!process.env.DTC_LOGBOOK_SHEET_ID &&
        !!process.env.INTERN_SHEET_ID &&
        !!process.env.SYNC_STATUS_SHEET_ID,
    };
  },
});