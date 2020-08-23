const config = {
  timeForFrame: 100
}
let frames = []

function $(selector) {
  return document.querySelector(selector);
}

function getFiles(e) {
  frames = []
  for (let file of e.files) {
    let frame = URL.createObjectURL(file)
    frames.push(frame)
  }
}

async function playFiles() {
  for (frame of frames) {
    $('#viewBox').src = frame
    await new Promise( (res) => {
      setTimeout(res, config.timeForFrame)
    })
  }
}

$('input').addEventListener('change', getFiles)
$('#start').addEventListener('click', playFiles)
