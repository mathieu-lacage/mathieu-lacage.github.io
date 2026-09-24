#!/usr/bin/env node
// Regenerates static/js/ns3-citations-data.js from the OpenAlex API.
// Run manually with: node scripts/update-ns3-citations.mjs
// Run monthly by .github/workflows/update-ns3-citations.yml

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const START_YEAR = 2006; // ns-3 project started in 2006
const API_URL =
  "https://api.openalex.org/works?search=%22ns-3%22%20network&group_by=publication_year";
const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "static",
  "js",
  "ns3-citations-data.js",
);

async function fetchCitationsByYear(currentYear) {
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "mathieu-lacage.github.io ns-3 citations updater" },
  });
  if (!res.ok) {
    throw new Error(`OpenAlex API request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.group_by
    .map((g) => ({ year: Number(g.key), count: g.count }))
    .filter((d) => Number.isInteger(d.year) && d.year >= START_YEAR && d.year <= currentYear)
    .sort((a, b) => a.year - b.year);
}

function renderDataFile(data, fetchedOn, currentYear) {
  const entries = data
    .map((d) => {
      const partial = d.year === currentYear ? ", partial: true" : "";
      return `    { year: ${d.year}, count: ${d.count}${partial} },`;
    })
    .join("\n");

  return `// Publications matching the search "ns-3" network on OpenAlex, grouped by
// publication year. Downloaded from the OpenAlex API on ${fetchedOn}:
//   ${API_URL}
// Source query (browsable): https://openalex.org/works?page=1&sort=relevance_score%3Adesc&search=%22ns-3%22%20network
//
// Years before ${START_YEAR} (when the ns-3 project started) are omitted since they
// are full-text search false positives. The current year is marked
// "partial" since it is still in progress.
//
// Regenerated monthly by .github/workflows/update-ns3-citations.yml
// (scripts/update-ns3-citations.mjs). Do not edit by hand.
window.NS3_CITATIONS = {
  fetchedOn: "${fetchedOn}",
  currentYear: ${currentYear},
  data: [
${entries}
  ],
};
`;
}

async function main() {
  const fetchedOn = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getUTCFullYear();
  const data = await fetchCitationsByYear(currentYear);
  if (data.length === 0) {
    throw new Error("OpenAlex returned no year buckets; refusing to write an empty data file");
  }
  const content = renderDataFile(data, fetchedOn, currentYear);
  await writeFile(OUTPUT_PATH, content, "utf8");
  console.log(`Wrote ${OUTPUT_PATH} (${data.length} years, fetched ${fetchedOn})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
