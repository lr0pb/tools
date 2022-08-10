function t1() {
  return 't1';
}

const t2 = 2;

const t3 = [1, 2, 3];

export class T4 {
  constructor() {
    this.t5 = { t6: t1() };
  }
}

export function t7() {
  console.log(t1());
}

//export const t8 = 0;
