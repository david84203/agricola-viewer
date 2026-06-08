const sizeOf = require('image-size');
const dimensions1 = sizeOf('images/舊版E職業1.jpg');
console.log('舊版E職業1:', dimensions1.width, dimensions1.height);
const dimensions2 = sizeOf('images/舊版E職業2.jpg');
console.log('舊版E職業2:', dimensions2.width, dimensions2.height);
const dimensions3 = sizeOf('images/舊版E次發.jpg');
console.log('舊版E次發:', dimensions3.width, dimensions3.height);
