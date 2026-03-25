const { Jimp } = require("jimp");
const path = require("path");

const filePath = path.join(__dirname, "../public/logo.png");

async function removeBg() {
  const image = await Jimp.read(filePath);

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    // Make near-black pixels transparent
    if (r < 40 && g < 40 && b < 40) {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  await image.write(filePath);
  console.log("Done — black background removed from logo.png");
}

removeBg().catch(console.error);
