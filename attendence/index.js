const { GoogleSpreadsheet } = require('google-spreadsheet');

const express = require('express');
const favicon = require('serve-favicon');
const metadata = require('gcp-metadata');
const {OAuth2Client} = require('google-auth-library');

const path = require('path');

const creds = require('./client_secret.json');

const app = express();

const oAuth2Client = new OAuth2Client();

const doc = new GoogleSpreadsheet('1U1okJ7k7WGGFj9hPXuvuGgFIRgflxtFBb5uHKcy661A');

var result = 'testing';

app.use(express.static(path.join(__dirname, "public")));

async function accessSpreadsheet(club, email){
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo(); // loads document properties and worksheets

  const sheet = doc.sheetsByIndex[2]; // or use doc.sheetsById[id]
  const log = doc.sheetsByIndex[3];
  
  const rows = await sheet.getRows(); // can pass in { limit, offset }
  const logRows = await log.getRows();
  console.log(email);

  var time = new Date().getTime();
  for (var i = 0; i<rows.length;i++) {
    if (club != '' && club == rows[i].Club) {
      var start = new Date(rows[i].Start).getTime();
      var end = new Date(rows[i].End).getTime();
      if (time>start-900000 && time<end+900000) {
        var pastLogs = [];
        for (var n = 0; n<logRows.length; n++) {
          if (logRows[n].User == email) {
            pastLogs.push(logRows[n].EventID);
          }
        }
        for (var m = 0; m<pastLogs.length; m++) {
          if (pastLogs[m] == rows[i].ID) {
            console.log('already logged')
            return "Error: event already logged"
          }
        }
        var ID2 = String(time)+email;
        const addRows = await log.addRows([
          { SubmissionID: ID2, Timestamp: new Date(), EventID: rows[i].ID, User: email, Club: club, Meeting: rows[i].Meeting, Hours: rows[i].Hours}
        ]);
        result = "Service Logged for "+club;
        return result;
      }
    }
  }
  result = "No event found for "+club;
  return result;
}

let aud;

async function audience() {
  if (!aud && (await metadata.isAvailable())) {
    let project_number = await metadata.project('numeric-project-id');
    let project_id = await metadata.project('project-id');

    aud = '/projects/' + project_number + '/apps/' + project_id;
  }

  return aud;
}

async function validateAssertion(assertion) {
  if (!assertion) {
    return {};
  }

  // Check that the assertion's audience matches ours
  const aud = await audience();

  // Fetch the current certificates and verify the signature on the assertion
  const response = await oAuth2Client.getIapPublicKeys();
  const ticket = await oAuth2Client.verifySignedJwtWithCertsAsync(
    assertion,
    response.pubkeys,
    aud,
    ['https://cloud.google.com/iap']
  );
  const payload = ticket.getPayload();

  // Return the two relevant pieces of information
  return {
    email: payload.email,
    sub: payload.sub,
  };
}
app.set('views', path.join(__dirname, 'views'));

console.log(encodeURIComponent("She's the First"));
app.set('view engine', 'pug');

app.get('/:clubname', async (req, res) => {
  const assertion = req.header('X-Goog-IAP-JWT-Assertion');
  let email = 'None';
  try {
    const info = await validateAssertion(assertion);
    email = info.email;
    var club = decodeURIComponent(req.params.clubname);
    var resultmessage = await accessSpreadsheet(club, email);
      console.log(resultmessage);
    res.render('template',{
      message1:resultmessage
    });
  } catch (error) {
    console.log(error);
    res.render('template',{
      message1:"Error"
    });
  }
});

app.get('/', async (req, res) => {
  res.render('template',{
    message1:"Please enter a valid url!"
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit. TEST');
});