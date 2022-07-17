var path = require('path');

const scriptPath = __dirname;
const samplesPath = path.join(scriptPath, '..', 'samples');

function forEachSample(cb) {
	cb('..');
}

module.exports = forEachSample;
