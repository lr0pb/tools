const config = {
  timeForFrame: 100
}
let frames = []

function $(selector) {
  return document.querySelector(selector);
}

function log(content) {
   let log = $('#log').textContent
   log = `${log}\n ${content}`
}

function getFiles(e) {
  frames = []
  for (let file of e.files) {
    let frame = URL.createObjectURL(file)
    frames.push(frame)
  }
  log(frames)
}

async function playFiles() {
  for (frame of frames) {
    $('#viewBox').setAttribute('src', frame)
    await new Promise( (res) => {
      log('waiting')
      setTimeout( () => res(), config.timeForFrame)
    })
  }
}

$('input').addEventListener('change', getFiles)
$('#start').addEventListener('click', playFiles)
