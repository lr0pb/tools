import pages from './pages.js'

const globals = {
  paintPage: (name) => {
    document.body.innerHTML = pages[name].page;
    pages[name].script(globals);
  }
}

globals.paintPage('onboarding');
