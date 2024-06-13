const userMapping = JSON.parse( process.env.USER_MAPPING )

function escapeForCsv(value) {
    value = value.replace(/,/g, ' or ');
    value = value.replace(/\|/g, " ");
    return `${value}`;
  }

module.exports = { userMapping, escapeForCsv };
