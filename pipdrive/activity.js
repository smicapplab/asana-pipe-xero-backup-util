const axios = require("axios");
const fs = require("fs");
const { escapeForCsv, userMapping } = require("./commons");

const apiKey = process.env.PIPE_DRIVE_TOKEN;
const baseUrl = process.env.PIPE_DRIVE_URL;

const headers = [
  "Subject",
  "Status",
  "Deal",
  "Pipeline",
  "Organization",
  "Contact Person",
  "Email",
  "Phone",
  "Due Date",
  "Activity Assigned",
  "Activity Date",
  "Stage",
  "Note",
  "Type",
  "Marked as Done Time",
  "Owner",
];

let dealMap = {}
let stageMap = {}

const fileName = "/Users/steve/Desktop/activity-3.csv";

const writeActivityBackup = async (activityIds) => {

    for( const activityId of activityIds ){
        const activity = await axios.get(`${baseUrl}activities/${activityId}?api_token=${apiKey}`);
        const activityDetails = activity.data.data
        const { subject, done, deal_id, org_id, due_date, user_id, add_time, stage_id, note, type, marked_as_done_time, owner_name } = activityDetails

        let dealTitle = ""
        let pipelineName = ""
        let companyName = ""

        let personName = ""
        let personPhone = ""
        let personEmail = ""

        let assignedTo = ""

        let stageName = ""
        
        let deal = {};
        if( deal_id ){
            if( dealMap[deal_id] ){
                deal = dealMap[deal_id]
            }else{
                const dealDetails = await axios.get(`${baseUrl}deals/${deal_id}?api_token=${apiKey}`);
                deal = dealDetails.data.data
                dealMap[deal_id] = deal;
            }

            const { title, pipeline_id, org_id = {}, person_id = {}, user_id = {} } = deal
            dealTitle = title || ""

            if( org_id && org_id.name ){
                companyName = org_id.name
            }

            if( person_id && person_id.email ){
                personEmail = person_id.email && person_id.email.length > 0 ? person_id.email.map( el => `${escapeForCsv(el.value)}` ).join(" and ").replace(/\n/g, '').replace(/\r/g, ''): ""
            }
            if( person_id && person_id.phone ){
                personPhone = person_id.phone && person_id.phone.length > 0 ? person_id.phone.map( el => `${escapeForCsv(el.value)}` ).join(" and ").replace(/\n/g, '').replace(/\r/g, '') : ""
            }
            if( person_id && person_id.name ){
                personName = person_id.name
            }
            if( user_id ){
                assignedTo = user_id.name || ""
            }
           
            if( pipeline_id ){
                const pipelineDetails = await axios.get(`${baseUrl}pipelines/${pipeline_id}?api_token=${apiKey}`);
                const pipeline = pipelineDetails.data.data
                pipelineName = pipeline.name || ""
            }
        }

        let stage = {}
        if( stage_id ){
            if( stageMap[stage_id] ){
                stage = stageMap[stage_id]
            }else{
                const stageDetails = await axios.get(`${baseUrl}stages/${stage_id}?api_token=${apiKey}`);
                stage = stageDetails.data.data
                stageMap[stage_id] = stage;
            }

            stageName = stage.name || ""
        }

        const csvRow = `${ subject }|${ done ? "Done" : "To do" }|${ dealTitle }|${pipelineName}|${companyName}|${personName}|${ personEmail }|${ personPhone }|${due_date}|${assignedTo}|${add_time}|${stageName}|${ note ? note.replace(/\n/g, '').replace(/\r/g, '') : "" }|${type || ""}|${ marked_as_done_time || "" }|${owner_name}`;
        await fs.promises.appendFile(fileName, `${csvRow}\n`);
    }
};

// Function to fetch all leads with pagination
async function getAllActivities(cursor = null) {
  if (!fs.existsSync(fileName)) {
    await fs.promises.writeFile(fileName, `${headers.join("|")}\n`);
  }

  try {
    const activityUrl = `${baseUrl}activities/collection?api_token=${apiKey}&limit=400${
      cursor ? `&cursor=${cursor}` : ""
    }`;
    const activities = await axios.get(activityUrl);

    if (activities.data.data && activities.data.data.length > 0) {
      await writeActivityBackup(activities.data.data.map( el => el.id ));
    }

    let nextCursor = null;
    if (
      activities.data.additional_data &&
      activities.data.additional_data.next_cursor
    ) {
      nextCursor = activities.data.additional_data.next_cursor;
      await getAllActivities(nextCursor);
    }
  } catch (error) {
    console.error("Error fetching leads:", error);
  }
}

module.exports = { getAllActivities };
