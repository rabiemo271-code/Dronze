// DRONZE contact form receiver (Google Apps Script)
// 1. Create a Google Sheet and rename the first tab to: Leads
// 2. Extensions > Apps Script, delete the sample code, paste this file
// 3. Set NOTIFY_EMAIL below, then Deploy > New deployment > Web app
//    Execute as: Me | Who has access: Anyone
// 4. Copy the web app URL into FORM_ENDPOINT in script.js

const NOTIFY_EMAIL = 'hello@dronze.com';   // where you want new leads emailed

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Date', 'Name', 'Email', 'Company', 'Services', 'Budget', 'Message']);
  }
  sheet.appendRow([new Date(), d.name, d.email, d.company, d.services, d.budget, d.msg]);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: d.email,
    subject: 'New DRONZE lead: ' + d.name,
    body: 'Name: ' + d.name + '\nEmail: ' + d.email + '\nCompany: ' + d.company +
          '\nServices: ' + d.services + '\nBudget: ' + d.budget + '\n\n' + d.msg
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
