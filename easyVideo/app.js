const config = {
  timeForFrame: 80
}
let frames = []

function $(selector) {
  return document.querySelector(selector);
}

function log(content) {
   let log = $('#log').innerHTML
   $('#log'). innerHTML = `${log} <br> ${content}`
}

function getFiles() {
  frames = []
  for (let file of this.files) {
    let frame = URL.createObjectURL(file)
    frames.push(frame)
  }
  log(`files: ${frames.length}`)
  log(frames)
}

async function playFiles() {
  log('playing')
  log(frames)
  for (frame of frames) {
    $('#viewBox').setAttribute('src', frame)
    await new Promise( (res) => {
      log('waiting')
      setTimeout(res, config.timeForFrame)
    })
  }
}

$('input').addEventListener('change', getFiles)
$('#start').addEventListener('click', playFiles)
