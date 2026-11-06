import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";

const out = "public/xiaomo-pan-helper.zip";
if (!existsSync("public")) mkdirSync("public");
if (existsSync(out)) rmSync(out);

execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path extension -DestinationPath ${out} -Force`], { stdio: "inherit" });

const kb = (statSync(out).size / 1024).toFixed(1);
console.log(`打包完成: ${out} (${kb} KB)`);
console.log("用户解压后得到 extension/ 文件夹，在扩展管理页「加载解压缩的扩展」选它。");
