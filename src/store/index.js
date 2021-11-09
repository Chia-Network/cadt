import {createStore, combineReducers, applyMiddleware} from 'redux';
import ReduxThunk from 'redux-thunk';

import {appReducer} from './reducers';

const rootReducer = combineReducers({
  app: appReducer,
});

export default createStore(rootReducer, applyMiddleware(ReduxThunk));

export * from './store-functions';
