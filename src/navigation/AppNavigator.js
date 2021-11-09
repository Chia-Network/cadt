import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { IndeterminateProgressOverlay } from '../components';
import * as Pages from '../pages';

const AppNavigator = () => {
  const { showProgressOverlay } = useSelector(store => store.app);
  return (
    <Router>
      {showProgressOverlay && <IndeterminateProgressOverlay />}
      <Suspense fallback={<IndeterminateProgressOverlay />}>
        <Route exact path="/">
          <Pages.Home />
        </Route>
      </Suspense>
    </Router>
  );
};

export { AppNavigator };
