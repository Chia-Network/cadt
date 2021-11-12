import React, {useEffect, useState} from 'react';
import {ThemeProvider} from 'styled-components';
import {IntlProvider} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {setLocale, setThemeFromLocalStorage} from './store/actions/app';
import {loadLocaleData} from './translations';

import {AppNavigator} from './navigation';
import theme from './theme';

import {IndeterminateProgressOverlay} from './components';

const App = () => {
  const dispatch = useDispatch();
  const appStore = useSelector(state => state.app);
  const [translationTokens, setTranslationTokens] = useState();

  useEffect(
    () => dispatch(setThemeFromLocalStorage),
    [setThemeFromLocalStorage],
  );

  useEffect(() => {
    if (appStore.locale) {
      const processTranslationTokens = async () => {
        setTranslationTokens(await loadLocaleData(appStore.locale));
      };

      processTranslationTokens();
    } else {
      dispatch(setLocale(navigator.language));
    }
  }, [appStore.locale]);

  if (!translationTokens) {
    return <IndeterminateProgressOverlay />;
  }

  return (
    <ThemeProvider theme={theme}>
      <IntlProvider
        locale="en"
        defaultLocale="en"
        messages={translationTokens.default}>
        <AppNavigator />
      </IntlProvider>
    </ThemeProvider>
  );
};

export default App;
