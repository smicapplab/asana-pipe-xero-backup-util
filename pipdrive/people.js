const axios = require("axios");
const fs = require("fs");
const { escapeForCsv, userMapping } = require("./commons");

const apiKey = process.env.PIPE_DRIVE_TOKEN;
const baseUrl = process.env.PIPE_DRIVE_URL;

const headers = [
  "Name",
  "Active",
  "Date Created",
  "Owner",
  "Organization",
  "Address",
  "Ecosystem",
  "Sub Ecosystem",
  "Position",
  "Email",
  "CC",
  "Phone",
];

const fileName = "/Users/steve/Desktop/people.csv";

const writePeopleBackup = async (persons) => {
  for (let person of persons) {
    const { active_flag, owner_id, org_id, name, phone, email, cc_email, update_time } = person;

    let personPhone = ""
    let personEmail = ""
    let ccEmails = ""
    let position = ""

    let companyName = ""
    let companyAddress = ""
    let companyEcosystem = ""
    let companySubEcosystem = ""

    personPhone = phone && phone.length > 0 ? phone.map( el => `${escapeForCsv(el.value)}` ).join(" and ").replace(/\n/g, '').replace(/\r/g, '') : ""
    personEmail = email && email.length > 0 ? email.map( el => `${escapeForCsv(el.value)}` ).join(" and ").replace(/\n/g, '').replace(/\r/g, ''): ""
    ccEmails = cc_email.replace(/\n/g, '').replace(/\r/g, '') || ""
    position = person["0ceb90a14ab1b18964bebfbd2d75937326b99451"] ? person["0ceb90a14ab1b18964bebfbd2d75937326b99451"].replace(/\n/g, '').replace(/\r/g, '') : ""


    if( org_id ){
      const organizationUrl = `${baseUrl}organizations/${org_id}?api_token=${apiKey}`;
      const organization = await axios.get(organizationUrl);
      const organizationDetails = organization.data.data
      if( organizationDetails ){
          companyName = organizationDetails.name ? organizationDetails.name.replace(/\n/g, '').replace(/\r/g, '') : ""
          companyAddress = organizationDetails.address ? organizationDetails.address.replace(/\n/g, '').replace(/\r/g, '') : ""
          companyEcosystem = organizationDetails["a6918dffd1ee05954492d3de4babb22797fe8997"] ? organizationDetails["a6918dffd1ee05954492d3de4babb22797fe8997"].replace(/\n/g, '').replace(/\r/g, '') : ""
          companySubEcosystem = organizationDetails["660419bc150aa52ecb876a724660a5af389dae43"] ? organizationDetails["660419bc150aa52ecb876a724660a5af389dae43"].replace(/\n/g, '').replace(/\r/g, '') : ""
      }
    }

    const csvRow = `${ name }|${ active_flag }|${ update_time }|${userMapping[owner_id]}|${companyName}|${companyAddress}|${companyEcosystem}|${companySubEcosystem}|${ position }|${ personEmail }|${ ccEmails }|${ personPhone }`;
    await fs.promises.appendFile(fileName, `${csvRow}\n`);

  }
};

// Function to fetch all leads with pagination
async function getAllPersons(cursor = null) {
  if (!fs.existsSync(fileName)) {
    await fs.promises.writeFile(fileName, `${headers.join("|")}\n`);
  }

  try {
    const personUrl = `${baseUrl}persons/collection?api_token=${apiKey}&limit=400${cursor ? `&cursor=${cursor}` : "" }`;
    const persons = await axios.get(personUrl);

    if (persons.data.data && persons.data.data.length > 0) {
      await writePeopleBackup(persons.data.data);
    }

    let nextCursor = null;
    if (
      persons.data.additional_data &&
      persons.data.additional_data.next_cursor
    ) {
      nextCursor = persons.data.additional_data.next_cursor;
      await getAllPersons(nextCursor);
    }

  } catch (error) {
    console.error("Error fetching leads:", error);
  }
}

module.exports = { getAllPersons };
