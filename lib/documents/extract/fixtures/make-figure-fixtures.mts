// Builds the Figure fixtures from the text fixtures next to this file (#7):
//   deck-figures.pptx: deck.pptx plus a diagram on the second slide (between its title and bullets)
//                      and the same logo on every slide.
//   styled-figures.docx: styled.docx plus a diagram after the first paragraph and a 16×16 icon.
//   figures.pdf: two pages printed by headless Chrome: a diagram between two paragraphs, then an icon.
//   scanned.pdf: a page that is only a picture of text (a scan, no text layer), then a normal page.
//   scan-only.pdf: just that scanned page.
// Run from the repo root: node lib/documents/extract/fixtures/make-figure-fixtures.mts
// (figures.pdf needs Google Chrome at CHROME, default the macOS app path).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

const dir = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();
const diagram = await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fff"/>` +
    `<circle cx="80" cy="150" r="40" fill="#36c"/><circle cx="320" cy="150" r="40" fill="#c63"/>` +
    `<line x1="120" y1="150" x2="280" y2="150" stroke="#000" stroke-width="6"/></svg>`,
);
const logo = await png(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#a0a"/></svg>`);
const icon = await png(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#0a0"/></svg>`);

const pic = (rId: string, id: number) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
  `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
  `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="685800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
const imageRel = (rId: string, target: string) =>
  `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

async function addPngType(zip: JSZip) {
  const types = await zip.file("[Content_Types].xml")?.async("string"); // the minimal text fixtures have none
  if (types && !types.includes('Extension="png"')) {
    zip.file("[Content_Types].xml", types.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>'));
  }
}

// PPTX
{
  const zip = await JSZip.loadAsync(readFileSync(path.join(dir, "deck.pptx")));
  zip.file("ppt/media/diagram.png", diagram);
  zip.file("ppt/media/logo.png", logo);
  await addPngType(zip);
  const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  for (const slide of slides) {
    const relsPath = slide.replace("slides/", "slides/_rels/") + ".rels";
    let rels = (await zip.file(relsPath)?.async("string")) ?? emptyRels;
    let xml = await zip.file(slide)!.async("string");
    rels = rels.replace("</Relationships>", `${imageRel("rIdLogo", "../media/logo.png")}</Relationships>`);
    xml = xml.replace("</p:spTree>", `${pic("rIdLogo", 90)}</p:spTree>`);
    if (xml.includes("Minimum Spanning Trees")) {
      rels = rels.replace("</Relationships>", `${imageRel("rIdDiagram", "../media/diagram.png")}</Relationships>`);
      // After the title shape, before the bullets
      xml = xml.replace(/(<p:sp>[\s\S]*?<\/p:sp>)/, `$1${pic("rIdDiagram", 91)}`);
    }
    zip.file(relsPath, rels);
    zip.file(slide, xml);
  }
  writeFileSync(path.join(dir, "deck-figures.pptx"), await zip.generateAsync({ type: "uint8array" }));
}

// DOCX
{
  const zip = await JSZip.loadAsync(readFileSync(path.join(dir, "styled.docx")));
  zip.file("word/media/diagram.png", diagram);
  zip.file("word/media/icon.png", icon);
  await addPngType(zip);
  const relsPath = "word/_rels/document.xml.rels";
  const rels = (await zip.file(relsPath)?.async("string")) ?? emptyRels;
  zip.file(
    relsPath,
    rels.replace("</Relationships>", `${imageRel("rIdDiagram", "media/diagram.png")}${imageRel("rIdIcon", "media/icon.png")}</Relationships>`),
  );
  const drawing = (rId: string, id: number) =>
    `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3810000" cy="2857500"/><wp:docPr id="${id}" name="Picture ${id}"/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="p${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  let xml = await zip.file("word/document.xml")!.async("string");
  xml = xml.replace(
    "<w:document ",
    '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
  );
  // After the heading and the first paragraph
  let seen = 0;
  xml = xml.replace(/<\/w:p>/g, (m) => (++seen === 2 ? `${m}${drawing("rIdDiagram", 1)}${drawing("rIdIcon", 2)}` : m));
  zip.file("word/document.xml", xml);
  writeFileSync(path.join(dir, "styled-figures.docx"), await zip.generateAsync({ type: "uint8array" }));
}

// PDF
{
  const uri = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:16px sans-serif;margin:48px}h1{font-size:32px}.p{break-before:page}</style>
<h1>Week 9: Minimum Spanning Trees</h1><p>A minimum spanning tree connects every vertex.</p>
<img src="${uri(diagram)}" width="400" height="300"><p>Kruskal's algorithm sorts edges by weight.</p>
<h1 class="p">Week 10: Shortest Paths</h1><p>Dijkstra's algorithm needs non-negative weights.</p><img src="${uri(icon)}" width="16" height="16">`;
  const scan = await png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1550"><rect width="1200" height="1550" fill="#fff"/>` +
      `<text x="100" y="200" font-family="Helvetica" font-size="72">Week 11: Hashing</text>` +
      `<text x="100" y="350" font-family="Helvetica" font-size="40">Open addressing probes for a free slot.</text></svg>`,
  );
  const scanned = `<!doctype html><meta charset="utf-8"><style>@page{margin:0}body{margin:0}img{display:block;width:100vw;height:100vh}.p{break-before:page;font:16px sans-serif;margin:48px}</style>
<img src="${uri(scan)}"><div class="p"><h1>Week 12: Heaps</h1><p>A binary heap keeps its smallest key at the root.</p></div>`;
  const print = (name: string, html: string) => {
    const tmp = mkdtempSync(path.join(tmpdir(), "figures-"));
    writeFileSync(path.join(tmp, "f.html"), html);
    execFileSync(CHROME, ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${path.join(dir, name)}`, path.join(tmp, "f.html")], {
      stdio: "ignore",
    });
  };
  print("figures.pdf", html);
  print("scanned.pdf", scanned);
  print("scan-only.pdf", scanned.replace(/<div class="p">[\s\S]*<\/div>/, ""));
}
console.log("wrote deck-figures.pptx, styled-figures.docx, figures.pdf, scanned.pdf, scan-only.pdf");
