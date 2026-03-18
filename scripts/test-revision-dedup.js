// Test: verify the parser correctly handles multiple revisions in the same conversation
// The content below simulates a chat with Revision 2.0 (forfait prices) followed by Revision 3.0 (hourly prices)
// Expected: ONLY Revision 3.0 items should be extracted

// -------- Simulated conversation with TWO revisions --------
const chatContent = `Some initial chat messages here...

SOUMISSION DÉTAILLÉE – RÉVISION 2.0
PH-1 – CUISINE & ENTRÉE
#### Division 01 – Générales
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
01 11 00\tGestion projet\tMO\tforfait\t1\t800,00 $\t800,00 $
01 50 00\tMobilisation\tMO\tforfait\t1\t300,00 $\t300,00 $
01 74 16\tGestion déchets\tST\tforfait\t1\t400,00 $\t400,00 $
01 76 00\tNettoyage final\tST\tforfait\t1\t250,00 $\t250,00 $
01 77 00\tProtection chantier\tMat.\tforfait\t1\t250,00 $\t250,00 $
Sous-total Div. 01\t\t\t\t\t\t2 000,00 $

#### Division 02 – Démolition
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
02 41 13\tDémolition armoires\tMO\tforfait\t1\t1 200,00 $\t1 200,00 $
02 41 13\tRetrait comptoir\tMO\tforfait\t1\t300,00 $\t300,00 $
02 41 13\tRetrait bois franc 40 pi²\tMO\tforfait\t1\t600,00 $\t600,00 $
02 41 19\tPréparation murs\tMO\tforfait\t1\t500,00 $\t500,00 $
02 41 19\tÉvacuation\tST\tforfait\t1\t400,00 $\t400,00 $
Sous-total Div. 02\t\t\t\t\t\t3 000,00 $

#### Division 06 – Armoires & Menuiserie
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
06 41 00\tArmoires bas\tMat.\tforfait\t1\t3 000,00 $\t3 000,00 $
06 41 00\tArmoires haut\tMat.\tforfait\t1\t2 500,00 $\t2 500,00 $
06 41 00\tÎlot simple\tMat.\tforfait\t1\t800,00 $\t800,00 $
06 43 00\tInstallation\tMO\tforfait\t1\t600,00 $\t600,00 $
06 05 23\tAjustements\tMO\tforfait\t1\t100,00 $\t100,00 $
Sous-total Div. 06\t\t\t\t\t\t7 000,00 $

Some chat messages between revisions...
User: peux-tu augmenter les taux horaires...
Agent: voici la révision 3.0...

SOUMISSION ULTRA-DÉTAILLÉE – RÉVISION 3.0
Entreprise : Gestion A.F. Construction
RBQ : À confirmer
PH-1 – CUISINE & ENTRÉE
#### Division 01 – Générales
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
01 11 00\tGestion projet\tST\tforfait\t1\t900,00 $\t900,00 $
01 50 00\tMobilisation\tMO\th\t5\t95,00 $\t475,00 $
01 74 16\tGestion déchets\tST\tforfait\t1\t450,00 $\t450,00 $
01 76 00\tNettoyage final\tST\tforfait\t1\t300,00 $\t300,00 $
01 77 00\tProtection chantier\tMat.\tforfait\t1\t300,00 $\t300,00 $
Sous-total Div. 01\t\t\t\t\t\t2 425,00 $

#### Division 02 – Démolition
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
02 41 13\tDémolition armoires\tMO\th\t16\t95,00 $\t1 520,00 $
02 41 13\tRetrait comptoir\tMO\th\t4\t95,00 $\t380,00 $
02 41 13\tRetrait bois franc 40 pi²\tMO\th\t8\t95,00 $\t760,00 $
02 41 19\tPréparation murs\tMO\th\t6\t95,00 $\t570,00 $
02 41 19\tÉvacuation\tST\tforfait\t1\t450,00 $\t450,00 $
Sous-total Div. 02\t\t\t\t\t\t3 680,00 $

#### Division 06 – Armoires & Menuiserie
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
06 41 00\tArmoires bas\tMat.\tforfait\t1\t3 200,00 $\t3 200,00 $
06 41 00\tArmoires haut\tMat.\tforfait\t1\t2 800,00 $\t2 800,00 $
06 41 00\tÎlot simple\tMat.\tforfait\t1\t900,00 $\t900,00 $
06 43 00\tInstallation armoires\tMO\th\t28\t95,00 $\t2 660,00 $
06 05 23\tAjustements\tMO\th\t4\t95,00 $\t380,00 $
Sous-total Div. 06\t\t\t\t\t\t9 940,00 $

#### Division 12 – Comptoir
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
12 36 00\tStratifié premium\tMat.\tforfait\t1\t1 400,00 $\t1 400,00 $
12 36 00\tDécoupes & ajustements\tMO\th\t6\t95,00 $\t570,00 $
12 36 00\tInstallation\tMO\th\t6\t95,00 $\t570,00 $
Sous-total Div. 12\t\t\t\t\t\t2 540,00 $

#### Division 26 – Électricité
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
26 27 26\tRelocalisation 3 prises\tMO\th\t6\t110,00 $\t660,00 $
26 27 26\tGFCI\tMat.\tunité\t1\t150,00 $\t150,00 $
26 05 19\tFilage & boîtes\tMat.\tforfait\t1\t200,00 $\t200,00 $
26 05 00\tPermis CMEQ\tST\tforfait\t1\t300,00 $\t300,00 $
Sous-total Div. 26\t\t\t\t\t\t1 310,00 $

#### Division 09 – Finitions & Céramique
Code\tDescription\tType\tUnité\tQté\tPrix un.\tTotal
09 30 13\tCéramique 40 pi²\tMat.\tforfait\t1\t500,00 $\t500,00 $
09 30 13\tPose céramique\tMO\th\t10\t95,00 $\t950,00 $
09 91 00\tRetouches peinture\tMO\th\t8\t95,00 $\t760,00 $
Sous-total Div. 09\t\t\t\t\t\t2 210,00 $
`;

// -------- parseMoney --------
function parseMoney(s) {
  if (!s) return 0;
  let cleaned = s.replace(/[$\s]/g, "").trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  return parseFloat(cleaned) || 0;
}

// -------- STEP 0: Revision detection --------
const revisionMarkers = [
  /SOUMISSION\s+ULTRA[–—-]D[ÉE]TAILL[ÉE]E?\s*[–—-]\s*R[ÉE]VISION\s*[\d.]+/gi,
  /SOUMISSION\s+D[ÉE]TAILL[ÉE]E?\s*[–—-]\s*R[ÉE]VISION\s*[\d.]+/gi,
  /R[ÉE]VISION\s+[\d.]+\s*[–—-]/gi,
  /SOUMISSION\s*[–—-]+\s*[^\n]{5,}(?:\n|$)/gi,
];

let lastRevisionStart = -1;
for (const marker of revisionMarkers) {
  let m;
  while ((m = marker.exec(chatContent)) !== null) {
    if (m.index > lastRevisionStart) {
      lastRevisionStart = m.index;
    }
  }
}

console.log(`=== Revision Detection ===`);
console.log(`Last revision starts at char index: ${lastRevisionStart}`);
console.log(`Content before: "${chatContent.substring(Math.max(0, lastRevisionStart - 20), lastRevisionStart).trim()}..."`);
console.log(`Content at: "${chatContent.substring(lastRevisionStart, lastRevisionStart + 60)}..."`);

const content = lastRevisionStart > 0 ? chatContent.substring(lastRevisionStart) : chatContent;

// -------- Strategy 1: Tab-separated --------
const divHeaderRegex = /#{1,4}\s*Division\s+(\d{2})\s*[–—-]\s*([^\n]+)/gi;
let divHeaderMatch;
const divHeaders = [];
while ((divHeaderMatch = divHeaderRegex.exec(content)) !== null) {
  divHeaders.push({ code: divHeaderMatch[1], nom: divHeaderMatch[2].trim(), start: divHeaderMatch.index });
}

console.log(`\n=== Division Headers Found (after revision cut) ===`);
console.log(`Count: ${divHeaders.length}`);
divHeaders.forEach(d => console.log(`  Div ${d.code} - ${d.nom}`));

// Parse items
const allItems = [];
for (let dh = 0; dh < divHeaders.length; dh++) {
  const divH = divHeaders[dh];
  const nextStart = dh + 1 < divHeaders.length ? divHeaders[dh + 1].start : content.length;
  const section = content.substring(divH.start, nextStart);
  const lines = section.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    let cells = line.split("\t").map(c => c.trim());
    if (cells.length < 6 && line.includes("|")) {
      cells = line.split("|").map(c => c.trim()).filter(Boolean);
    }
    if (cells.length < 6) continue;
    const codeCell = cells[0];
    if (!/^\d{2}\s\d{2}\s\d{2}$/.test(codeCell)) continue;
    if (cells.join(" ").toLowerCase().includes("sous-total")) continue;

    const prix = parseMoney(cells[5]);
    const qte = parseFloat(cells[4].replace(/[^\d.,]/g, "").replace(",", ".")) || 1;
    if (prix <= 0) continue;

    allItems.push({
      div: divH.code,
      code: codeCell,
      description: cells[1],
      type: cells[2],
      unite: cells[3],
      qte,
      prix,
      total: qte * prix,
    });
  }
}

console.log(`\n=== Items Extracted ===`);
console.log(`Total: ${allItems.length}`);

// Group by division
const byDiv = {};
for (const item of allItems) {
  if (!byDiv[item.div]) byDiv[item.div] = [];
  byDiv[item.div].push(item);
}

let grandTotal = 0;
for (const [divCode, items] of Object.entries(byDiv)) {
  const divTotal = items.reduce((s, i) => s + i.total, 0);
  grandTotal += divTotal;
  console.log(`\nDiv ${divCode}: ${items.length} items, total = ${divTotal.toFixed(2)} $`);
  for (const item of items) {
    console.log(`  ${item.code} | ${item.description} | ${item.type} | ${item.unite} | ${item.qte} x ${item.prix} = ${item.total.toFixed(2)} $`);
  }
}

console.log(`\n=== GRAND TOTAL DIRECT = ${grandTotal.toFixed(2)} $ ===`);

// -------- Validation --------
const EXPECTED_TOTAL = 22105; // 2425 + 3680 + 9940 + 2540 + 1310 + 2210
const EXPECTED_ITEMS = 25;

console.log(`\n=== VALIDATION ===`);
console.log(`Items: ${allItems.length} (expected ${EXPECTED_ITEMS}) -> ${allItems.length === EXPECTED_ITEMS ? "PASS" : "FAIL (got " + allItems.length + ")"}`);
console.log(`Total: ${grandTotal.toFixed(2)} (expected ${EXPECTED_TOTAL}.00) -> ${Math.abs(grandTotal - EXPECTED_TOTAL) < 1 ? "PASS" : "FAIL (got " + grandTotal.toFixed(2) + ")"}`);

// Check NO duplicates from rev 2.0
const rev2Items = allItems.filter(i => i.prix === 800 && i.description === "Gestion projet");
console.log(`Rev 2.0 "Gestion projet 800$": ${rev2Items.length} found -> ${rev2Items.length === 0 ? "PASS (no duplicates)" : "FAIL - old revision items leaked!"}`);

const rev3Items = allItems.filter(i => i.prix === 900 && i.description === "Gestion projet");
console.log(`Rev 3.0 "Gestion projet 900$": ${rev3Items.length} found -> ${rev3Items.length === 1 ? "PASS" : "FAIL"}`);

// Check installation armoires is hourly, not forfait
const installItem = allItems.find(i => i.description === "Installation armoires");
console.log(`Installation armoires: ${installItem ? `${installItem.qte}h x ${installItem.prix}$ = ${installItem.total}$ (unite: ${installItem.unite})` : "NOT FOUND"} -> ${installItem && installItem.qte === 28 && installItem.prix === 95 ? "PASS" : "FAIL"}`);
