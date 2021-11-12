import u from 'updeep';

import {actions as tokenActions} from '../actions/tokens';

const initialState = {
  retiredTokens: null,
};

const tokenReducer = (state = initialState, action) => {
  switch (action.type) {
    case tokenActions.GET_RETIRED_TOKENS:
      return u({retiredTokens: action.payload}, state);
    default:
      return state;
  }
};

export {tokenReducer};
