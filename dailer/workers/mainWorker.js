importScripts('./sharedFunctions.js');

self.postMessage('Worker is running');

self.onmessage = async (e) => { // safari never call message event setted via listener
  self.postMessage(`Received data from page: ${JSON.stringify(e.data)}`)
};
