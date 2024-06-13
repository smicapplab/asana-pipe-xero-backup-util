require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { format } = require("date-fns");

const ASANA_ACCESS_TOKEN = process.env.ASANA_ACCESS_TOKEN;
const userMapping = JSON.parse( process.env.ASANA_USER_MAPPING )

const asanaApi = axios.create({
  baseURL: "https://app.asana.com/api/1.0/",
  headers: {
    Authorization: `Bearer ${ASANA_ACCESS_TOKEN}`,
  },
});

async function getTasks(projectId) {
  const response = await asanaApi.get(`/projects/${projectId}/tasks`);
  return response.data.data;
}

async function getTaskDetails(taskId) {
  const response = await asanaApi.get(`/tasks/${taskId}`);
  return response.data.data;
}

async function getTaskStories(taskId) {
  const response = await asanaApi.get(`/tasks/${taskId}/stories`);
  return response.data.data;
}

async function getProjectSections(projectId) {
  const response = await asanaApi.get(`/projects/${projectId}/sections`);
  return response.data.data;
}

function replaceUrlsWithNames(comment) {
  const regex = /https:\/\/app\.asana\.com\/0\/profile\/(\d+)/g;
  return comment.replace(regex, (match, userId) => {
    return userMapping[userId] ? userMapping[userId] : match;
  });
}

async function downloadAttachment({ taskId, attachmentDir }) {
  const attachmentsResponse = await axios({
    url: `https://app.asana.com/api/1.0/attachments?parent=${taskId}`,
    method: "GET",
    headers: { Authorization: `Bearer ${ASANA_ACCESS_TOKEN}` },
  });

  const attachments = attachmentsResponse.data.data;

  let counter = 1;
  for (const attachment of attachments) {
    const attachmentResponse = await axios({
      url: `https://app.asana.com/api/1.0/attachments/${attachment.gid}`,
      method: "GET",
      headers: { Authorization: `Bearer ${ASANA_ACCESS_TOKEN}` },
    });

    const fileUrl = attachmentResponse.data.data.download_url;
    const fileName = `${counter++}-${attachmentResponse.data.data.name}`;
    await downloadFile(fileUrl, attachmentDir, fileName);
  }
}

async function downloadFile(url, attachmentDir, fileName) {
  // Validate arguments
  if (!url || !attachmentDir || !fileName) {
    return;
  }

  const filePath = path.join(attachmentDir, fileName);

  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);

    // Pipe the response data to the file
    response.data.pipe(writer);

    // Return a promise that resolves when the file is fully written
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Error downloading the file: ${error}`);
  }
}

async function fetchAsanaData({ projectId, downloadDir }) {
  try {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    const tasks = await getTasks(projectId);
    const sections = await getProjectSections(projectId);
    let rowCount = 0;
    const totalTask = tasks.length;
    for (const task of tasks) {
      try {
        rowCount++;
        
        const taskDetails = await getTaskDetails(task.gid);
        const taskStories = await getTaskStories(task.gid);

        const taskSection = sections.find(
          (section) => section.gid === taskDetails.memberships[0].section.gid
        );

        const taskData = {
          taskName: taskDetails.name,
          comments: [],
          attachments: [],
          details: taskDetails,
        };

        // Write task details and custom fields to taskDetails.txt
        const sanitizedTaskName = taskDetails.name.replace(/[\/\\]/g, "_").slice(0, 200);
        let sectionName = "No Section";
        if (taskSection) {
          sectionName = taskSection.name ? taskSection.name.replace(/[\/\\]/g, "_").slice(0, 200) : "No Section";
        }

        const TASK_SECTION_DIR = `${downloadDir}/${sectionName}`;

        if (!fs.existsSync(TASK_SECTION_DIR)) {
          fs.mkdirSync(TASK_SECTION_DIR);
        }

        const TASK_DIR = `${TASK_SECTION_DIR}/${sanitizedTaskName}`;

        if (!fs.existsSync(TASK_DIR)) {
          fs.mkdirSync(TASK_DIR);
        }

        process.stdout.write(`\rRow ${rowCount} of ${totalTask} : ${TASK_DIR}`);

        const taskDetailsFilePath = path.join(TASK_DIR, `taskDetails.txt`);
        const taskDetailsContent = `
  Task Name: ${taskDetails.name}
  Assignee: ${taskDetails.assignee ? taskDetails.assignee.name : "Unassigned"}
  Due Date: ${taskDetails.due_on || "No due date"}
  
  ${taskDetails.custom_fields
    .map((field) => `${field.name}: ${field.display_value || "-"}`)
    .join("\n")}`;

        fs.writeFileSync(taskDetailsFilePath, taskDetailsContent);

        taskData.detailsFilePath = taskDetailsFilePath;

        for (const story of taskStories) {
          if (story.type === "comment") {
            const commentText = replaceUrlsWithNames(`
  ${story.created_by.name} (${format(
              new Date(story.created_at),
              "MMM dd, yyyy"
            )}) 
  
  ${story.text}
          `);
            taskData.comments.push(commentText);
          }
        }

        const taskCommentsFilePath = path.join(TASK_DIR, `comments.txt`);
        fs.writeFileSync(
          taskCommentsFilePath,
          `${taskData.comments.join(
            "\n\n-----------------------------------------\n\n"
          )}`
        );

        const attachmentDir = `${TASK_DIR}/attachments`;
        if (!fs.existsSync(attachmentDir)) {
          fs.mkdirSync(attachmentDir);
        }
        await downloadAttachment({
          taskId: task.gid,
          attachmentDir,
        });
      } catch (err) {
        console.error("Task Line", err);
      }
    }

    console.log("Comments and attachments have been downloaded.");
  } catch (error) {
    console.error(error);
  }
}

module.exports = { fetchAsanaData };
