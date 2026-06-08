const sizeOf = require('image-size');
const dimensions = sizeOf('E:/Users/bboylu/Desktop/農家樂中文化/舊版牌/I次發.jpg');
console.log(dimensions.width, dimensions.height);
console.log('Card width:', dimensions.width / 10);
console.log('Card height:', dimensions.height / 7);
