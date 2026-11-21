// stderr also carries Node/provider diagnostics; only JSON objects are events.
function cliEvent(line) { return line.trimStart().startsWith('{') ? JSON.parse(line) : undefined; }
function cliEvents(stderr) { return stderr.split(/\r?\n/).map(cliEvent).filter(Boolean); }
module.exports={cliEvent,cliEvents};
