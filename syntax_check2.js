const fs = require("fs");

try {
    const content = fs.readFileSync("js/views/dashboard_v25.js", "utf8");
    // Remove "export " if it's a module so we can just parse it as script
    // Actually, new Function() can't take import/export.
    // Let's just use acorn or vm if available.
    const vm = require("vm");
    const script = new vm.Script(content, { filename: "dashboard_v25.js" });
    console.log("Syntax is OK!");
} catch (e) {
    console.error(e);
}
