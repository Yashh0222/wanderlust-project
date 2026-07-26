const { pipeline } = require("@xenova/transformers");

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

async function embedText(text) {
  const pipe = await getEmbedder();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

module.exports = { embedText };
