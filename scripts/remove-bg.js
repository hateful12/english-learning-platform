const { Jimp } = require('jimp');
const path = require('path');

async function removeBlackBackground() {
  const inputPath = path.join(__dirname, '../public/logo-raw.png');
  const outputPath = path.join(__dirname, '../public/logo.png');

  const image = await Jimp.read(inputPath);

  const threshold = 40;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    if (r < threshold && g < threshold && b < threshold) {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  await image.write(outputPath);
  console.log('Background removed and saved to public/logo.png');
}

removeBlackBackground().catch(console.error);
