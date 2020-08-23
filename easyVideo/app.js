const config = {
  timeForFrame: 80
}
let frames = []

function $(selector) {
  return document.querySelector(selector);
}

function log(content) {
   let log = $('#log').textContent
   $('#log').textContent = 'log'
   $('#log').textContent = `${log}\n ${content}`
}

function getFiles() {
  frames = []
  for (let file of this.files) {
    let frame = URL.createObjectURL(file)
    frames.push(frame)
  }
  log(`files: ${frames.length}`)
}

async function playFiles() {
  for (frame of frames) {
    $('#viewBox').setAttribute('src', frame)
    await new Promise( (res) => {
      log('frame')
      setTimeout( () => res(), config.timeForFrame)
    })
  }
}

$('input').addEventListener('change', getFiles)
$('#start').addEventListener('click', playFiles)
