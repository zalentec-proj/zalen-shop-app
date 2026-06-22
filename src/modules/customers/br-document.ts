export function onlyDigits(value: string | undefined) {
  return value?.replace(/\D/g, '') ?? '';
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string | undefined) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) {
    return false;
  }

  const digits = cpf.split('').map(Number);
  const firstCheck = digits
    .slice(0, 9)
    .reduce((sum, digit, index) => sum + digit * (10 - index), 0);
  const firstDigit = (firstCheck * 10) % 11;
  const expectedFirst = firstDigit === 10 ? 0 : firstDigit;

  const secondCheck = digits
    .slice(0, 10)
    .reduce((sum, digit, index) => sum + digit * (11 - index), 0);
  const secondDigit = (secondCheck * 10) % 11;
  const expectedSecond = secondDigit === 10 ? 0 : secondDigit;

  return digits[9] === expectedFirst && digits[10] === expectedSecond;
}

export function isValidCnpj(value: string | undefined) {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) {
    return false;
  }

  const digits = cnpj.split('').map(Number);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  const firstSum = firstWeights.reduce(
    (sum, weight, index) => sum + digits[index] * weight,
    0
  );
  const firstRest = firstSum % 11;
  const expectedFirst = firstRest < 2 ? 0 : 11 - firstRest;
  const secondSum = secondWeights.reduce(
    (sum, weight, index) => sum + digits[index] * weight,
    0
  );
  const secondRest = secondSum % 11;
  const expectedSecond = secondRest < 2 ? 0 : 11 - secondRest;

  return digits[12] === expectedFirst && digits[13] === expectedSecond;
}

export function isValidCpfOrCnpj(value: string | undefined) {
  const digits = onlyDigits(value);
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
}
