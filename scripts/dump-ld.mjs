const res = await fetch("http://127.0.0.1:3100/r/excel-dashboard-pack");
const html = await res.text();
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log("blocks:", blocks.length);
for (const b of blocks) console.log("\n---\n" + b.slice(0, 400));
