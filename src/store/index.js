import {createStore, combineReducers, applyMiddleware} from 'redux';
import ReduxThunk from 'redux-thunk';

import {appReducer, tokenReducer} from './reducers';

const rootReducer = combineReducers({
  app: appReducer,
  tokens: tokenReducer,
});

export default createStore(rootReducer, applyMiddleware(ReduxThunk));

export * from './store-functions';
