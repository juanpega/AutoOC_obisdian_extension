const fs = require("node:fs");
const args = process.argv.slice(2);
const prompt = args[args.indexOf("--prompt") + 1];
if (args.includes("--version")) {
  console.log("GitHub Copilot CLI fixture 1.0");
} else if (prompt === "FAIL") {
  console.error("Authentication required: run copilot login");
  process.exitCode = 1;
} else if (prompt === "WAIT") {
  console.log("Started");
  setTimeout(() => console.log("Too late"), 10000);
} else if (prompt === "UNICODE") {
  const bytes = Buffer.from("Español 🤖");
  process.stdout.write(bytes.subarray(0, 5));
  setTimeout(() => process.stdout.write(bytes.subarray(5, 11)), 10);
  setTimeout(() => process.stdout.write(bytes.subarray(11)), 20);
} else if (args.includes("--add-dir")) {
  const file = require("node:path").join(args[args.indexOf("--add-dir") + 1], "task.txt");
  console.log(JSON.stringify({ file, prompt: fs.readFileSync(file, "utf8") }));
} else {
  console.log(JSON.stringify({ prompt, args, cwd: process.cwd(), secret: process.env.AUTOOC_TEST_VALUE }));
}
