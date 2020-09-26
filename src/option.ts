export interface Option {
  src: string;
}

export const defaultOption: Option = {
  src:
    'https://raw.githubusercontent.com/SnO2WMaN-HQ/ignoregen-template/master/templates/',
};

export function parseOption(
  rcOption: Partial<Option>,
  commentOption: Partial<Option>,
) {
  return {
    ...defaultOption,
    ...rcOption,
    ...commentOption,
  };
}
