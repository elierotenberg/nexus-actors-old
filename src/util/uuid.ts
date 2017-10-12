// Kindly inspired by https://gist.github.com/jcxplorer/823878

const create = () => {
  let result = "";
  for (let i = 0; i < 32; i++) {
    const noise = (Math.random() * 16) | 0;
    if (i == 8 || i == 12 || i == 16 || i == 20) {
      result += "-";
    }
    result += (i == 12 ? 4 : i == 16 ? (noise & 3) | 9 : noise).toString(16);
  }
  return result;
};

// Kindly taken from https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
const validateRegExp: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validate = (x: string): boolean => validateRegExp.test(x);

export { create, validate };
