const axios = require("axios");
const fs = require("fs");

const apiKey = process.env.PIPE_DRIVE_TOKEN;
const baseUrl = process.env.PIPE_DRIVE_URL;

const headers = [
  "Title",
  "Company Name",
  "Company Address",
  "Company Ecosystem",
  "Company SubEcosystem",
  "Owner",
  "Created By",
  "Origin",
  "Expected Close Date",
  "Contact",
  "Position",
  "Email",
  "CC",
  "Phone",
];

const fileName = "/Users/steve/Desktop/leads.csv";

function escapeForCsv(value) {
  value = value.replace(/,/g, ' or ');
  value = value.replace(/\|/g, " ");
  return `${value}`;
}

// Function to handle lead data and write to backup (replace with your logic)
const writeLeadBackup = async (leadData) => {
  for (let lead of leadData) {
    const {
      title,
      owner_id,
      creator_id,
      person_id,
      origin,
      expected_close_date,
      organization_id,
    } = lead;

    let name = ""
    let phone = ""
    let email = ""
    let ccEmails = ""
    let position = ""

    let companyName = ""
    let companyAddress = ""
    let companyEcosystem = ""
    let companySubEcosystem = ""

    if( person_id ){
        const personUrl = `${baseUrl}persons/${person_id}?api_token=${apiKey}&cursor=eyJwZXJzb24iOjUyMDV9`;
        const person = await axios.get(personUrl);
        const personDetails = person.data.data
        if( personDetails ){
            name = personDetails.name || ""
            phone = personDetails.phone && personDetails.phone.length > 0 ? personDetails.phone.map( el => `${escapeForCsv(el.value)}` ).join(" and ") : ""
            email = personDetails.email && personDetails.email.length > 0 ? personDetails.email.map( el => `${escapeForCsv(el.value)}` ).join(" and ") : ""
            ccEmails = personDetails.primary_email || ""
            position = personDetails["0ceb90a14ab1b18964bebfbd2d75937326b99451"] || ""
        }    
    }

    if( organization_id ){
        const organizationUrl = `${baseUrl}organizations/${organization_id}?api_token=${apiKey}&cursor=eyJwZXJzb24iOjUyMDV9`;
        const organization = await axios.get(organizationUrl);
        const organizationDetails = organization.data.data
        if( organizationDetails ){
            companyName = organizationDetails.name || title
            companyAddress = organizationDetails.address || ""
            companyEcosystem = organizationDetails["a6918dffd1ee05954492d3de4babb22797fe8997"] || ""
            companySubEcosystem = organizationDetails["660419bc150aa52ecb876a724660a5af389dae43"] || ""
        }
    }

    const csvRow = `${ title }|${companyName}|${companyAddress}|${companyEcosystem}|${companySubEcosystem}|${ userMapping[owner_id] }|${ userMapping[creator_id] }|${origin}|${expected_close_date}|${ name }|${ position }|${ email }|${ ccEmails }|${ phone }`;
    await fs.promises.appendFile(fileName, `${csvRow}\n`);
  }
};

// Function to fetch all leads with pagination
async function getAllLeads(start = 0) {
  if (!fs.existsSync(fileName)) {
    await fs.promises.writeFile(fileName, `${headers.join("|")}\n`);
  }

  try {
    const url = `${baseUrl}leads?start=${start}&api_token=${apiKey}`;
    const response = await axios.get(url);
    if (response.data.data && response.data.data.length > 0) {
      await writeLeadBackup(response.data.data);
    }
    if (response.data.additional_data) {
      await getAllLeads(response.data.additional_data.pagination.next_start);
    }

  } catch (error) {
    console.error("Error fetching leads:", error);
  }
}

module.exports = { getAllLeads }