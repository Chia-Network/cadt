import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { IntlProvider } from 'react-intl';

import { loadLocaleData } from './translations';
import store from './store';
import { AppNavigator } from './navigation';
import theme from './theme';

import { IndeterminateProgressOverlay } from './components';

const App = () => {
  const [translationTokens, setTranslationTokens] = useState();

  useEffect(() => {
    const processTranslationTokens = async () => {
      setTranslationTokens(await loadLocaleData());
    };

    processTranslationTokens();
  }, []);

  if (!translationTokens) {
    return <IndeterminateProgressOverlay />;
  }

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <IntlProvider defaultLocale="en" messages={translationTokens.default}>
          <AppNavigator />
        </IntlProvider>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
