const { execSync } = require("child_process");

const distDir = "dist";

const pages = [
  "options",
  "sidebar",
]

const ignorePath = [
  "src/*",
  "package*",
  "LICENSE*",
  "tsconfig*",
  "images",
  "pnpm*",
  "eslint*"
]

try {
  console.log("compile ts");
  execSync("tsc", { stdio: "inherit" });
  console.log("copy pages to dist");
  pages.forEach(page =>
    execSync(`copyfiles -u 1 "src/${page}/*.{html,css}" ${distDir}`, { stdio: "inherit" })
  )

  console.log("build packege")
  execSync(`web-ext build ${ignorePath.map(path => `-i ${path}`).join(" ")}`)
  console.log("done!");
} catch (err) {
  console.error("failed to build", err.message);
  process.exit(1);
}
