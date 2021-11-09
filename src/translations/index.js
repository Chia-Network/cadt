const LANGUAGE_CODES = Object.freeze({
  ENGLISH_US: 'en-us',
  ENGLISH: 'en',
  SPANISH: 'es',
  JAPANESE: 'ja',
});

const loadLocaleData = () => {
  // eslint-disable-next-line no-undef
  switch (navigator.language) {
    case LANGUAGE_CODES.SPANISH:
      return import('./tokens/es.json');
    case LANGUAGE_CODES.JAPANESE:
      return import('./tokens/ja.json');
    case LANGUAGE_CODES.ENGLISH_US:
    case LANGUAGE_CODES.ENGLISH:
    default:
      return import('./tokens/en-US.json');
  }
};

export {loadLocaleData};
