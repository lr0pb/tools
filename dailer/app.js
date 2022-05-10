import {
  onboarding, planCreator
} from './pages.js'

const globals = {
  paintPage: (name) => {
    document.body.innerHTML = name.page;
    name.script(globals);
  }
}

globals.paintPage(onboarding);
